import { memo, useEffect, useRef, useState } from 'react'
import './WallpaperLayer.css'

/**
 * 视频壁纸运行时参数状态
 */
interface VideoWallpaperState {
  isActive: boolean
  url: string
  blur: number
  overlayOpacity: number
  fit: 'cover' | 'contain' | 'fill'
  muted: boolean
  loop: boolean
  playbackRate: number
  themeMode: 'dark' | 'light'
}

/**
 * 动态视频壁纸图层组件 (WallpaperLayer)
 * 专门承载 HTML5 硬件加速动态视频壁纸播放与响应式属性同步
 * 当当前壁纸为视频格式时自动激活，与静态图片及云母模式互不干扰
 */
function WallpaperLayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [state, setState] = useState<VideoWallpaperState>({
    isActive: false,
    url: '',
    blur: 0,
    overlayOpacity: 0.5,
    fit: 'cover',
    muted: true,
    loop: true,
    playbackRate: 1.0,
    themeMode: 'dark'
  })

  // 从 HTML attributes 实时同步壁纸配置与明暗主题
  useEffect(() => {
    const syncFromAttributes = (): void => {
      const doc = document.documentElement
      const bgMode = doc.getAttribute('data-bg-mode')
      const wpType = doc.getAttribute('data-wallpaper-type')
      const url = doc.getAttribute('data-wallpaper-url') || ''
      const blurAttr = doc.getAttribute('data-wallpaper-blur')
      const opacityAttr = doc.getAttribute('data-wallpaper-overlay-opacity')
      const fitAttr = doc.getAttribute('data-wallpaper-fit') as 'cover' | 'contain' | 'fill' | null
      const mutedAttr = doc.getAttribute('data-wallpaper-muted')
      const loopAttr = doc.getAttribute('data-wallpaper-loop')
      const rateAttr = doc.getAttribute('data-wallpaper-playback-rate')
      const themeAttr = doc.getAttribute('data-theme')

      const isVideo = bgMode === 'wallpaper' && wpType === 'video' && Boolean(url)

      setState({
        isActive: isVideo,
        url,
        blur: blurAttr ? Number.parseFloat(blurAttr) || 0 : 0,
        overlayOpacity: opacityAttr ? Number.parseFloat(opacityAttr) || 0.5 : 0.5,
        fit: fitAttr === 'contain' || fitAttr === 'fill' ? fitAttr : 'cover',
        muted: mutedAttr !== 'false',
        loop: loopAttr !== 'false',
        playbackRate: rateAttr ? Number.parseFloat(rateAttr) || 1.0 : 1.0,
        themeMode: themeAttr === 'light' ? 'light' : 'dark'
      })
    }

    syncFromAttributes()

    const observer = new MutationObserver(syncFromAttributes)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'data-bg-mode',
        'data-wallpaper-type',
        'data-wallpaper-url',
        'data-wallpaper-blur',
        'data-wallpaper-overlay-opacity',
        'data-wallpaper-fit',
        'data-wallpaper-muted',
        'data-wallpaper-loop',
        'data-wallpaper-playback-rate',
        'data-theme'
      ]
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  // 动态同步视频播放倍速
  useEffect(() => {
    if (videoRef.current && state.isActive) {
      videoRef.current.playbackRate = state.playbackRate
    }
  }, [state.playbackRate, state.isActive, state.url])

  if (!state.isActive || !state.url) {
    return null
  }

  return (
    <div className="wallpaper-layer" aria-hidden="true">
      <video
        ref={videoRef}
        src={state.url}
        autoPlay
        loop={state.loop}
        muted={state.muted}
        playsInline
        className="wallpaper-media wallpaper-video"
        style={{
          objectFit: state.fit,
          filter: state.blur > 0 ? `blur(${state.blur}px)` : undefined,
          transform: state.blur > 0 ? 'scale(1.05)' : undefined
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            videoRef.current.playbackRate = state.playbackRate
          }
        }}
      />
      <div
        className="wallpaper-overlay"
        style={{
          backgroundColor: `rgba(10, 10, 15, ${state.overlayOpacity})`
        }}
      />
    </div>
  )
}

export default memo(WallpaperLayer)

