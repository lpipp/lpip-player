import { useState, useEffect, useRef, useMemo } from 'react'
import type { LyricLine, MpdSong, MpdStatus, PlaybackMode } from '../../types/music'
import SidebarCapsule from './components/SidebarCapsule'
import WallpaperLayer from './components/WallpaperLayer'
import StatusBar from './components/StatusBar'
import MechanicalGear from './components/MechanicalGear'
import LyricsOrbit from './components/LyricsOrbit'
import SpectrumVisualizer from './components/SpectrumVisualizer'
import { pcmPlayer } from './services/pcmPlayer'
import {
  DEFAULT_VISUALIZER_CONFIG,
  parseVisualizerConfig,
  stripJsonComments,
  type VisualizerConfig
} from '../../types/config'

// 挂载到 window 供调试与运行时状态分析
if (typeof window !== 'undefined') {
  ;(window as unknown as { __pcmPlayer: typeof pcmPlayer }).__pcmPlayer = pcmPlayer
}

const STREAM_URL = 'http://127.0.0.1:8000'

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
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig>(DEFAULT_VISUALIZER_CONFIG)

  const lastFileRef = useRef<string | null>(null)
  const isSeekingRef = useRef(false)
  const isVolDraggingRef = useRef(false)

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

    if (!isVolDraggingRef.current && typeof status.volume === 'number' && status.volume >= 0) {
      setVolume(status.volume)
      pcmPlayer.setVolume(status.volume / 100)
    }

    const isPlay = status.state === 'play'
    setIsPlaying(isPlay)

    if (!isSeekingRef.current && status.currentTime >= 0) {
      setCurrentTime(status.currentTime)
    }

    // 方案 C: WebAudio PCM 流式管道保持出声
    if (isPlay) {
      if (!pcmPlayer.isPlaying()) {
        pcmPlayer.play(`${STREAM_URL}/?t=${Date.now()}`)
      }
    } else if (status.state === 'pause') {
      if (pcmPlayer.isPlaying()) {
        pcmPlayer.pause()
      }
    } else if (status.state === 'stop') {
      pcmPlayer.stop()
    }
  }

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

    // 读取并应用运行时配置 (如切歌/寻道淡出淡入过渡、频谱律动配置)
    window.electronAPI?.config.get().then((cfg) => {
      if (!isMounted || !cfg) return
      if (cfg.audio?.fade) {
        pcmPlayer.setFadeConfig(cfg.audio.fade)
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
      if (cfg.audio?.fade) {
        pcmPlayer.setFadeConfig(cfg.audio.fade)
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
        pcmPlayer.resume(`${STREAM_URL}/?t=${Date.now()}`)
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
        pcmPlayer.flushAndReconnect(`${STREAM_URL}/?t=${Date.now()}`)
      }
    }
  }

  // 上一曲
  const handlePrev = async (): Promise<void> => {
    if (window.electronAPI?.mpd) {
      const ok = await window.electronAPI.mpd.prev()
      if (ok) {
        pcmPlayer.flushAndReconnect(`${STREAM_URL}/?t=${Date.now()}`)
      }
    }
  }

  // 进度跳转寻道
  const handleSeek = async (timeSeconds: number): Promise<void> => {
    isSeekingRef.current = true
    setCurrentTime(timeSeconds)
    if (window.electronAPI?.mpd) {
      const ok = await window.electronAPI.mpd.seek(timeSeconds)
      if (ok) {
        // 方案 C: 寻道时瞬间排空旧缓冲, ~40ms 启动新落点播放
        pcmPlayer.flushAndReconnect(`${STREAM_URL}/?t=${Date.now()}`)
      }
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
      pcmPlayer.setMuted(false)
    }

    pcmPlayer.setVolume(clamped / 100)

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
    pcmPlayer.setMuted(nextMuted)
  }

  // 处理曲库与队列单曲选择与播放
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
      if (typeof song.queueId === 'number' || typeof song.pos === 'number') {
        await window.electronAPI.mpd.playQueueItem(song.pos ?? 0, song.queueId)
      } else {
        // 从曲库直接点播：先检查是否已在队列中，不在则精准追加后跳播该曲，避免老版本 playSong 触发全目录预载
        const queue = await window.electronAPI.mpd.getQueue()
        const existing = queue.find((item) => item.file === song.file)
        if (existing) {
          await window.electronAPI.mpd.playQueueItem(existing.pos ?? 0, existing.queueId)
        } else {
          await window.electronAPI.mpd.addToQueue(song.file)
          const updatedQueue = await window.electronAPI.mpd.getQueue()
          const newlyAdded = updatedQueue.find((item) => item.file === song.file)
          if (newlyAdded) {
            await window.electronAPI.mpd.playQueueItem(newlyAdded.pos ?? 0, newlyAdded.queueId)
          } else {
            await window.electronAPI.mpd.play(song.file)
          }
        }
      }
      // 方案 C: 点播切歌瞬间排空旧音频, 零延迟起播新曲
      pcmPlayer.flushAndReconnect(`${STREAM_URL}/?t=${Date.now()}`)
    }
  }

  // 处理添加单曲至队列
  const handleAddToQueue = async (_song: MpdSong): Promise<void> => {
    if (window.electronAPI?.mpd) {
      const status = await window.electronAPI.mpd.getStatus()
      if (status) {
        syncFromMpdStatus(status)
      }
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
