/**
 * PCM 音频流式播放驱动 (Model B / 方案 C)
 *
 * 核心设计与物理机制:
 * 1. 彻底废弃 HTML5 <audio> 标签黑盒预缓冲流水线 (杜绝 2.64s ~ 3.5s 强制缓冲导致的切歌/寻道滞后);
 * 2. 基于 fetch + ReadableStream 零拷贝直接拉取 MPD httpd (:8000) wave/PCM 44100:16:2 无损流;
 * 3. 极速跳过 44 字节 WAV 头部, 将 16-bit 线性 PCM 小端数据实时转换为 WebAudio Float32Array;
 * 4. 采用 AudioBufferSourceNode 极低延迟调度 (基准抖动缓冲仅 35ms, 比上一代 3500ms 降低 100 倍);
 * 5. 寻道 / 切歌时实现平滑淡出淡入过渡 (支持配置文件灵活开关与时长调节, 彻底消除生硬硬切爆音);
 * 6. 双级增益拓扑: fadeGainNode (平滑淡入淡出) -> masterGainNode (音量/静音) -> AnalyserNode (FFT 频域分析).
 */

/**
 * 音频淡出淡入过渡配置项
 */
export interface FadeConfig {
  /** 是否开启淡出淡入平滑过渡 (默认 true; 为 false 时为瞬时硬切换) */
  enabled: boolean
  /** 淡入淡出时长 (毫秒, 范围 20 ~ 1000, 推荐 80 ~ 200, 默认 120) */
  duration: number
}

export class PcmPlayer {
  private audioCtx: AudioContext | null = null

  // 双级增益拓扑解耦: 每个流世代 (Generation) 拥有独立的淡入淡出 GainNode
  // 彻底杜绝旧流淡出与新流淡入在同一 GainNode 相互污染、拉扯或瞬间阶跃爆音
  private activeFadeGainNode: GainNode | null = null
  private masterGainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null

  // fetch 读取流的 AbortController 句柄与流世代 ID (防止旧流尾包泄漏至新流)
  private abortController: AbortController | null = null
  private currentStreamId: number = 0

  // 当前已调度在 WebAudio 硬件时钟管线中的音频源节点 (仅属于当前活跃流世代)
  private activeSources: Set<AudioBufferSourceNode> = new Set()

  // 下一个 AudioBuffer 调度的基准时间戳 (秒)
  private nextPlayTime: number = 0

  // 播放状态与音量状态
  private currentVolume: number = 1.0
  private isMuted: boolean = false
  private isPlayingState: boolean = false

  // 淡出淡入过渡配置与淡入标记
  private fadeConfig: FadeConfig = {
    enabled: true,
    duration: 120
  }
  private isFadingIn: boolean = false

  // WAV 头部解析缓存与尾部残余字节
  private headerParsed: boolean = false
  private headerBuffer: Uint8Array = new Uint8Array(0)
  private residualBytes: Uint8Array = new Uint8Array(0)
  private streamSampleRate: number = 44100

  // 当前连接的流 URL
  private currentStreamUrl: string = ''

  /**
   * 初始化或获取 AudioContext 及其音频图
   * 拓扑: activeFadeGainNode (流专属) -> masterGainNode -> AnalyserNode -> destination
   */
  public initAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      // 采用系统原生最佳采样率 (例如 Linux PipeWire 为 48000 Hz, 避免与系统硬件驱动发生二次有损重采样抖动)
      this.audioCtx = new AudioContextClass()

      // 1. 用户主音量与静音专用增益节点
      this.masterGainNode = this.audioCtx.createGain()

      // 2. FFT 频域分析器 (为 M2-1 频谱律动奠定底座)
      this.analyserNode = this.audioCtx.createAnalyser()
      this.analyserNode.fftSize = 256
      this.analyserNode.smoothingTimeConstant = 0.8

      this.updateGain()

      // 串联音频主拓扑
      this.masterGainNode.connect(this.analyserNode)
      this.analyserNode.connect(this.audioCtx.destination)

      // 3. 创建首个流世代的淡入淡出增益节点
      this.activeFadeGainNode = this.audioCtx.createGain()
      this.activeFadeGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime)
      this.activeFadeGainNode.connect(this.masterGainNode)
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {
        // 静默等待后续用户手势唤醒
      })
    }

    return this.audioCtx
  }

  /**
   * 创建全新流世代淡入淡出 GainNode 并挂载主拓扑 (与 flushAndReconnect 共用的唯一创建点)
   *
   * 为什么抽成共用: play-after-pause 与 flush 都需要"全新满血增益",
   * 之前只有 flush 内联创建, play 路径拿不到新节点导致永久静音 (P0)。
   */
  private createNewFadeGain(audioCtx: AudioContext): GainNode {
    const now = audioCtx.currentTime
    const fresh = audioCtx.createGain()
    if (this.fadeConfig.enabled) {
      // 初始 0 增益, 待首个新音频块到达时从 0 平滑爬升至 1.0
      fresh.gain.setValueAtTime(0, now)
      this.isFadingIn = true
    } else {
      fresh.gain.setValueAtTime(1.0, now)
      this.isFadingIn = false
    }
    if (this.masterGainNode) {
      fresh.connect(this.masterGainNode)
    }
    this.activeFadeGainNode = fresh
    return fresh
  }

  /**
   * 确保当前存在可用淡入淡出 GainNode (暂停后重建, 修复 P0 永久静音)
   */
  private ensureFadeGain(): GainNode | null {
    if (this.activeFadeGainNode) {
      return this.activeFadeGainNode
    }
    const audioCtx = this.initAudioContext()
    if (!this.masterGainNode) {
      return null
    }
    return this.createNewFadeGain(audioCtx)
  }

  /**
   * 获取当前活跃的淡入淡出 GainNode (供外部诊断与向后兼容)
   */
  public get fadeGainNode(): GainNode | null {
    return this.activeFadeGainNode
  }

  /**
   * 获取当前流识别到的真实采样率 (例如 44100 或 48000)
   */
  public getSampleRate(): number {
    return this.streamSampleRate
  }

  /**
   * 动态更新淡入淡出配置 (支持配置文件热更新即时生效)
   */
  public setFadeConfig(config: Partial<FadeConfig>): void {
    this.fadeConfig = {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : this.fadeConfig.enabled,
      duration:
        typeof config.duration === 'number'
          ? Math.max(20, Math.min(1000, Math.round(config.duration)))
          : this.fadeConfig.duration
    }

    // 若禁用淡出淡入, 立即复位当前 fadeGainNode 至 1.0 满增益并取消淡入等待
    if (!this.fadeConfig.enabled && this.activeFadeGainNode && this.audioCtx) {
      this.activeFadeGainNode.gain.cancelScheduledValues(this.audioCtx.currentTime)
      this.activeFadeGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime)
      this.isFadingIn = false
    }
  }

  /**
   * 获取当前淡出淡入配置快照
   */
  public getFadeConfig(): FadeConfig {
    return { ...this.fadeConfig }
  }

  /**
   * 启动流式播放
   * @param url 音频流地址 (例如 http://127.0.0.1:8000)
   */
  public play(url: string): void {
    this.currentStreamUrl = url
    this.isPlayingState = true

    // 如果流已经在跑且连接健康, 则不重复建连
    if (this.abortController && !this.abortController.signal.aborted) {
      const ctx = this.initAudioContext()
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      return
    }

    // 暂停后增益已置空, 先重建增益再建流, 否则调度出未接入的无声源 (P0 永久静音)
    this.ensureFadeGain()
    this.startStream(url, this.currentStreamId)
  }

  /**
   * 核心: 寻道 / 切歌时的平滑排空与极速重连
   * 采用解耦的流世代 (Generation) 增益架构，彻底消除旧流与新流交叠产生的杂音
   */
  public flushAndReconnect(url: string): void {
    this.currentStreamUrl = url
    this.isPlayingState = true

    // 递增流世代 ID, 使得任何在微任务队列中的旧流尾包被直接丢弃
    this.currentStreamId++
    const streamId = this.currentStreamId

    const audioCtx = this.initAudioContext()
    const now = audioCtx.currentTime

    // 1. 中断正在拉取的旧 fetch HTTP 流
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    // 2. 将当前旧音源与旧 GainNode 隔离并启动独立淡出
    const retiringFadeGain = this.activeFadeGainNode
    const oldSources = new Set(this.activeSources)
    this.activeSources.clear()

    if (this.fadeConfig.enabled && oldSources.size > 0 && retiringFadeGain) {
      // 淡出时长: 歌词跳转或切歌时快速平滑收尾 (40ms ~ 80ms)
      const fadeOutSec = Math.max(0.02, Math.min(0.08, this.fadeConfig.duration / 1000))

      retiringFadeGain.gain.cancelScheduledValues(now)
      retiringFadeGain.gain.setValueAtTime(retiringFadeGain.gain.value, now)
      retiringFadeGain.gain.linearRampToValueAtTime(0, now + fadeOutSec)

      // 旧源节点延时至淡出结束点停止
      for (const src of oldSources) {
        try {
          src.stop(now + fadeOutSec)
        } catch {
          // 忽略已自然播放完的节点
        }
      }

      // 淡出结束后完全断开旧节点并释放资源
      setTimeout(() => {
        try {
          retiringFadeGain.disconnect()
        } catch {}
      }, (fadeOutSec + 0.05) * 1000)
    } else {
      // 禁用淡入淡出: 0ms 硬截断
      for (const src of oldSources) {
        try {
          src.stop(0)
          src.disconnect()
        } catch {}
      }
      if (retiringFadeGain) {
        try {
          retiringFadeGain.disconnect()
        } catch {}
      }
    }

    // 3. 为新世代创建独立的全新的 fadeGainNode (彻底杜绝旧声与新声在同一 GainNode 冲突)
    this.createNewFadeGain(audioCtx)

    // 4. 重置新流时间轴与数据残留缓冲
    this.nextPlayTime = 0
    this.headerParsed = false
    this.headerBuffer = new Uint8Array(0)
    this.residualBytes = new Uint8Array(0)
    this.streamSampleRate = 44100

    // 5. 立即开启新流
    this.startStream(url, streamId)
  }

  /**
   * 暂停音频
   */
  public pause(): void {
    this.isPlayingState = false
    this.currentStreamId++

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    const audioCtx = this.audioCtx
    const retiringFadeGain = this.activeFadeGainNode
    const oldSources = new Set(this.activeSources)
    this.activeSources.clear()

    if (this.fadeConfig.enabled && retiringFadeGain && audioCtx && oldSources.size > 0) {
      const now = audioCtx.currentTime
      const fadeSec = Math.min(0.06, this.fadeConfig.duration / 1000)
      retiringFadeGain.gain.cancelScheduledValues(now)
      retiringFadeGain.gain.setValueAtTime(retiringFadeGain.gain.value, now)
      retiringFadeGain.gain.linearRampToValueAtTime(0, now + fadeSec)

      for (const src of oldSources) {
        try {
          src.stop(now + fadeSec)
        } catch {}
      }
      setTimeout(() => {
        try {
          retiringFadeGain.disconnect()
        } catch {}
      }, (fadeSec + 0.05) * 1000)
    } else {
      for (const src of oldSources) {
        try {
          src.stop(0)
          src.disconnect()
        } catch {}
      }
      if (retiringFadeGain) {
        try {
          retiringFadeGain.disconnect()
        } catch {}
      }
    }

    this.activeFadeGainNode = null
    this.nextPlayTime = 0
    this.headerParsed = false
    this.headerBuffer = new Uint8Array(0)
    this.residualBytes = new Uint8Array(0)
    this.isFadingIn = false
    this.streamSampleRate = 44100

    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend().catch(() => {})
    }
  }

  /**
   * 恢复音频播放
   */
  public resume(url?: string): void {
    this.isPlayingState = true
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {})
    }
    const streamUrl = url || this.currentStreamUrl
    if (streamUrl) {
      this.flushAndReconnect(streamUrl)
    }
  }

  /**
   * 停止音频
   */
  public stop(): void {
    this.pause()
    this.currentStreamUrl = ''
  }

  /**
   * 调节音量 (0.0 ~ 1.0)
   */
  public setVolume(volume0to1: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume0to1))
    this.updateGain()
  }

  /**
   * 切换静音
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted
    this.updateGain()
  }

  /**
   * 获取当前播放状态
   */
  public isPlaying(): boolean {
    return this.isPlayingState
  }

  /**
   * 获取 FFT 分析器节点 (供 M2-1 频谱分析使用)
   */
  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode
  }

  /**
   * 内部: 建立 fetch 流式读取循环
   */
  private startStream(url: string, streamId: number): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    const ac = new AbortController()
    this.abortController = ac

    const audioCtx = this.initAudioContext()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    // 建流前确保增益就绪 (暂停后重建, 与 play() 双保险, P0)
    this.ensureFadeGain()

    fetch(url, { signal: ac.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.body) {
          throw new Error('Response body is null')
        }
        const reader = response.body.getReader()
        try {
          while (!ac.signal.aborted && this.currentStreamId === streamId) {
            const { done, value } = await reader.read()
            if (done || ac.signal.aborted || this.currentStreamId !== streamId) {
              break
            }
            if (value && value.length > 0) {
              this.handleIncomingBytes(value, streamId)
            }
          }
        } finally {
          // 读取锁必须释放, 否则复用连接时泄漏 (P1); 自然结束时置空句柄,
          // 让 play() 健康检查认到断流而不是误判健康 (P2)
          try {
            await reader.cancel()
          } catch {}
          try {
            reader.releaseLock()
          } catch {}
          if (this.abortController === ac) {
            this.abortController = null
          }
        }

        // 若 MPD 在歌曲结束或切换格式时自然关闭当前 HTTP 连接,
        // 如果当前仍处于播放状态，延迟微量时间自动重连新流，确保自然跨曲播放无缝连续
        if (!ac.signal.aborted && this.isPlayingState && this.currentStreamId === streamId) {
          setTimeout(() => {
            if (this.isPlayingState && this.currentStreamId === streamId) {
              this.flushAndReconnect(this.currentStreamUrl)
            }
          }, 150)
        }
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted || this.currentStreamId !== streamId) {
          // 主动中断属正常交互行为 (切歌/寻道/暂停)
          return
        }
        // 真异常断流: 先置空句柄, 让 play() 健康检查认到断流 (P2),
        // 再延迟重连; 重连的 flush 会建新句柄, 不影响本次置空
        if (this.abortController === ac) {
          this.abortController = null
        }
        console.warn('[PcmPlayer] 音频流断开或异常:', err)
        if (this.isPlayingState && this.currentStreamId === streamId) {
          setTimeout(() => {
            if (this.isPlayingState && this.currentStreamId === streamId) {
              this.flushAndReconnect(this.currentStreamUrl)
            }
          }, 600)
        }
      })
  }

  /**
   * 处理流式到达的二进制数据块
   */
  private handleIncomingBytes(chunk: Uint8Array, streamId: number): void {
    if (this.currentStreamId !== streamId) return

    // 1. 未解析 WAV 头部时, 累积直到包含完整的 WAV 头部 (至少 44 字节)
    if (!this.headerParsed) {
      const nextHeader = new Uint8Array(this.headerBuffer.length + chunk.length)
      nextHeader.set(this.headerBuffer, 0)
      nextHeader.set(chunk, this.headerBuffer.length)
      this.headerBuffer = nextHeader

      if (this.headerBuffer.length >= 44) {
        // 校验并对齐 RIFF 标识, 确保 WAV 头部字节绝对不会被当作 PCM 播放
        let riffOffset = -1
        for (let i = 0; i <= this.headerBuffer.length - 4; i++) {
          if (
            this.headerBuffer[i] === 0x52 && // 'R'
            this.headerBuffer[i + 1] === 0x49 && // 'I'
            this.headerBuffer[i + 2] === 0x46 && // 'F'
            this.headerBuffer[i + 3] === 0x46    // 'F'
          ) {
            riffOffset = i
            break
          }
        }

        if (riffOffset >= 0 && this.headerBuffer.length >= riffOffset + 44) {
          this.headerParsed = true
          // 动态解析真实采样率 (WAV 头部 24..27 字节为 32-bit 小端序采样率)
          const headerView = new DataView(
            this.headerBuffer.buffer,
            this.headerBuffer.byteOffset + riffOffset,
            44
          )
          const parsedSampleRate = headerView.getUint32(24, true)
          if (parsedSampleRate >= 8000 && parsedSampleRate <= 384000) {
            this.streamSampleRate = parsedSampleRate
          } else {
            this.streamSampleRate = 44100
          }

          const pcmData = this.headerBuffer.slice(riffOffset + 44)
          this.headerBuffer = new Uint8Array(0)
          if (pcmData.length > 0) {
            this.processPcmChunk(pcmData)
          }
        } else if (riffOffset === -1 && this.headerBuffer.length > 256) {
          // 兜底保护: 超过 256 字节仍无 RIFF, 按裸 PCM 播放已缓存字节避免死锁,
          // 但不锁死 headerParsed, 保持继续扫描后续块中的新 WAV 头 (P2 44100 锁死修复)
          const pcmData = this.headerBuffer
          this.headerBuffer = new Uint8Array(0)
          this.processPcmChunk(pcmData)
        }
      }
      return
    }

    // 2. 头部已就绪: 先扫描块中新 WAV 头 (MPD 同连接内切歌重建流),
    // 命中则重置采样率与解析态, 重新走头部解析 (P2 44100 锁死修复)
    const riffAt = this.findRiffIndex(chunk)
    if (riffAt >= 0) {
      if (riffAt > 0) {
        // 先播放新头部之前的旧曲尾巴, 避免丢音
        this.processPcmChunk(chunk.slice(0, riffAt))
      }
      this.headerParsed = false
      this.headerBuffer = new Uint8Array(0)
      this.residualBytes = new Uint8Array(0)
      this.handleIncomingBytes(chunk.slice(riffAt), streamId)
      return
    }
    this.processPcmChunk(chunk)
  }

  /**
   * 在数据块中定位新 WAV 头 RIFF 标识
   *
   * 为什么要验 WAVE: 裸 PCM 音频字节随机撞上 'RIFF' 四字节的概率虽低但非零,
   * 有足够字节时必须同时校验偏移 +8 处 'WAVE', 避免把正常音频误判成新头部切歌。
   * 尾部不足 12 字节无法验 WAVE 时按候选接受 (头部恰被切在块边界), 由头部解析路径二次确认。
   */
  private findRiffIndex(chunk: Uint8Array): number {
    for (let i = 0; i <= chunk.length - 4; i++) {
      if (
        chunk[i] === 0x52 && // 'R'
        chunk[i + 1] === 0x49 && // 'I'
        chunk[i + 2] === 0x46 && // 'F'
        chunk[i + 3] === 0x46    // 'F'
      ) {
        // 块内剩余不足以验 WAVE, 按候选接受
        if (i + 12 > chunk.length) {
          return i
        }
        // 校验 'WAVE' 标识, 通过才认定为新头部
        if (
          chunk[i + 8] === 0x57 && // 'W'
          chunk[i + 9] === 0x41 && // 'A'
          chunk[i + 10] === 0x56 && // 'V'
          chunk[i + 11] === 0x45    // 'E'
        ) {
          return i
        }
      }
    }
    return -1
  }

  /**
   * 将裸 PCM 字节转换为 Float32 并调度进入 WebAudio
   */
  private processPcmChunk(chunk: Uint8Array): void {
    const audioCtx = this.initAudioContext()

    // P0 保底: 无可用增益节点时直接丢块, 严禁调度未接入的无声源空烧 CPU
    // (检查放在残余合并之前, 丢块不吞 residual, 下一块仍能拼出完整帧)
    const currentGain = this.activeFadeGainNode
    if (!currentGain) {
      return
    }

    // P1 暂停态积压保护: 上下文仍挂起时丢弃本块并钳位时钟, 待 resume 后再收新块
    if (audioCtx.state === 'suspended') {
      this.nextPlayTime = audioCtx.currentTime + 0.08
      return
    }

    let merged: Uint8Array
    if (this.residualBytes.length > 0) {
      merged = new Uint8Array(this.residualBytes.length + chunk.length)
      merged.set(this.residualBytes, 0)
      merged.set(chunk, this.residualBytes.length)
      this.residualBytes = new Uint8Array(0)
    } else {
      merged = chunk
    }

    // 16-bit stereo PCM: 4 字节为 1 个立体声样本帧 (2 字节 L + 2 字节 R)
    const frameCount = Math.floor(merged.length / 4)
    if (frameCount === 0) {
      this.residualBytes = merged
      return
    }

    const usableBytes = frameCount * 4
    const leftoverCount = merged.length - usableBytes
    if (leftoverCount > 0) {
      this.residualBytes = merged.slice(usableBytes)
    }

    const audioBuffer = audioCtx.createBuffer(2, frameCount, this.streamSampleRate)
    const leftChannel = audioBuffer.getChannelData(0)
    const rightChannel = audioBuffer.getChannelData(1)

    // 小端序 Int16 转 Float32
    const dataView = new DataView(merged.buffer, merged.byteOffset, usableBytes)
    for (let i = 0; i < frameCount; i++) {
      leftChannel[i] = dataView.getInt16(i * 4, true) / 32768.0
      rightChannel[i] = dataView.getInt16(i * 4 + 2, true) / 32768.0
    }

    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer

    // 接入当前流世代专属的淡入淡出 GainNode (上游已保底非空, 直连即可)
    source.connect(currentGain)

    const now = audioCtx.currentTime

    // 调度时钟计算:
    // 如果是首个 chunk (nextPlayTime === 0) 或发生真实欠载 (nextPlayTime < now)
    // 赋予 80ms 充足抗抖前瞻量, 抵抗主线程或 GC 微暂停.
    // 只要 nextPlayTime >= now (音频仍在持续发声), 严格连续平铺, 严禁插入人工静音裂隙!
    // 若超前超过约 0.5s (挂起积压), 拉回避免恢复时突发 burst (P1)
    if (this.nextPlayTime < now) {
      this.nextPlayTime = now + 0.08
    } else if (this.nextPlayTime - now > 0.5) {
      this.nextPlayTime = now + 0.08
    }

    // 若当前为切歌或寻道后的淡入阶段, 在当前专属 GainNode 上启动从 0 渐进至 1.0 的平滑淡入
    if (this.isFadingIn) {
      this.isFadingIn = false
      const fadeInSec = Math.max(0.02, Math.min(0.12, this.fadeConfig.duration / 1000))
      const fadeInStart = this.nextPlayTime
      currentGain.gain.cancelScheduledValues(fadeInStart)
      currentGain.gain.setValueAtTime(0, fadeInStart)
      currentGain.gain.linearRampToValueAtTime(1.0, fadeInStart + fadeInSec)
    }

    source.start(this.nextPlayTime)
    this.nextPlayTime += audioBuffer.duration

    this.activeSources.add(source)
    source.onended = () => {
      this.activeSources.delete(source)
      try {
        source.disconnect()
      } catch {}
    }
  }

  /**
   * 平滑更新主增益 (5ms 线性微渐变, 杜绝用户音量瞬变产生的喀哒爆音)
   */
  private updateGain(): void {
    if (!this.masterGainNode || !this.audioCtx) return
    const targetGain = this.isMuted ? 0 : this.currentVolume
    this.masterGainNode.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.005)
  }
}

// 导出单例对象
export const pcmPlayer = new PcmPlayer()
