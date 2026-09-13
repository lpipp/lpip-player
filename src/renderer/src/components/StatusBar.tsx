import { useState, useRef, useEffect, useCallback } from 'react'
import type { MpdSong, PlaybackMode } from '../../../types/music'
import './StatusBar.css'

/**
 * 格式化时间为 mm:ss 或 hh:mm:ss 格式
 * @param seconds 总秒数
 */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00'
  }
  const totalSecs = Math.floor(seconds)
  const hrs = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60

  const paddedMins = String(mins).padStart(2, '0')
  const paddedSecs = String(secs).padStart(2, '0')

  if (hrs > 0) {
    const paddedHrs = String(hrs).padStart(2, '0')
    return `${paddedHrs}:${paddedMins}:${paddedSecs}`
  }
  return `${paddedMins}:${paddedSecs}`
}

function ModeSequenceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function ModeShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
}

function ModeSingleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      <text x="12" y="15" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold" textAnchor="middle">1</text>
    </svg>
  )
}

function VolumeMuteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.2" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

function VolumeLowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.2" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function VolumeHighIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.2" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

/**
 * 底部状态栏组件属性定义
 */
export interface StatusBarProps {
  /** 专辑封面本地或网络图片 URL */
  coverUrl?: string | null
  /** 是否正在播放状态 */
  isPlaying?: boolean
  /** 当前播放时间 (秒) */
  currentTime?: number
  /** 音频总时长 (秒) */
  duration?: number
  /** 当前播放曲目元数据 */
  currentSong?: MpdSong | null
  /** 当前播放模式 */
  mode?: PlaybackMode
  /** 当前音量 (0 ~ 100) */
  volume?: number
  /** 是否静音 */
  isMuted?: boolean
  /** 上一曲点击回调 */
  onPrev?: () => void
  /** 播放/暂停点击回调 */
  onPlayPause?: () => void
  /** 下一曲点击回调 */
  onNext?: () => void
  /** 进度跳转/拖拽回调 (参数为目标秒数) */
  onSeek?: (timeSeconds: number) => void
  /** 播放模式切换回调 */
  onModeToggle?: () => void
  /** 音量调节回调 (0 ~ 100) */
  onVolumeChange?: (volume: number) => void
  /** 静音切换回调 */
  onMuteToggle?: () => void
}

/**
 * 窗口底部磨砂状态栏组件 (StatusBar)
 */
export default function StatusBar({
  coverUrl,
  isPlaying: controlledIsPlaying,
  currentTime: controlledCurrentTime,
  duration: controlledDuration,
  currentSong,
  mode = 'sequence',
  volume = 100,
  isMuted = false,
  onPrev,
  onPlayPause,
  onNext,
  onSeek,
  onModeToggle,
  onVolumeChange,
  onMuteToggle
}: StatusBarProps) {
  const [imgError, setImgError] = useState(false)

  // 当外部传入的封面 URL 发生变化时重置错误标记
  useEffect(() => {
    setImgError(false)
  }, [coverUrl])

  const [localIsPlaying, setLocalIsPlaying] = useState(false)
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPercent, setDragPercent] = useState(0)

  // 音量滑动拖拽状态
  const [isVolDragging, setIsVolDragging] = useState(false)
  const [dragVolPercent, setDragVolPercent] = useState(volume / 100)
  // 音量节流句柄 (move 只刷本地 thumb, 16ms 节流后才推 onVolumeChange; mouseup 保底终值)
  const volThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingVolRef = useRef<number | null>(null)

  // 组件卸载时清理音量节流定时器
  useEffect(() => {
    return () => {
      if (volThrottleRef.current) clearTimeout(volThrottleRef.current)
    }
  }, [])

  const trackRef = useRef<HTMLDivElement>(null)
  const volTrackRef = useRef<HTMLDivElement>(null)

  const isPlaying = controlledIsPlaying !== undefined ? controlledIsPlaying : localIsPlaying
  const rawDuration = controlledDuration !== undefined ? controlledDuration : 248
  const duration = Math.max(0, rawDuration)
  const safeDuration = duration > 0 ? duration : 1

  // 当前有效播放秒数 (拖拽中以拖拽位置为准，否则以播放进度为准)
  const currentSeconds = isDragging
    ? dragPercent * duration
    : controlledCurrentTime !== undefined
      ? controlledCurrentTime
      : localCurrentTime

  // 进度百分比 (0 ~ 100)
  const effectivePercent = duration > 0 ? Math.min(100, Math.max(0, (currentSeconds / safeDuration) * 100)) : 0

  // 音量有效百分比 (0 ~ 100)
  const effectiveVolPercent = isMuted
    ? 0
    : isVolDragging
      ? Math.round(dragVolPercent * 100)
      : volume

  // 播放中且未受控时，开启 1 秒自增定时器
  useEffect(() => {
    if (controlledCurrentTime !== undefined || !isPlaying || isDragging) return
    const timer = setInterval(() => {
      setLocalCurrentTime((prev) => {
        const next = prev + 1
        return next > duration ? 0 : next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [controlledCurrentTime, isPlaying, isDragging, duration])

  const handlePlayToggle = () => {
    if (controlledIsPlaying === undefined) {
      setLocalIsPlaying(!localIsPlaying)
    }
    onPlayPause?.()
  }

  // 根据鼠标位置计算播放滑轨百分比 (0 ~ 1)
  const calcPercentFromEvent = useCallback((e: MouseEvent | React.MouseEvent): number => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const offsetX = e.clientX - rect.left
    return Math.max(0, Math.min(1, offsetX / rect.width))
  }, [])

  // 播放进度拖拽/点击
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()

    const initialPercent = calcPercentFromEvent(e)
    setIsDragging(true)
    setDragPercent(initialPercent)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const p = calcPercentFromEvent(moveEvent)
      setDragPercent(p)
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      setIsDragging(false)

      const finalPercent = calcPercentFromEvent(upEvent)
      // 保留浮点秒目标: 精确落在对应歌词行起点, 整秒截断会导致实际位置退回上一句歌词
      const targetTime = finalPercent * duration
      if (controlledCurrentTime === undefined) {
        setLocalCurrentTime(targetTime)
      }
      onSeek?.(targetTime)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // 计算音量滑轨百分比 (0 ~ 1)
  const calcVolPercentFromEvent = useCallback((e: MouseEvent | React.MouseEvent): number => {
    if (!volTrackRef.current) return 0
    const rect = volTrackRef.current.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const offsetX = e.clientX - rect.left
    return Math.max(0, Math.min(1, offsetX / rect.width))
  }, [])

  // 音量滑块按下与拖拽 (move 只刷本地 thumb, 16ms 节流推 MPD, mouseup 保底终值不断流)
  const handleVolMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()

    const initialP = calcVolPercentFromEvent(e)
    setIsVolDragging(true)
    setDragVolPercent(initialP)
    onVolumeChange?.(Math.round(initialP * 100))

    const flushPendingVol = (): void => {
      volThrottleRef.current = null
      if (pendingVolRef.current === null) return
      const p = pendingVolRef.current
      pendingVolRef.current = null
      onVolumeChange?.(Math.round(p * 100))
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const p = calcVolPercentFromEvent(moveEvent)
      setDragVolPercent(p)
      // 节流: 首次 move 立刻排一次 16ms, 窗口内后续 move 只更新 pending, 不堆定时器
      pendingVolRef.current = p
      if (!volThrottleRef.current) {
        volThrottleRef.current = setTimeout(flushPendingVol, 16)
      }
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      setIsVolDragging(false)
      if (volThrottleRef.current) {
        clearTimeout(volThrottleRef.current)
        volThrottleRef.current = null
      }
      pendingVolRef.current = null
      const finalP = calcVolPercentFromEvent(upEvent)
      setDragVolPercent(finalP)
      onVolumeChange?.(Math.round(finalP * 100))
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // 模式文本说明
  const modeTitle =
    mode === 'single'
      ? '单曲循环 (点击切换)'
      : mode === 'shuffle'
        ? '随机播放 (点击切换)'
        : '列表循环 (点击切换)'

  return (
    <footer className="status-bar" aria-label="底部状态栏">
      {/* 封面框: 位于悬浮胶囊正下方，56px × 56px 圆角正方形 */}
      <div className="status-bar-cover">
        {coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={currentSong ? currentSong.title : '专辑封面'}
            className="status-bar-cover-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="status-bar-cover-placeholder" aria-label="封面占位符">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="status-bar-cover-icon"
            >
              <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.45" />
              <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="2 2" />
              <circle cx="16" cy="16" r="6.8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
              <circle cx="16" cy="16" r="4" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
              <circle cx="16" cy="16" r="1.6" fill="#6ee7b7" />
            </svg>
          </div>
        )}
      </div>

      {/* 播放控制按键组: 位于封面框右侧 30px 处 */}
      <div className="status-bar-controls" aria-label="播放控制">
        {/* 上一曲按键 */}
        <button
          type="button"
          className="status-bar-btn status-bar-btn-prev"
          title="上一曲"
          aria-label="上一曲"
          onClick={onPrev}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6 5h2v14H6V5zm12 1.5L9.5 12l8.5 5.5v-11z" />
          </svg>
        </button>

        {/* 播放/暂停按键: 50px × 50px */}
        <button
          type="button"
          className={`status-bar-btn status-bar-btn-play ${isPlaying ? 'is-playing' : ''}`}
          title={isPlaying ? '暂停' : '播放'}
          aria-label={isPlaying ? '暂停' : '播放'}
          onClick={handlePlayToggle}
        >
          {isPlaying ? (
            <svg
              viewBox="0 0 24 24"
              width="25"
              height="25"
              fill="currentColor"
              className="status-bar-icon-pause"
            >
              <path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="25"
              height="25"
              fill="currentColor"
              className="status-bar-icon-play"
            >
              <path d="M8 5.14v13.72a1 1 0 001.52.86l11.08-6.86a1 1 0 000-1.72L9.52 4.28A1 1 0 008 5.14z" />
            </svg>
          )}
        </button>

        {/* 下一曲按键 */}
        <button
          type="button"
          className="status-bar-btn status-bar-btn-next"
          title="下一曲"
          aria-label="下一曲"
          onClick={onNext}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6 6.5L14.5 12 6 17.5v-11zm10-1.5h2v14h-2V5z" />
          </svg>
        </button>
      </div>

      {/* 音频播放进度条: 左侧当前时间、居中液态玻璃滑轨、右侧总时长 */}
      <div className="status-bar-progress-section" aria-label="播放进度">
        <span className="status-bar-time status-bar-time-current" aria-label="当前时间">
          {formatTime(currentSeconds)}
        </span>

        <div
          ref={trackRef}
          className={`status-bar-progress-track ${isDragging ? 'is-dragging' : ''}`}
          onMouseDown={handleProgressMouseDown}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={Math.round(currentSeconds)}
          aria-valuetext={`${formatTime(currentSeconds)} / ${formatTime(duration)}`}
          tabIndex={0}
        >
          <div className="status-bar-progress-rail">
            <div
              className="status-bar-progress-fill"
              style={{ width: `${effectivePercent}%` }}
            />
            <div
              className="status-bar-progress-thumb"
              style={{ left: `${effectivePercent}%` }}
            />
          </div>
        </div>

        <span className="status-bar-time status-bar-time-duration" aria-label="总时长">
          {formatTime(duration)}
        </span>
      </div>

      {/* 右侧扩展区: 歌曲元数据展示、播放模式切换、音量滑块控制 */}
      <div className="status-bar-right-section" aria-label="播放辅助控制">
        {/* 当前曲目元数据卡片 */}
        <div
          className="status-bar-meta-block"
          title={
            currentSong
              ? `${currentSong.title} - ${currentSong.artist}${currentSong.album ? ` (${currentSong.album})` : ''}`
              : 'lpip-player'
          }
        >
          <div className="status-bar-meta-title">
            {currentSong?.title || 'lpip-player'}
          </div>
          <div className="status-bar-meta-sub">
            {currentSong && (() => {
              // 音质徽标兜底: 未知 quality 统一落 STD 灰徽标, 拒绝裸 badge-undefined
              const rawQuality = currentSong.quality ?? 'STD'
              const normalized = String(rawQuality).toLowerCase()
              const known = normalized === 'sq' || normalized === 'hi-res' || normalized === 'hq' || normalized === 'std'
                ? normalized
                : 'std'
              const label = known === 'std' && normalized !== 'std' ? 'STD' : String(rawQuality)
              return (
                <span className={`status-bar-quality-badge badge-${known}`}>
                  {label}
                </span>
              )
            })()}
            <span className="status-bar-meta-artist">
              {currentSong?.artist || '本地音乐播放器'}
            </span>
          </div>
        </div>

        {/* 播放模式切换按键 (列表循环 / 随机播放 / 单曲循环) */}
        <button
          type="button"
          className={`status-bar-btn status-bar-btn-mode mode-${mode}`}
          title={modeTitle}
          aria-label={modeTitle}
          onClick={onModeToggle}
        >
          {mode === 'single' ? (
            <ModeSingleIcon />
          ) : mode === 'shuffle' ? (
            <ModeShuffleIcon />
          ) : (
            <ModeSequenceIcon />
          )}
        </button>

        {/* 音量控制组 (静音按键 + 液态滑动条) */}
        <div className="status-bar-volume-block" aria-label="音量调节">
          <button
            type="button"
            className="status-bar-btn status-bar-btn-volume"
            title={isMuted || effectiveVolPercent === 0 ? '解除静音' : '静音'}
            aria-label={isMuted || effectiveVolPercent === 0 ? '解除静音' : '静音'}
            onClick={onMuteToggle}
          >
            {isMuted || effectiveVolPercent === 0 ? (
              <VolumeMuteIcon />
            ) : effectiveVolPercent < 50 ? (
              <VolumeLowIcon />
            ) : (
              <VolumeHighIcon />
            )}
          </button>

          <div
            ref={volTrackRef}
            className={`status-bar-volume-slider ${isVolDragging ? 'is-dragging' : ''}`}
            onMouseDown={handleVolMouseDown}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={effectiveVolPercent}
            aria-label={`音量 ${effectiveVolPercent}%`}
            tabIndex={0}
          >
            <div className="status-bar-volume-rail">
              <div
                className="status-bar-volume-fill"
                style={{ width: `${effectiveVolPercent}%` }}
              />
              <div
                className="status-bar-volume-thumb"
                style={{ left: `${effectiveVolPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
