/**
 * ============================================================================
 * 【保留方案：左侧悬停触发滑出气泡弹窗方案（已卸载备用，保留供后续随时回退）】
 * 说明：根据用户指令，将该悬停触发+呼吸把手滑出方案卸载但完整保留代码（注释形式）。
 * 如需重新启用，解除本文件注释并在 App.tsx 中引入 <SidebarBubble /> 即可。
 * ============================================================================
 */

/*
import { useEffect, useRef, useState } from 'react'
import './SidebarBubble.css'

interface NavItem {
  id: string
  label: string
  icon: string
  active?: boolean
}

const DEFAULT_ITEMS: NavItem[] = [
  { id: 'library', label: '本地音乐库', icon: '🎵', active: true },
  { id: 'queue', label: '当前播放队列', icon: '📋' },
  { id: 'visualizer', label: '频谱音频渲染', icon: '✨' },
  { id: 'settings', label: '偏好设置', icon: '⚙️' }
]

export default function SidebarBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [glowHint, setGlowHint] = useState(true)
  const [activeId, setActiveId] = useState('library')

  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const delaysRef = useRef({ triggerDelay: 80, closeDelay: 300 })

  useEffect(() => {
    const syncFromAttributes = (): void => {
      const docEl = document.documentElement
      const isSidebarEnabled = docEl.getAttribute('data-sidebar-enabled') !== 'false'
      setEnabled(isSidebarEnabled)

      const isGlowHintEnabled = docEl.getAttribute('data-sidebar-glow-hint') !== 'false'
      setGlowHint(isGlowHintEnabled)

      const triggerDelayAttr = docEl.getAttribute('data-sidebar-trigger-delay')
      const closeDelayAttr = docEl.getAttribute('data-sidebar-close-delay')

      delaysRef.current = {
        triggerDelay: triggerDelayAttr ? Number.parseInt(triggerDelayAttr, 10) || 80 : 80,
        closeDelay: closeDelayAttr ? Number.parseInt(closeDelayAttr, 10) || 300 : 300
      }
    }

    syncFromAttributes()

    const observer = new MutationObserver(syncFromAttributes)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'data-sidebar-enabled',
        'data-sidebar-glow-hint',
        'data-sidebar-trigger-delay',
        'data-sidebar-close-delay'
      ]
    })

    return () => {
      observer.disconnect()
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const cancelClose = (): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const handleTriggerEnter = (): void => {
    cancelClose()
    if (isOpen) return

    if (triggerTimerRef.current) {
      return
    }

    triggerTimerRef.current = setTimeout(() => {
      setIsOpen(true)
      triggerTimerRef.current = null
    }, delaysRef.current.triggerDelay)
  }

  const handleTriggerLeave = (): void => {
    if (triggerTimerRef.current) {
      clearTimeout(triggerTimerRef.current)
      triggerTimerRef.current = null
    }
  }

  const handleBubbleEnter = (): void => {
    cancelClose()
    if (!isOpen) {
      setIsOpen(true)
    }
  }

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
      <div
        className="sidebar-trigger-zone"
        onMouseEnter={handleTriggerEnter}
        onMouseOver={handleTriggerEnter}
        onMouseMove={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
        onMouseOut={handleTriggerLeave}
        aria-hidden="true"
      >
        {glowHint && !isOpen && <div className="sidebar-beacon" />}
      </div>

      <aside
        className={`sidebar-bubble ${isOpen ? 'open' : ''}`}
        onMouseEnter={handleBubbleEnter}
        onMouseLeave={handleBubbleLeave}
        aria-label="主控制侧栏"
      >
        <header className="sidebar-header">
          <span className="sidebar-status-dot" />
          <span className="sidebar-title">lpip 控制台</span>
        </header>

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

        <footer className="sidebar-footer">
          <span>Model B 架构</span>
          <span>v0.1.0</span>
        </footer>
      </aside>

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
*/

export default function SidebarBubbleReserved() {
  return null
}
