import { useState, useEffect, useRef, useMemo } from 'react'
import type { LyricLine, MpdSong, MpdStatus, PlaybackMode } from '../../types/music'
import SidebarCapsule from './components/SidebarCapsule'
import WallpaperLayer from './components/WallpaperLayer'
import StatusBar from './components/StatusBar'
import MechanicalGear from './components/MechanicalGear'
import LyricsOrbit from './components/LyricsOrbit'

const STREAM_URL = 'http://127.0.0.1:8000'

/**
 * lpip-player 主舞台应用组件
 *
 * 核心架构 (Model B):
 * - MPD 服务端负责音频流解码并推流至 :8000 (httpd vorbis 320k)
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

  // 判定 <audio> 是否需要重建 httpd 流连接
  // (pause/resume 时连接保持健康可直接续播; 仅连接损坏/流已结束/从未建立时才重建)
  const needsStreamReconnect = (audio: HTMLAudioElement): boolean =>
    !audio.src ||
    audio.src.endsWith('/') ||
    audio.ended ||
    audio.error !== null ||
    audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE

  // 确保 <audio> 处于正确播放状态: 连接健康则直接续播 (避免重复重建流引发二次全量缓冲卡顿), 异常才重建
  const ensureAudioStream = (): void => {
    const audio = audioRef.current
    if (!audio) return
    if (needsStreamReconnect(audio)) {
      audio.src = `${STREAM_URL}/?t=${Date.now()}`
    }
    if (audio.paused) {
      audio.play().catch(() => {
        // 浏览器自动播放策略拦截时静默忽略
      })
    }
  }

  // 强制刷新前端 <audio> 流连接 (切歌或寻道后清空 Chromium 预缓冲, 立即重建以缩短缓冲等待)
  const flushAudioStream = (): void => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = `${STREAM_URL}/?t=${Date.now()}`
    audio.play().catch(() => {
      // 浏览器自动播放策略拦截时静默忽略
    })
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
        // 播放中: 连接健康则续播, 异常才重建 (修复暂停后恢复播放的二次缓冲卡顿)
        ensureAudioStream()
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
    }
  }, [isMuted])

  // 播放/暂停切换
  const handlePlayPause = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      const nextState = await window.electronAPI.mpd.togglePlay()
      setIsPlaying(nextState === 'play')
      if (nextState === 'play') {
        // 恢复播放: 不强制重建流连接 (避免二次全量缓冲), 交由智能续播逻辑处理
        ensureAudioStream()
      }
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  // 下一曲
  const handleNext = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      await window.electronAPI.mpd.next()
      flushAudioStream()
    }
  }

  // 上一曲
  const handlePrev = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      await window.electronAPI.mpd.prev()
      flushAudioStream()
    }
  }

  // 进度跳转寻道
  const handleSeek = async (timeSeconds: number): Promise<void> => {
    isSeekingRef.current = true
    setCurrentTime(timeSeconds)
    if (window.electronAPI?.mpd) {
      await window.electronAPI.mpd.seek(timeSeconds)
      flushAudioStream()
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
      flushAudioStream()
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
