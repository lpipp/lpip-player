// M0 第一步: 空窗口
// 只有一块深色画布, 证明 主进程 → 渲染管线 → React 整条链路活着。
// 下一步才在它上面叠组件。
import SidebarBubble from './components/SidebarBubble'

export default function App() {
  return (
    <div className="stage">
      <SidebarBubble />
    </div>
  )
}
