import { useEffect, useRef, useState } from 'react'
import './SidebarBubble.css'

/**
 * 侧边栏菜单项模型
 */
interface NavItem {
  id: string
  label: string
  icon: string
  active?: boolean
}

/**
 * 预设占位导航项 (体现播放器基础结构)
 */
const DEFAULT_ITEMS: NavItem[] = [
  { id: 'library', label: '本地音乐库', icon: '🎵', active: true },
  { id: 'queue', label: '当前播放队列', icon: '📋' },
  { id: 'visualizer', label: '频谱音频渲染', icon: '✨' },
  { id: 'settings', label: '偏好设置', icon: '⚙️' }
]

/**
 * 窗口左侧滑出气泡弹窗抽屉组件
 * 当鼠标悬停在屏幕最左侧热区时，根据配置参数延时平滑向右滑出
 */
export default function SidebarBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [activeId, setActiveId] = useState('library')

  // 定时器引用, 避免内存泄漏与连续晃动抖动
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 延迟时间 (优先从 HTML dataset 读取主进程注入的配置值, 降级至预设)
  const delaysRef = useRef({ triggerDelay: 80, closeDelay: 300 })

  useEffect(() => {
    // 从 html 根节点同步主进程注入的开关与延迟参数
    const syncFromAttributes = (): void => {
      const docEl = document.documentElement
      const isSidebarEnabled = docEl.getAttribute('data-sidebar-enabled') !== 'false'
      setEnabled(isSidebarEnabled)

      const triggerDelayAttr = docEl.getAttribute('data-sidebar-trigger-delay')
      const closeDelayAttr = docEl.getAttribute('data-sidebar-close-delay')

      delaysRef.current = {
        triggerDelay: triggerDelayAttr ? Number.parseInt(triggerDelayAttr, 10) || 80 : 80,
        closeDelay: closeDelayAttr ? Number.parseInt(closeDelayAttr, 10) || 300 : 300
      }
    }

    syncFromAttributes()

    // 监听属性变化, 避免 did-finish-load 注入与 React 首屏渲染的时序竞争
    const observer = new MutationObserver(syncFromAttributes)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-sidebar-enabled', 'data-sidebar-trigger-delay', 'data-sidebar-close-delay']
    })

    return () => {
      observer.disconnect()
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  /**
   * 清除收起计时器, 保持抽屉展开
   */
  const cancelClose = (): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  /**
   * 鼠标进入热区: 清除关闭定时并启动悬停触发延迟
   */
  const handleTriggerEnter = (): void => {
    cancelClose()
    if (isOpen) return

    // 若当前已有计时器正在等待, 保持原倒计时, 防止鼠标微动连续打断触发
    if (triggerTimerRef.current) {
      return
    }

    triggerTimerRef.current = setTimeout(() => {
      setIsOpen(true)
      triggerTimerRef.current = null
    }, delaysRef.current.triggerDelay)
  }

  /**
   * 鼠标离开热区: 若未完全滑出则取消触发
   */
  const handleTriggerLeave = (): void => {
    if (triggerTimerRef.current) {
      clearTimeout(triggerTimerRef.current)
      triggerTimerRef.current = null
    }
  }

  /**
   * 鼠标进入抽屉主体: 保持常开
   */
  const handleBubbleEnter = (): void => {
    cancelClose()
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  /**
   * 鼠标离开抽屉主体: 启动收起延迟倒计时
   */
  const handleBubbleLeave = (): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }

    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false)
      closeTimerRef.current = null
    }, delaysRef.current.closeDelay)
  }

  if (!enabled) {
    return null
  }

  return (
    <>
      {/* 边缘感应触发带 */}
      <div
        className="sidebar-trigger-zone"
        onMouseEnter={handleTriggerEnter}
        onMouseOver={handleTriggerEnter}
        onMouseMove={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
        onMouseOut={handleTriggerLeave}
        aria-hidden="true"
      />

      {/* 悬浮气泡抽屉 */}
      <aside
        className={`sidebar-bubble ${isOpen ? 'open' : ''}`}
        onMouseEnter={handleBubbleEnter}
        onMouseLeave={handleBubbleLeave}
        aria-label="主控制侧栏"
      >
        {/* 标题栏与呼吸点 */}
        <header className="sidebar-header">
          <span className="sidebar-status-dot" />
          <span className="sidebar-title">lpip 控制台</span>
        </header>

        {/* 导航项列表 */}
        <nav className="sidebar-content">
          {DEFAULT_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${activeId === item.id ? 'active' : ''}`}
              onClick={() => setActiveId(item.id)}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* 底部状态 */}
        <footer className="sidebar-footer">
          <span>Model B 架构</span>
          <span>v0.1.0</span>
        </footer>
      </aside>

      {/* 展开态右侧关闭缓冲安全区: 移入该区域保持常开, 彻底移出才触发关闭倒计时 */}
      {isOpen && (
        <div
          className="sidebar-close-buffer-zone"
          onMouseEnter={handleBubbleEnter}
          onMouseOver={handleBubbleEnter}
          onMouseMove={handleBubbleEnter}
          onMouseLeave={handleBubbleLeave}
          onMouseOut={handleBubbleLeave}
          aria-hidden="true"
        />
      )}
    </>
  )
}
