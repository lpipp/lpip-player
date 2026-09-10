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
  // 双级增益拓扑: fadeGain 专职切歌/寻道平滑过渡, masterGain 专职用户主音量与静音
  private fadeGainNode: GainNode | null = null
  private masterGainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null

  // fetch 读取流的 AbortController 句柄
  private abortController: AbortController | null = null

  // 当前所有已调度在 WebAudio 硬件时钟管线中的音频源节点
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

  // 当前连接的流 URL
  private currentStreamUrl: string = ''

  /**
   * 初始化或获取 AudioContext 及其音频图
   * 拓扑: AudioBufferSourceNode -> fadeGainNode -> masterGainNode -> AnalyserNode -> destination
   */
  public initAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioCtx = new AudioContextClass({ sampleRate: 44100 })

      // 1. 淡入淡出专用增益节点 (默认满增益 1.0)
      this.fadeGainNode = this.audioCtx.createGain()
      this.fadeGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime)

      // 2. 用户主音量与静音专用增益节点
      this.masterGainNode = this.audioCtx.createGain()

      // 3. FFT 频域分析器 (为 M2-1 频谱律动奠定底座)
      this.analyserNode = this.audioCtx.createAnalyser()
      this.analyserNode.fftSize = 256
      this.analyserNode.smoothingTimeConstant = 0.8

      this.updateGain()

      // 串联音频拓扑
      this.fadeGainNode.connect(this.masterGainNode)
      this.masterGainNode.connect(this.analyserNode)
      this.analyserNode.connect(this.audioCtx.destination)
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {
        // 静默等待后续用户手势唤醒
      })
    }

    return this.audioCtx
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

    // 若禁用淡出淡入, 立即复位 fadeGainNode 至 1.0 满增益并取消淡入等待
    if (!this.fadeConfig.enabled && this.fadeGainNode && this.audioCtx) {
      this.fadeGainNode.gain.cancelScheduledValues(this.audioCtx.currentTime)
      this.fadeGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime)
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

    this.startStream(url)
  }

  /**
   * 核心: 寻道 / 切歌时的瞬间排空与极速重连 (支持平滑淡出淡入)
   */
  public flushAndReconnect(url: string): void {
    this.currentStreamUrl = url
    this.isPlayingState = true

    const audioCtx = this.initAudioContext()
    const now = audioCtx.currentTime

    // 1. 若启用了淡入淡出且当前有正在发声的音源, 执行平滑淡出
    if (this.fadeConfig.enabled && this.activeSources.size > 0 && this.fadeGainNode) {
      const fadeSec = Math.max(0.02, Math.min(1.0, this.fadeConfig.duration / 1000))

      // 优雅从当前增益线性淡出至 0
      this.fadeGainNode.gain.cancelScheduledValues(now)
      this.fadeGainNode.gain.setValueAtTime(this.fadeGainNode.gain.value, now)
      this.fadeGainNode.gain.linearRampToValueAtTime(0, now + fadeSec)

      // 旧源节点延时至淡出结束点精准停止, 随后由 onended 回调安全销毁
      const oldSources = new Set(this.activeSources)
      for (const src of oldSources) {
        try {
          src.stop(now + fadeSec)
        } catch {
          // 忽略已自然播放完的节点
        }
      }
      this.activeSources.clear()

      // 标记新流首个音频块到达时启动淡入
      this.isFadingIn = true
    } else {
      // 未启用淡出淡入: 0ms 硬截断
      if (this.fadeGainNode) {
        this.fadeGainNode.gain.cancelScheduledValues(now)
        this.fadeGainNode.gain.setValueAtTime(1.0, now)
      }
      for (const src of this.activeSources) {
        try {
          src.stop(0)
          src.disconnect()
        } catch {}
      }
      this.activeSources.clear()
      this.isFadingIn = false
    }

    // 2. 立即中断正在拉取的旧 fetch HTTP 流
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    // 3. 重置调度时间轴与数据残留缓冲
    this.nextPlayTime = 0
    this.headerParsed = false
    this.headerBuffer = new Uint8Array(0)
    this.residualBytes = new Uint8Array(0)

    // 4. 立即开启新流 (新数据将在 ~40ms 内到达并出声)
    this.startStream(url)
  }

  /**
   * 暂停音频
   */
  public pause(): void {
    this.isPlayingState = false

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    const audioCtx = this.audioCtx
    if (this.fadeConfig.enabled && this.fadeGainNode && audioCtx && this.activeSources.size > 0) {
      const now = audioCtx.currentTime
      const fadeSec = Math.min(0.08, this.fadeConfig.duration / 1000)
      this.fadeGainNode.gain.cancelScheduledValues(now)
      this.fadeGainNode.gain.setValueAtTime(this.fadeGainNode.gain.value, now)
      this.fadeGainNode.gain.linearRampToValueAtTime(0, now + fadeSec)

      const sourcesToStop = new Set(this.activeSources)
      for (const src of sourcesToStop) {
        try {
          src.stop(now + fadeSec)
        } catch {}
      }
      this.activeSources.clear()
    } else {
      for (const src of this.activeSources) {
        try {
          src.stop(0)
          src.disconnect()
        } catch {}
      }
      this.activeSources.clear()
    }

    this.nextPlayTime = 0
    this.headerParsed = false
    this.headerBuffer = new Uint8Array(0)
    this.residualBytes = new Uint8Array(0)
    this.isFadingIn = false

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
  private startStream(url: string): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    const ac = new AbortController()
    this.abortController = ac

    const audioCtx = this.initAudioContext()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }

    fetch(url, { signal: ac.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.body) {
          throw new Error('Response body is null')
        }
        const reader = response.body.getReader()

        while (!ac.signal.aborted) {
          const { done, value } = await reader.read()
          if (done || ac.signal.aborted) {
            break
          }
          if (value && value.length > 0) {
            this.handleIncomingBytes(value)
          }
        }
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) {
          // 主动中断属正常交互行为 (切歌/寻道/暂停)
          return
        }
        console.warn('[PcmPlayer] 音频流断开或异常:', err)
        // 若仍处于播放态, 延迟 600ms 尝试自动重连 (看门狗兜底)
        if (this.isPlayingState) {
          setTimeout(() => {
            if (this.isPlayingState && this.abortController === ac) {
              this.flushAndReconnect(this.currentStreamUrl)
            }
          }, 600)
        }
      })
  }

  /**
   * 处理流式到达的二进制数据块
   */
  private handleIncomingBytes(chunk: Uint8Array): void {
    // 1. 未解析 WAV 头部时, 累积直到 44 字节
    if (!this.headerParsed) {
      const nextHeader = new Uint8Array(this.headerBuffer.length + chunk.length)
      nextHeader.set(this.headerBuffer, 0)
      nextHeader.set(chunk, this.headerBuffer.length)
      this.headerBuffer = nextHeader

      if (this.headerBuffer.length >= 44) {
        this.headerParsed = true
        // 截取第 44 字节及之后的所有裸 PCM 数据
        const pcmData = this.headerBuffer.slice(44)
        this.headerBuffer = new Uint8Array(0)
        if (pcmData.length > 0) {
          this.processPcmChunk(pcmData)
        }
      }
      return
    }

    // 2. 头部已就绪, 直接按 PCM 帧处理
    this.processPcmChunk(chunk)
  }

  /**
   * 将裸 PCM 字节转换为 Float32 并调度进入 WebAudio
   */
  private processPcmChunk(chunk: Uint8Array): void {
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

    const audioCtx = this.initAudioContext()
    const audioBuffer = audioCtx.createBuffer(2, frameCount, 44100)
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
    // 接入淡入淡出增益节点
    if (this.fadeGainNode) {
      source.connect(this.fadeGainNode)
    }

    const now = audioCtx.currentTime
    // 抖动保护基准: 35ms
    // 若调度时钟落后于当前真实时间 (初建连或系统卡顿), 强制对齐到 now + 35ms 重新连续平铺
    if (this.nextPlayTime < now + 0.015) {
      this.nextPlayTime = now + 0.035
    }

    // 若当前为切歌或寻道后的淡入阶段, 启动从 0 渐进至 1.0 的平滑淡入
    if (this.isFadingIn && this.fadeGainNode) {
      this.isFadingIn = false
      const fadeSec = Math.max(0.02, Math.min(1.0, this.fadeConfig.duration / 1000))
      const fadeInStart = this.nextPlayTime
      this.fadeGainNode.gain.cancelScheduledValues(fadeInStart)
      this.fadeGainNode.gain.setValueAtTime(0, fadeInStart)
      this.fadeGainNode.gain.linearRampToValueAtTime(1.0, fadeInStart + fadeSec)
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
