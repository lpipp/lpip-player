import { useState, useEffect } from 'react'
import SidebarCapsule from './components/SidebarCapsule'
import WallpaperLayer from './components/WallpaperLayer'
import StatusBar from './components/StatusBar'
import MechanicalGear from './components/MechanicalGear'
import LyricsOrbit from './components/LyricsOrbit'

export default function App() {
  // 播放状态与当前秒数 (作为当前阶段 M0-2 演示与后续 M1/M2 MPD 数据流的统一锚点)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(68) // 默认定格在《Luna domina》(64s) 所在区间
  const duration = 248 // 04:08

  // 播放计时模拟器
  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setCurrentTime((prev) => (prev >= duration ? 0 : prev + 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [isPlaying, duration])

  return (
    <div className="stage">
      {/* 动态视频壁纸图层 (当配置视频壁纸时自动激活硬件加速播放) */}
      <WallpaperLayer />

      {/* 右侧精密机械表齿轮 (直径 500px，圆心距右边框 30px，外露 280px，垂直居中) */}
      <MechanicalGear />

      {/* 极坐标星盘歌词轨道 (中央主工作区，以左侧精密星盘机芯为圆心向右辐射展开) */}
      <LyricsOrbit
        currentTime={currentTime}
        onSeek={(time) => setCurrentTime(time)}
      />

      {/* 悬浮长条形胶囊伸缩抽屉 */}
      <SidebarCapsule />

      {/* 窗口底部磨砂状态栏 (80px 纯净骨架与控制组) */}
      <StatusBar
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onSeek={(time) => setCurrentTime(time)}
      />
    </div>
  )
}
