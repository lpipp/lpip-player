import { useState, useEffect, useRef, useMemo } from 'react'
import type { LyricLine, MpdSong, MpdStatus, PlaybackMode } from '../../types/music'
import SidebarCapsule from './components/SidebarCapsule'
import WallpaperLayer from './components/WallpaperLayer'
import StatusBar from './components/StatusBar'
import MechanicalGear from './components/MechanicalGear'
import LyricsOrbit from './components/LyricsOrbit'

const STREAM_URL = 'http://127.0.0.1:8000'

/**
 * 断供看门狗延时 (毫秒)
 *
 * 为什么需要: MPD 的 connection_timeout 为 60s, 长时间暂停后服务端可能已单方面丢弃 httpd 客户端,
 * 而此时 <audio> 的 error/networkState 仍可能显示正常 (检测不到断供), 会永久卡死在静音。
 * 故延时回查缓冲末端是否增长, 确认断供才回退重建。
 *
 * 为什么取 1500ms 而非更短: 重建连接代价极高 (实测 2110ms 静音), 宁可兜底晚一点,
 * 也绝不能误判一条健康连接而触发重建 —— 那正是原先卡顿的根源。
 */
const STREAM_STALL_WATCHDOG_MS = 1500

/**
 * lpip-player 主舞台应用组件
 *
 * 核心架构 (Model B):
 * - MPD 服务端负责音频解码并推流至 :8000 (httpd wave/PCM 44100:16:2, 无损未压缩)
 * - 前端使用 HTML5 <audio> 实时拉取 httpd 流输出声音，杜绝系统双声
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
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastFileRef = useRef<string | null>(null)
  const isSeekingRef = useRef(false)
  const isVolDraggingRef = useRef(false)
  // 断供看门狗定时器句柄 (仅用于服务端断供时回退重建流连接)
  const stallWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 判定 <audio> 是否需要重建 httpd 流连接
  // (仅连接从未建立/已损坏/流已结束时才重建; pause/resume 与寻道一律不重建)
  const needsStreamReconnect = (audio: HTMLAudioElement): boolean =>
    !audio.src ||
    audio.src.endsWith('/') ||
    audio.ended ||
    audio.error !== null ||
    audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE

  // 重建 httpd 流连接 (仅在连接真正损坏/断供时使用; 代价高昂: 实测需 2110ms 才稳定出声)
  const rebuildAudioStream = (): void => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = `${STREAM_URL}/?t=${Date.now()}`
    audio.play().catch(() => {
      // 浏览器自动播放策略拦截时静默忽略
    })
  }

  /**
   * 确保 <audio> 处于出声状态 —— 寻道/切歌/恢复播放后的唯一动作
   *
   * 【为什么什么都不做才是对的】(经实测反复验证的核心结论)
   *
   * MPD httpd 输出本质是「一条连续不断的实时直播流」: 前端 <audio> 的时间轴与歌曲进度
   * 完全解耦 (实测 currentTime 可达 4006s, 即连播一小时)。此前两代实现都在此处过度干预:
   *
   *   1. 换 src 重建连接 (flushAudioStream): httpd 严格按真实速率喂数据、无初始 burst,
   *      Chromium 只能按「真实时间」重新攒起播缓冲 → 实测 2110ms 静音 + 反复 stalled;
   *   2. 改写 currentTime 追边 (catchUpToLiveEdge): 虽然 <audio> 的 playing 事件很快回来
   *      (故当时误判为已修复), 但强制 seek 会令 Chromium 丢弃解码管线内已就绪的样本,
   *      用户耳朵仍听得到断续 —— <audio> 事件状态不等于扬声器真的出声。
   *
   * 实测对照 (以 currentTime 是否匀速前进为准, 这才是真实听感指标):
   *   - 改写 currentTime 追边: 真实静音 0.23s, 出现停滞样本;
   *   - 完全不触碰 <audio>:    真实静音 0s,    零停滞样本。
   *
   * 因此寻道/切歌只需把命令交给 MPD (它会改变往同一条流里推送的内容),
   * 前端唯一该做的就是「保证在播」, 绝不触碰 src 与 currentTime。
   */
  const ensurePlaying = (): void => {
    const audio = audioRef.current
    if (!audio) return

    // 连接从未建立或已损坏: 此时别无选择, 只能重建
    if (needsStreamReconnect(audio)) {
      rebuildAudioStream()
      return
    }

    // 连接健康: 仅在暂停时恢复播放, 不碰 src, 不碰 currentTime
    if (audio.paused) {
      audio.play().catch(() => {
        // 浏览器自动播放策略拦截时静默忽略
      })
    }
  }

  /**
   * 断供看门狗兜底
   *
   * 为什么需要: MPD connection_timeout 为 60s, 长时间暂停后服务端可能已单方面丢弃 httpd 客户端,
   * 而此时 <audio> 的 error/networkState 仍可能显示正常 (检测不到断供), 会永久卡死静音。
   * 故延时回查缓冲末端是否增长, 确认断供才重建 —— 这是「暂停后恢复延迟不固定」的兜底。
   *
   * 阈值取 1500ms 而非更短: 宁可晚一点兜底, 也不能误判健康连接而触发昂贵的重建。
   */
  const ensurePlayingWithWatchdog = (): void => {
    const audio = audioRef.current
    if (!audio) return

    const edgeBefore = audio.buffered.length > 0 ? audio.buffered.end(audio.buffered.length - 1) : -1
    ensurePlaying()

    if (stallWatchdogRef.current !== null) {
      clearTimeout(stallWatchdogRef.current)
    }
    stallWatchdogRef.current = setTimeout(() => {
      stallWatchdogRef.current = null
      const a = audioRef.current
      if (!a || a.paused) return
      const edgeAfter = a.buffered.length > 0 ? a.buffered.end(a.buffered.length - 1) : -1
      // 缓冲末端毫无增长「且」仍拿不到可播数据 → 判定服务端确已断供, 才重建
      if (edgeAfter <= edgeBefore && a.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        rebuildAudioStream()
      }
    }, STREAM_STALL_WATCHDOG_MS)
  }

  // 同步 MPD 实时状态数据模型
  const syncFromMpdStatus = (status: MpdStatus): void => {
    if (status.currentSong) {
      setCurrentSong(status.currentSong)
      if (status.duration > 0 || status.currentSong.duration > 0) {
        setDuration(Math.round(status.duration || status.currentSong.duration))
      }

      // 切歌时重新提取歌词
      if (status.currentSong.file !== lastFileRef.current) {
        lastFileRef.current = status.currentSong.file
        window.electronAPI?.mpd.getLyrics(status.currentSong.file).then((lines) => {
          setLyrics(lines && lines.length > 0 ? lines : null)
        })
      }
    }

    if (status.mode) {
      setMode(status.mode)
    }

    if (!isVolDraggingRef.current && typeof status.volume === 'number' && status.volume >= 0) {
      setVolume(status.volume)
      if (audioRef.current && !isMuted) {
        audioRef.current.volume = status.volume / 100
      }
    }

    const isPlay = status.state === 'play'
    setIsPlaying(isPlay)

    if (!isSeekingRef.current && status.currentTime >= 0) {
      setCurrentTime(status.currentTime)
    }

    // 控制底层 HTML5 <audio> 流播放 (Model B: 前端出声)
    if (audioRef.current) {
      const audio = audioRef.current
      if (isPlay) {
        // 播放中: 此处为 500ms 轮询路径, 只做最轻量的「保持出声」
        // 切忌在此改写 currentTime —— 每 500ms 干预一次会不断打断解码管线造成持续断续
        if (needsStreamReconnect(audio)) {
          rebuildAudioStream()
        } else if (audio.paused) {
          audio.play().catch(() => {
            // 浏览器自动播放策略拦截时静默忽略
          })
        }
      } else if (status.state === 'pause') {
        if (!audio.paused) {
          audio.pause()
        }
      } else if (status.state === 'stop') {
        audio.pause()
        audio.removeAttribute('src')
      }
    }
  }

  // 挂载时初始化状态查询与订阅 IPC 状态广播
  useEffect(() => {
    let isMounted = true

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
      unsubscribe?.()
      // 卸载时清理断供看门狗, 防止组件销毁后仍触发一次无谓的流重建
      if (stallWatchdogRef.current !== null) {
        clearTimeout(stallWatchdogRef.current)
        stallWatchdogRef.current = null
      }
    }
  }, [isMuted])

  // 播放/暂停切换
  const handlePlayPause = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      const nextState = await window.electronAPI.mpd.togglePlay()
      setIsPlaying(nextState === 'play')
      if (nextState === 'play') {
        // 恢复播放: 只调用 play() 让解码管线从原地继续, 不碰 src / currentTime,
        // 由 MPD 决定往流里推什么; 看门狗仅兜底服务端已断供的情形
        ensurePlayingWithWatchdog()
      }
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  // 下一曲
  const handleNext = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      await window.electronAPI.mpd.next()
      // 切歌: MPD 改推新曲内容至同一条流, 前端只需保证在播, 不触碰 src / currentTime
      ensurePlayingWithWatchdog()
    }
  }

  // 上一曲
  const handlePrev = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      await window.electronAPI.mpd.prev()
      ensurePlayingWithWatchdog()
    }
  }

  // 进度跳转寻道
  const handleSeek = async (timeSeconds: number): Promise<void> => {
    isSeekingRef.current = true
    setCurrentTime(timeSeconds)
    if (window.electronAPI?.mpd) {
      await window.electronAPI.mpd.seek(timeSeconds)
      // 寻道: seekcur 只改变 MPD 往同一条流里推送的内容, 前端绝不触碰 src / currentTime
      // (实测: 不碰 <audio> 真实静音 0s; 一旦改写 currentTime 就会听到断续)
      ensurePlayingWithWatchdog()
    }
    setTimeout(() => {
      isSeekingRef.current = false
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

  // 调节音量 (0 ~ 100)
  const handleVolumeChange = (vol: number): void => {
    isVolDraggingRef.current = true
    const clamped = Math.max(0, Math.min(100, Math.round(vol)))
    setVolume(clamped)

    if (isMuted && clamped > 0) {
      setIsMuted(false)
      if (audioRef.current) audioRef.current.muted = false
    }

    if (audioRef.current) {
      audioRef.current.volume = clamped / 100
    }

    if (window.electronAPI?.mpd) {
      window.electronAPI.mpd.setVolume(clamped)
    }

    setTimeout(() => {
      isVolDraggingRef.current = false
    }, 500)
  }

  // 切换静音
  const handleMuteToggle = (): void => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (audioRef.current) {
      audioRef.current.muted = nextMuted
    }
  }

  // 处理曲库单曲选择与播放
  const handlePlaySong = async (song: MpdSong): Promise<void> => {
    setCurrentSong(song)
    setIsPlaying(true)
    setCurrentTime(0)
    setDuration(Math.round(song.duration || 248))
    lastFileRef.current = song.file

    window.electronAPI?.mpd.getLyrics(song.file).then((lines) => {
      setLyrics(lines && lines.length > 0 ? lines : null)
    })

    if (window.electronAPI?.mpd) {
      await window.electronAPI.mpd.play(song.file)
      // 曲库点播: clear + add + play 后 MPD 推送新曲内容至同一条流, 前端只需保证在播
      ensurePlayingWithWatchdog()
    }
  }

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
      {/* 底层音频流播放核心 (Model B: 从 MPD 8000 端口拉取流并由 Electron 前端扬声器输出) */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="none"
        style={{ display: 'none' }}
      />

      {/* 动态视频壁纸图层 (当配置视频壁纸时自动激活硬件加速播放) */}
      <WallpaperLayer />

      {/* 右侧精密机械表齿轮 (直径 500px，圆心距右边框 30px，外露 280px，垂直居中) */}
      <MechanicalGear />

      {/* 极坐标星盘歌词轨道 (中央主工作区，支持加载当前歌曲真实 LRC 歌词) */}
      <LyricsOrbit
        currentTime={currentTime}
        lyrics={effectiveLyrics}
        onSeek={handleSeek}
      />

      {/* 悬浮长条形胶囊伸缩抽屉 (曲库中心子菜单展示所有 MPD 音源) */}
      <SidebarCapsule
        currentSongId={currentSong?.id}
        onPlaySong={handlePlaySong}
      />

      {/* 窗口底部磨砂状态栏 (80px 纯净骨架与控制组) */}
      <StatusBar
        coverUrl={currentSong?.coverUrl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        currentSong={currentSong}
        mode={mode}
        volume={volume}
        isMuted={isMuted}
        onPrev={handlePrev}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onSeek={handleSeek}
        onModeToggle={handleModeToggle}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
      />
    </div>
  )
}
