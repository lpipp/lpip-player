import { useState, useEffect } from 'react'
import type { MpdSong, PlaybackMode } from '../../../types/music'
import type { VisualizerConfig } from '../../../types/config'
import SpectrumVisualizer from './SpectrumVisualizer'
import './StatusBar.css'

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
  /** 音频频谱律动配置项 */
  visualizerConfig?: VisualizerConfig
}

/**
 * 窗口底部磨砂状态栏组件 (StatusBar)
 */
export default function StatusBar({
  coverUrl,
  isPlaying: controlledIsPlaying,
  currentSong,
  mode = 'sequence',
  onPrev,
  onPlayPause,
  onNext,
  onModeToggle,
  visualizerConfig
}: StatusBarProps) {
  const [imgError, setImgError] = useState(false)

  // 当外部传入的封面 URL 发生变化时重置错误标记
  useEffect(() => {
    setImgError(false)
  }, [coverUrl])

  const [localIsPlaying, setLocalIsPlaying] = useState(false)
  const isPlaying = controlledIsPlaying !== undefined ? controlledIsPlaying : localIsPlaying

  const handlePlayToggle = () => {
    if (controlledIsPlaying === undefined) {
      setLocalIsPlaying(!localIsPlaying)
    }
    onPlayPause?.()
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

      {/* 当前曲目元数据卡片: 紧邻封面框右侧 */}
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

      {/* 播放控制按键组: 紧随歌曲信息右侧 */}
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
      </div>

      {/* 状态栏右侧音频频谱律动插槽 */}
      <div className="status-bar-spectrum-slot" aria-hidden="true">
        <SpectrumVisualizer isPlaying={isPlaying} config={visualizerConfig} />
      </div>
    </footer>
  )
}
