import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { LyricLine, MpdSong, MpdStatus, PlaybackMode } from '../../types/music'
import SidebarCapsule from './components/SidebarCapsule'
import WallpaperLayer from './components/WallpaperLayer'
import StatusBar from './components/StatusBar'
import MechanicalGear from './components/MechanicalGear'
import LyricsOrbit from './components/LyricsOrbit'
import SpectrumVisualizer from './components/SpectrumVisualizer'
import { pcmPlayer } from './services/pcmPlayer'
import {
  DEFAULT_MPD_CONFIG,
  DEFAULT_VISUALIZER_CONFIG,
  parseMpdConfig,
  parseVisualizerConfig,
  stripJsonComments,
  type VisualizerConfig
} from '../../types/config'
import { applyTypographyToDOM } from './utils/typography'

// 挂载到 window 供调试与运行时状态分析
if (typeof window !== 'undefined') {
  ;(window as unknown as { __pcmPlayer: typeof pcmPlayer }).__pcmPlayer = pcmPlayer
}

/**
 * 由 MPD 主机与流端口拼出 PCM 音频流基地址
 *
 * 为什么需要这个辅助: 用户可在设置页修改 mpd.host/streamPort, 写死地址会导致
 * 控制走了新端口、音频还连旧地址; 裸 IPv6 必须加方括号否则 URL 非法。
 */
function buildStreamUrl(host: string, streamPort: number): string {
  const trimmed = typeof host === 'string' ? host.trim() : ''
  const safeHost = trimmed.length > 0 ? trimmed : DEFAULT_MPD_CONFIG.host
  // 裸 IPv6 地址含冒号且未被方括号包裹时补上方括号
  const bracketed = safeHost.includes(':') && !safeHost.startsWith('[') ? `[${safeHost}]` : safeHost
  const safePort = Number.isFinite(streamPort)
    ? Math.max(1, Math.min(65535, Math.round(streamPort)))
    : DEFAULT_MPD_CONFIG.streamPort
  return `http://${bracketed}:${safePort}`
}

/**
 * lpip-player 主舞台应用组件
 *
 * 核心架构 (Model B / 方案 C):
 * - MPD 服务端负责音频解码并推流至 :8000 (httpd wave/PCM 44100:16:2, 无损未压缩)
 * - 前端使用自建 WebAudio PCM 流式管道 (PcmPlayer) 直接读取并输出声音，杜绝系统双声
 * - 寻道/切歌时通过 flushAndReconnect 实现毫秒级硬截断与重连，彻底消除 3~4s 延迟与旧曲残留
 * - 控制指令通过纯文本 TCP 协议经主进程 IPC 双向同步 (play/pause/next/prev/seek/vol/mode)
 * - 实时同步当前曲目元数据、封面、歌词与播放时间至 StatusBar、LyricsOrbit 与机械齿轮
 */
export default function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(248)
  const [currentSong, setCurrentSong] = useState<MpdSong | null>(null)
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null)
  const [mode, setMode] = useState<PlaybackMode>('sequence')
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig>(DEFAULT_VISUALIZER_CONFIG)
  // 歌词滚轮预览确认超时 (毫秒, 默认 1500, 经 audio.lyricPreview 热更新)
  const [lyricPreviewTimeoutMs, setLyricPreviewTimeoutMs] = useState(1500)
  // 歌词翻译显隐 (默认 true, 经 typography.lyrics.showTranslation 热更新, 缺省回退不写盘)
  const [showTranslation, setShowTranslation] = useState(true)

  const lastFileRef = useRef<string | null>(null)
  // 歌词拉取世代号 (快切 A→B→C 时旧慢响应到达即丢弃, 只认最新一次拉取)
  const lyricsSeqRef = useRef(0)
  const isSeekingRef = useRef(false)
  // 寻道锁定时器 (连击寻道时先清旧定时, 避免第一次的 800ms 回调提前解锁第二次寻道)
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // PCM 音频流基地址 (跟随配置 mpd.host/streamPort, 默认与 DEFAULT_MPD_CONFIG 一致)
  const streamUrlRef = useRef<string>(buildStreamUrl(DEFAULT_MPD_CONFIG.host, DEFAULT_MPD_CONFIG.streamPort))

  // 由配置同步流地址: 用 parseMpdConfig 规范化后更新 ref, 返回更新后的基地址
  const syncStreamUrlFromConfig = (mpd: unknown): string => {
    const parsed = parseMpdConfig(mpd ?? {})
    const next = buildStreamUrl(parsed.host, parsed.streamPort)
    streamUrlRef.current = next
    return next
  }

  // 取带防缓存时间戳的完整流地址 (每次拉流唯一, 避免 httpd 复用旧连接)
  const getStreamUrl = (): string => {
    return `${streamUrlRef.current}/?t=${Date.now()}`
  }

  // 同步 MPD 实时状态数据模型
  const syncFromMpdStatus = (status: MpdStatus): void => {
    if (status.currentSong) {
      // 引用稳定化: 若同曲未变 (file 与 id 一致), 沿用既有对象引用, 彻底阻断下游组件 (Sidebar/StatusBar/Lyrics) 无谓 re-render
      setCurrentSong((prev) => {
        if (
          prev &&
          prev.file === status.currentSong?.file &&
          prev.id === status.currentSong?.id &&
          prev.title === status.currentSong?.title &&
          prev.artist === status.currentSong?.artist &&
          prev.quality === status.currentSong?.quality &&
          prev.coverUrl === status.currentSong?.coverUrl
        ) {
          return prev
        }
        return status.currentSong
      })
      if (status.duration > 0 || status.currentSong.duration > 0) {
        setDuration(Math.round(status.duration || status.currentSong.duration))
      }

      // 切歌时重新提取歌词 (带世代守卫: 慢响应若已过时则丢弃, 避免错词钉死)
      if (status.currentSong.file !== lastFileRef.current) {
        lastFileRef.current = status.currentSong.file
        lyricsSeqRef.current += 1
        const seq = lyricsSeqRef.current
        window.electronAPI?.mpd.getLyrics(status.currentSong.file).then((lines) => {
          if (seq !== lyricsSeqRef.current) return
          setLyrics(lines && lines.length > 0 ? lines : null)
        })
      }
    } else if (status.playlistLength === 0) {
      setCurrentSong(null)
      setLyrics(null)
      setCurrentTime(0)
      setDuration(0)
      lastFileRef.current = null
    }

    if (status.mode) {
      setMode(status.mode)
    }

    const isPlay = status.state === 'play'
    setIsPlaying(isPlay)

    if (!isSeekingRef.current && status.currentTime >= 0) {
      setCurrentTime(status.currentTime)
    }

    // 方案 C: WebAudio PCM 流式管道保持出声
    if (isPlay) {
      if (!pcmPlayer.isPlaying()) {
        pcmPlayer.play(getStreamUrl())
      }
    } else if (status.state === 'pause') {
      if (pcmPlayer.isPlaying()) {
        pcmPlayer.pause()
      }
    } else if (status.state === 'stop') {
      pcmPlayer.stop()
    }
  }

  // 同步状态函数持久化引用 (供 memoized 回调消费, 避免闭包失效)
  const syncFromMpdStatusRef = useRef(syncFromMpdStatus)
  syncFromMpdStatusRef.current = syncFromMpdStatus

  // 挂载时初始化状态查询、应用全局配置与订阅 IPC 广播
  useEffect(() => {
    let isMounted = true

    // 辅助: 从配置文件直接读取 visualizer 配置 (作为主进程热更新双保险)
    const syncVisualizerFromFile = async (): Promise<void> => {
      try {
        const resp = await fetch('app-media:///home/lpipwei/.config/lpip-player/config.json', {
          cache: 'no-store'
        })
        if (!resp.ok) return
        const text = await resp.text()
        const clean = stripJsonComments(text)
        const parsed = JSON.parse(clean) as { visualizer?: unknown }
        if (isMounted && parsed.visualizer !== undefined) {
          setVisualizerConfig(parseVisualizerConfig(parsed.visualizer))
        }
      } catch {}
    }

    // 读取并应用运行时配置 (如切歌/寻道淡出淡入过渡、频谱律动配置、全局字体排印、歌词预览确认延迟)
    window.electronAPI?.config.get().then((cfg) => {
      if (!isMounted || !cfg) return
      // PCM 流地址跟随 MPD 配置 (host/streamPort), 避免改端口后音频还连旧地址
      syncStreamUrlFromConfig(cfg.mpd)
      if (cfg.typography) {
        applyTypographyToDOM(cfg.typography)
        if (typeof cfg.typography.lyrics?.showTranslation === 'boolean') {
          setShowTranslation(cfg.typography.lyrics.showTranslation)
        }
      }
      if (cfg.audio?.fade) {
        pcmPlayer.setFadeConfig(cfg.audio.fade)
      }
      if (typeof cfg.audio?.lyricPreview?.timeoutMs === 'number') {
        setLyricPreviewTimeoutMs(cfg.audio.lyricPreview.timeoutMs)
      }
      if (cfg.visualizer) {
        setVisualizerConfig(cfg.visualizer)
      } else {
        syncVisualizerFromFile()
      }
    })

    // 监听运行时配置热更新 (用户编辑 config.json 后即时生效)
    const unsubConfig = window.electronAPI?.config.onChange((cfg) => {
      if (!isMounted || !cfg) return
      // 流地址变更且正在播放时立刻跟过去; 先比对新旧地址, 避免切字体/调音量等无关变更时断流
      const prevUrl = streamUrlRef.current
      const nextUrl = syncStreamUrlFromConfig(cfg.mpd)
      if (nextUrl !== prevUrl && pcmPlayer.isPlaying()) {
        pcmPlayer.flushAndReconnect(`${nextUrl}/?t=${Date.now()}`)
      }
      if (cfg.typography) {
        applyTypographyToDOM(cfg.typography)
        if (typeof cfg.typography.lyrics?.showTranslation === 'boolean') {
          setShowTranslation(cfg.typography.lyrics.showTranslation)
        }
      }
      if (cfg.audio?.fade) {
        pcmPlayer.setFadeConfig(cfg.audio.fade)
      }
      if (typeof cfg.audio?.lyricPreview?.timeoutMs === 'number') {
        setLyricPreviewTimeoutMs(cfg.audio.lyricPreview.timeoutMs)
      }
      if (cfg.visualizer) {
        setVisualizerConfig(cfg.visualizer)
      } else {
        syncVisualizerFromFile()
      }
    })

    window.electronAPI?.mpd.getStatus().then((status) => {
      if (!isMounted || !status) return
      syncFromMpdStatus(status)
    })

    const unsubscribe = window.electronAPI?.mpd.onStatusChange((status) => {
      if (!isMounted || !status) return
      syncFromMpdStatus(status)
    })

    return () => {
      isMounted = false
      // 卸载时清理寻道锁定时器, 避免回调在组件已销毁后写 ref
      if (seekTimerRef.current !== null) {
        clearTimeout(seekTimerRef.current)
        seekTimerRef.current = null
      }
      unsubConfig?.()
      unsubscribe?.()
      pcmPlayer.stop()
    }
  }, [])

  // 播放/暂停切换
  const handlePlayPause = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      const nextState = await window.electronAPI.mpd.togglePlay()
      const isPlay = nextState === 'play'
      setIsPlaying(isPlay)
      if (isPlay) {
        pcmPlayer.resume(getStreamUrl())
      } else {
        pcmPlayer.pause()
      }
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  // 下一曲
  const handleNext = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      const ok = await window.electronAPI.mpd.next()
      if (ok) {
        // 方案 C: 毫秒级硬截断旧曲声音并立即拉取新曲，杜绝 3~4 秒旧曲残留
        pcmPlayer.flushAndReconnect(getStreamUrl())
      }
    }
  }

  // 上一曲
  const handlePrev = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      const ok = await window.electronAPI.mpd.prev()
      if (ok) {
        pcmPlayer.flushAndReconnect(getStreamUrl())
      }
    }
  }

  // 进度跳转寻道 (歌词单击确认/进度条拖动共用; 暂停态确认跳转将自动恢复播放)
  const handleSeek = async (timeSeconds: number): Promise<void> => {
    isSeekingRef.current = true
    setCurrentTime(timeSeconds)
    const wasPaused = !isPlaying
    if (window.electronAPI?.mpd) {
      const ok = await window.electronAPI.mpd.seek(timeSeconds)
      if (ok) {
        // 暂停态确认跳转: 先 resume 让 MPD 回到 play 再重建流, 只重建一次 (P1 单 flush)
        // 播放态寻道: 瞬间排空旧缓冲, ~40ms 启动新落点播放
        if (wasPaused) {
          const resumed = await window.electronAPI.mpd.resume()
          if (resumed) {
            pcmPlayer.resume(getStreamUrl())
            setIsPlaying(true)
          }
        } else {
          // 方案 C: 寻道时瞬间排空旧缓冲, ~40ms 启动新落点播放
          pcmPlayer.flushAndReconnect(getStreamUrl())
        }
      }
    }
    // 寻道锁自动释放: 连击时先清掉上一次的定时器, 否则第一次的回调会提前解锁第二次寻道
    if (seekTimerRef.current !== null) {
      clearTimeout(seekTimerRef.current)
    }
    seekTimerRef.current = setTimeout(() => {
      isSeekingRef.current = false
      seekTimerRef.current = null
    }, 800)
  }

  // 切换播放模式 (列表循环 -> 随机播放 -> 单曲循环)
  const handleModeToggle = async (): Promise<void> => {
    const order: PlaybackMode[] = ['sequence', 'shuffle', 'single']
    const nextIdx = (order.indexOf(mode) + 1) % order.length
    const nextMode = order[nextIdx]
    setMode(nextMode)
    if (window.electronAPI?.mpd) {
      await window.electronAPI.mpd.setMode(nextMode)
    }
  }



  // 处理曲库与队列单曲选择与播放 (useCallback 保持引用恒定, 阻断 SidebarCapsule 及其长列表重渲染)
  const handlePlaySong = useCallback(async (song: MpdSong): Promise<void> => {
    setCurrentSong(song)
    setIsPlaying(true)
    setCurrentTime(0)
    setDuration(Math.round(song.duration || 248))
    lastFileRef.current = song.file

    // 点播拉取歌词同样带世代守卫, 与轮询分支共用同一序号源
    lyricsSeqRef.current += 1
    const lyricsSeq = lyricsSeqRef.current
    window.electronAPI?.mpd.getLyrics(song.file).then((lines) => {
      if (lyricsSeq !== lyricsSeqRef.current) return
      setLyrics(lines && lines.length > 0 ? lines : null)
    })

    if (window.electronAPI?.mpd) {
      // 成功门控: 仅当任一起播指令真正成功才重连 PCM, 避免 MPD 离线时标题已切新歌、耳朵仍听旧流
      let succeeded = false
      try {
        if (typeof song.queueId === 'number' || typeof song.pos === 'number') {
          succeeded = await window.electronAPI.mpd.playQueueItem(song.pos ?? 0, song.queueId)
        } else {
          // 从曲库直接点播：先检查是否已在队列中，不在则精准追加后跳播该曲，避免老版本 playSong 触发全目录预载
          const queue = await window.electronAPI.mpd.getQueue()
          const existing = queue.find((item) => item.file === song.file)
          if (existing) {
            succeeded = await window.electronAPI.mpd.playQueueItem(existing.pos ?? 0, existing.queueId)
          } else {
            const addRes = await window.electronAPI.mpd.addToQueue(song.file)
            // 追加成功才继续跳播; 追加本身不算起播成功, 以后续 play 结果为准
            if (addRes.success) {
              window.dispatchEvent(new CustomEvent('lpip:queue-changed'))
              const updatedQueue = await window.electronAPI.mpd.getQueue()
              const newlyAdded = updatedQueue.find((item) => item.file === song.file)
              if (newlyAdded) {
                succeeded = await window.electronAPI.mpd.playQueueItem(newlyAdded.pos ?? 0, newlyAdded.queueId)
              } else {
                succeeded = await window.electronAPI.mpd.play(song.file)
              }
            }
          }
        }
      } catch {
        // MPD 通信异常视为整体失败, 保持 succeeded=false 走回滚分支
        succeeded = false
      }
      if (succeeded) {
        // 方案 C: 点播切歌瞬间排空旧音频, 零延迟起播新曲
        pcmPlayer.flushAndReconnect(getStreamUrl())
      } else {
        // 全部失败时回滚乐观更新, 并用真实状态重同步 (恢复旧曲显示与播放态)
        setCurrentSong(null)
        lastFileRef.current = null
        window.electronAPI.mpd.getStatus().then((status) => {
          if (status) syncFromMpdStatusRef.current(status)
        })
      }
    }
  }, [])

  // 处理添加单曲至队列 (useCallback 保持引用恒定)
  const handleAddToQueue = useCallback(async (_song: MpdSong): Promise<void> => {
    if (window.electronAPI?.mpd) {
      const status = await window.electronAPI.mpd.getStatus()
      if (status) {
        syncFromMpdStatusRef.current(status)
      }
    }
  }, [])

  // 当当前歌曲缺失歌词时，优雅展示当前歌曲信息而非无关的默认拉丁歌词
  const effectiveLyrics = useMemo(() => {
    if (lyrics && lyrics.length > 0) return lyrics
    if (currentSong) {
      return [
        {
          id: 0,
          primary: currentSong.title,
          secondary: currentSong.artist ? `${currentSong.artist} · 纯音乐 / 暂无歌词` : '纯音乐 / 暂无歌词',
          time: 0
        }
      ]
    }
    return undefined
  }, [lyrics, currentSong])

  return (
    <div className="stage">
      {/* 沉浸式无边框窗口顶部拖拽区域 (仅在无边框形态下激活，可直接按住窗口顶部空白处拖拽移动窗口) */}
      <div className="window-drag-bar" aria-hidden="true" />

      {/* 动态视频壁纸图层 (当配置视频壁纸时自动激活硬件加速播放) */}
      <WallpaperLayer />

      {/* 高级制表纯线条蓝图音频频谱律动图层 (SpectrumVisualizer, z-index: 5, 定位于状态栏上方) */}
      <SpectrumVisualizer
        isPlaying={isPlaying}
        config={visualizerConfig}
      />

      {/* 右侧精密机械表齿轮 (直径 500px，圆心距右边框 30px，外露 280px，垂直居中) */}
      <MechanicalGear />

      {/* 极坐标星盘歌词轨道 (中央主工作区，支持加载当前歌曲真实 LRC 歌词) */}
      <LyricsOrbit
        currentTime={currentTime}
        lyrics={effectiveLyrics}
        onSeek={handleSeek}
        isPlaying={isPlaying}
        showTranslation={showTranslation}
        previewTimeoutMs={lyricPreviewTimeoutMs}
      />

      {/* 悬浮长条形胶囊伸缩抽屉 (曲库中心与播放队列管理抽屉) */}
      <SidebarCapsule
        currentSong={currentSong}
        currentSongId={currentSong?.id}
        onPlaySong={handlePlaySong}
        onAddToQueue={handleAddToQueue}
      />

      {/* 窗口底部磨砂状态栏 (80px 纯净骨架与控制组) */}
      <StatusBar
        coverUrl={currentSong?.coverUrl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        currentSong={currentSong}
        mode={mode}
        onPrev={handlePrev}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onSeek={handleSeek}
        onModeToggle={handleModeToggle}
      />
    </div>
  )
}
