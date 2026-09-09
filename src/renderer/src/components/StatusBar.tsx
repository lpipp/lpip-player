import { useState, useRef, useEffect, useCallback } from 'react'
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

/**
 * 底部状态栏组件属性定义
 */
export interface StatusBarProps {
  /** 专辑封面本地或网络图片 URL (预留 M1/M2 接入曲目元数据) */
  coverUrl?: string | null
  /** 是否正在播放状态 (受控模式预留) */
  isPlaying?: boolean
  /** 当前播放时间 (秒) */
  currentTime?: number
  /** 音频总时长 (秒) */
  duration?: number
  /** 上一曲点击回调 */
  onPrev?: () => void
  /** 播放/暂停点击回调 */
  onPlayPause?: () => void
  /** 下一曲点击回调 */
  onNext?: () => void
  /** 进度跳转/拖拽回调 (参数为目标秒数) */
  onSeek?: (timeSeconds: number) => void
}

/**
 * 窗口底部磨砂状态栏组件 (StatusBar)
 *
 * 职责:
 * - 位于窗口最底部，固定高度 80px (由 --statusbar-height 全局变量驱动)
 * - 位于悬浮胶囊正下方绘制 56px × 56px 圆角正方形封面框，横向像素与胶囊导轨严格对齐
 * - 在封面右侧 30px 处布局上一曲、播放（暂停时为正圆形，播放时为动态液态流动）、下一曲交互控制组
 * - 在控制组右侧布局液态玻璃播放进度条（左侧当前时间、中间微光滑轨与液态手柄、右侧总时长）
 */
export default function StatusBar({
  coverUrl,
  isPlaying: controlledIsPlaying,
  currentTime: controlledCurrentTime,
  duration: controlledDuration,
  onPrev,
  onPlayPause,
  onNext,
  onSeek
}: StatusBarProps) {
  const [imgError, setImgError] = useState(false)
  const [localIsPlaying, setLocalIsPlaying] = useState(false)
  // 本地进度状态 (默认 74s / 01:14，总长 248s / 04:08 作为生动演示)
  const [localCurrentTime, setLocalCurrentTime] = useState(74)
  // 拖拽手柄交互状态
  const [isDragging, setIsDragging] = useState(false)
  const [dragPercent, setDragPercent] = useState(0)

  const trackRef = useRef<HTMLDivElement>(null)

  const isPlaying = controlledIsPlaying !== undefined ? controlledIsPlaying : localIsPlaying
  const duration = controlledDuration !== undefined ? Math.max(1, controlledDuration) : 248

  // 当前有效播放秒数 (拖拽中以拖拽位置为准，否则以播放进度为准)
  const currentSeconds = isDragging
    ? dragPercent * duration
    : controlledCurrentTime !== undefined
      ? controlledCurrentTime
      : localCurrentTime

  // 进度百分比 (0 ~ 100)
  const effectivePercent = Math.min(100, Math.max(0, (currentSeconds / duration) * 100))

  // 播放中且未受控时，开启 1 秒自增定时器，提供鲜活的真实播放交互体验
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

  // 根据鼠标位置计算滑轨百分比 (0 ~ 1)
  const calcPercentFromEvent = useCallback((e: MouseEvent | React.MouseEvent): number => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const offsetX = e.clientX - rect.left
    return Math.max(0, Math.min(1, offsetX / rect.width))
  }, [])

  // 鼠标按下开始拖拽或点击跳转
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return // 仅响应鼠标左键
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
      const targetTime = Math.round(finalPercent * duration)
      if (controlledCurrentTime === undefined) {
        setLocalCurrentTime(targetTime)
      }
      onSeek?.(targetTime)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <footer className="status-bar" aria-label="底部状态栏">
      {/* 封面框: 位于悬浮胶囊正下方，56px × 56px 圆角正方形 */}
      <div className="status-bar-cover" title="专辑封面">
        {coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt="专辑封面"
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
              {/* 外圈黑胶边缘 */}
              <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.45" />
              {/* 内同心音轨微纹 */}
              <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="2 2" />
              <circle cx="16" cy="16" r="6.8" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
              {/* 中心标签盘与主轴孔 (品牌薄荷绿 #6ee7b7 点缀) */}
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

        {/* 播放/暂停按键: 50px × 50px，暂停时为正圆形，播放或悬停时呈现动态弧度流动效果 */}
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
        {/* 当前播放时间 */}
        <span className="status-bar-time status-bar-time-current" aria-label="当前时间">
          {formatTime(currentSeconds)}
        </span>

        {/* 进度条轨道容器 (带 20px 扩展触控热区) */}
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
          {/* 物理槽体底轨 */}
          <div className="status-bar-progress-rail">
            {/* 品牌薄荷绿液态高光填充条 */}
            <div
              className="status-bar-progress-fill"
              style={{ width: `${effectivePercent}%` }}
            />
            {/* 液态微晶手柄 (Thumb) */}
            <div
              className="status-bar-progress-thumb"
              style={{ left: `${effectivePercent}%` }}
            />
          </div>
        </div>

        {/* 音频总时长 */}
        <span className="status-bar-time status-bar-time-duration" aria-label="总时长">
          {formatTime(duration)}
        </span>
      </div>

      {/* 预留后续主控制区与元数据区域 */}
    </footer>
  )
}
