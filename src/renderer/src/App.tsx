import SidebarCapsule from './components/SidebarCapsule'
import WallpaperLayer from './components/WallpaperLayer'
import StatusBar from './components/StatusBar'
import MechanicalGear from './components/MechanicalGear'

export default function App() {
  return (
    <div className="stage">
      {/* 动态视频壁纸图层 (当配置视频壁纸时自动激活硬件加速播放) */}
      <WallpaperLayer />

      {/* 右侧精密机械表齿轮 (直径 500px，圆心距右边框 30px，外露 280px，垂直居中) */}
      <MechanicalGear />

      {/* 悬浮长条形胶囊伸缩抽屉 */}
      <SidebarCapsule />

      {/* 窗口底部磨砂状态栏 (80px 纯净骨架与控制组) */}
      <StatusBar />
    </div>
  )
}
