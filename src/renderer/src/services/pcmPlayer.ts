/**
 * PCM 音频流式播放驱动 (Model B / 方案 C)
 *
 * 核心设计与物理机制:
 * 1. 彻底废弃 HTML5 <audio> 标签黑盒预缓冲流水线 (杜绝 2.64s ~ 3.5s 强制缓冲导致的切歌/寻道滞后);
 * 2. 基于 fetch + ReadableStream 零拷贝直接拉取 MPD httpd (:8000) wave/PCM 44100:16:2 无损流;
 * 3. 极速跳过 44 字节 WAV 头部, 将 16-bit 线性 PCM 小端数据实时转换为 WebAudio Float32Array;
 * 4. 采用 AudioBufferSourceNode 极低延迟调度 (基准抖动缓冲仅 35ms, 比上一代 3500ms 降低 100 倍);
 * 5. 寻道 / 切歌时实现毫秒级排空 (flushAndReconnect), 瞬间停止旧音频源, 0ms 截断旧音, ~50ms 起播新音;
 * 6. 原生集成 GainNode (平滑音量控制与静音) 与 AnalyserNode (WebAudio FFT 频域分析, 为 M2-1 奠定底座).
 */

export class PcmPlayer {
  private audioCtx: AudioContext | null = null
  private gainNode: GainNode | null = null
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

  // WAV 头部解析缓存与尾部残余字节
  private headerParsed: boolean = false
  private headerBuffer: Uint8Array = new Uint8Array(0)
  private residualBytes: Uint8Array = new Uint8Array(0)

  // 当前连接的流 URL
  private currentStreamUrl: string = ''

  /**
   * 初始化或获取 AudioContext 及其音频图
   * 链路: AudioBufferSourceNode -> GainNode -> AnalyserNode -> destination
   */
  public initAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioCtx = new AudioContextClass({ sampleRate: 44100 })

      this.gainNode = this.audioCtx.createGain()
      this.analyserNode = this.audioCtx.createAnalyser()
      this.analyserNode.fftSize = 256
      this.analyserNode.smoothingTimeConstant = 0.8

      this.updateGain()

      // 串联音频拓扑
      this.gainNode.connect(this.analyserNode)
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
   * 核心: 寻道 / 切歌时的瞬间排空与极速重连
   * 彻底杜绝旧歌曲/旧位置音频在扬声器中滞后残留 3~4 秒
   */
  public flushAndReconnect(url: string): void {
    this.currentStreamUrl = url
    this.isPlayingState = true

    // 1. 立即中断正在接收的 HTTP fetch 流
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    // 2. 瞬间停止并断开所有已调度至 WebAudio 队列的音频源 (0ms 硬截断)
    for (const src of this.activeSources) {
      try {
        src.stop(0)
        src.disconnect()
      } catch {
        // 已结束的节点忽略异常
      }
    }
    this.activeSources.clear()

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

    // 中断 fetch, 停止所有正在发声的节点
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    for (const src of this.activeSources) {
      try {
        src.stop(0)
        src.disconnect()
      } catch {}
    }
    this.activeSources.clear()

    this.nextPlayTime = 0
    this.headerParsed = false
    this.headerBuffer = new Uint8Array(0)
    this.residualBytes = new Uint8Array(0)

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
    if (this.gainNode) {
      source.connect(this.gainNode)
    }

    const now = audioCtx.currentTime
    // 抖动保护基准: 35ms
    // 若调度时钟落后于当前真实时间 (初建连或系统卡顿), 强制对齐到 now + 35ms 重新连续平铺
    if (this.nextPlayTime < now + 0.015) {
      this.nextPlayTime = now + 0.035
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
   * 平滑更新增益 (5ms 线性微渐变, 杜绝音量瞬变产生的喀哒爆音)
   */
  private updateGain(): void {
    if (!this.gainNode || !this.audioCtx) return
    const targetGain = this.isMuted ? 0 : this.currentVolume
    this.gainNode.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.005)
  }
}

// 导出单例对象
export const pcmPlayer = new PcmPlayer()
