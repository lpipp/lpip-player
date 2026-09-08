// M0 第一步: 空窗口
// 只有一块深色画布, 证明 主进程 → 渲染管线 → React 整条链路活着。
// 下一步才在它上面叠组件。
// 当前激活方案: 左侧悬浮长条形液态玻璃胶囊伸缩抽屉
import SidebarCapsule from './components/SidebarCapsule'

// 保留方案（旧版左侧悬停触发滑出气泡抽屉，已卸载备用，勿删）:
// import SidebarBubble from './components/SidebarBubble'

export default function App() {
  return (
    <div className="stage">
      {/* 悬浮长条形胶囊伸缩抽屉 */}
      <SidebarCapsule />

      {/* 保留方案（旧版悬停气泡抽屉）:
      <SidebarBubble />
      */}
    </div>
  )
}
