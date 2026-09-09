import { useEffect, useRef, useState, type ReactNode } from 'react'
import './SidebarCapsule.css'

/**
 * 子菜单项数据模型
 */
interface SubMenuItem {
  id: string
  title: string
  desc: string
  badge?: string
}

/**
 * 导航模块数据模型
 */
interface NavModule {
  id: string
  label: string
  icon: ReactNode
  items: SubMenuItem[]
}

/**
 * SVG 矢量高保真图标 (免字体依赖、各分辨率锐利渲染)
 */
function LibraryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function QueueIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function RadioIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19.1" />
    </svg>
  )
}

function VisualizerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10v4" />
      <path d="M6 6v12" />
      <path d="M10 3v18" />
      <path d="M14 8v8" />
      <path d="M18 5v14" />
      <path d="M22 10v4" />
    </svg>
  )
}

function ThemeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 0 20z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/**
 * 6 大占位功能模块与对应子菜单项
 */
const MODULES: NavModule[] = [
  {
    id: 'library',
    label: '曲库中心',
    icon: <LibraryIcon />,
    items: [
      { id: 'lib-all', title: '全部本地歌曲', desc: '按索引检索本地音频', badge: '128 首' },
      { id: 'lib-artists', title: '歌手与艺人', desc: '按艺术家层级分类目录' },
      { id: 'lib-albums', title: '专辑封面图', desc: '高分辨率封面流渲染' },
      { id: 'lib-rescan', title: '重新扫描曲库', desc: '触发 MPD 后端更新扫描', badge: '更新' }
    ]
  },
  {
    id: 'queue',
    label: '播放队列',
    icon: <QueueIcon />,
    items: [
      { id: 'q-now', title: '正在播放', desc: '当前曲目详细波形与流信息', badge: 'Active' },
      { id: 'q-fav', title: '我的红心收藏', desc: '收藏夹列表', badge: '36' },
      { id: 'q-history', title: '最近播放历史', desc: '近 3 天聆听足迹' },
      { id: 'q-clear', title: '清空当前队列', desc: '清空列表并释放播放缓存' }
    ]
  },
  {
    id: 'radio',
    label: '网络电台',
    icon: <RadioIcon />,
    items: [
      { id: 'rad-local', title: '本地 HTTPD 音频流', desc: '127.0.0.1:8000 (Ogg/Opus 320k)', badge: '8000' },
      { id: 'rad-lofi', title: 'Lofi 空间慢调', desc: '专注轻音乐与编码节奏' },
      { id: 'rad-noise', title: '环境白噪音', desc: '黑胶唱片底噪与温润雨声' }
    ]
  },
  {
    id: 'visualizer',
    label: '音频频谱',
    icon: <VisualizerIcon />,
    items: [
      { id: 'vis-bars', title: '64 段动态柱状图', desc: 'WebAudio FFT 实时离散变换', badge: '开启' },
      { id: 'vis-wave', title: '流体微光波形', desc: '极光渐变动态曲面' },
      { id: 'vis-gain', title: '阻尼衰减系数', desc: '控制频谱柱回弹速率 (0.85)' }
    ]
  },
  {
    id: 'theme',
    label: '外观主题',
    icon: <ThemeIcon />,
    items: [
      { id: 'thm-mode', title: '材质模式', desc: '深色云母晶体 (Mica Effect)', badge: 'Mica' },
      { id: 'thm-style', title: '色温微光预设', desc: '翡翠绿与冷紫蓝交织 (Default)' },
      { id: 'thm-grain', title: '晶体颗粒度', desc: '极细哑光磨砂感 (0.035)' },
      { id: 'thm-border', title: '外边缘发光轮廓', desc: '沉浸式极细冷光边缘', badge: '开启' }
    ]
  },
  {
    id: 'settings',
    label: '偏好设置',
    icon: <SettingsIcon />,
    items: [
      { id: 'set-mpd', title: 'MPD 连接配置', desc: '127.0.0.1:6600 (纯文本控制流)', badge: '已连接' },
      { id: 'set-ext', title: '上下延伸幅度', desc: '展开时上下各延伸的像素距离 (可配置)', badge: '50px' },
      { id: 'set-close-dist', title: '移出关闭距离', desc: '超出抽屉此距离触发收起计时', badge: '40px' },
      { id: 'set-close-delay', title: '移出收起延迟', desc: '超出关闭距离后的倒计时时长', badge: '300ms' },
      { id: 'set-imm', title: '沉浸式无边框', desc: '隐藏系统原生标题栏与控件', badge: '开启' },
      { id: 'set-about', title: '关于 lpip-player', desc: 'Model B 架构 · Electron + React' }
    ]
  }
]

/**
 * 计算鼠标坐标 (clientX, clientY) 到元素 DOMRect 矩形的外延距离 (px)
 * 鼠标在矩形内部时返回 0; 在外部时返回垂直/水平距离的几何距离
 */
function getDistanceToRect(x: number, y: number, rect: DOMRect): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right)
  const dy = Math.max(rect.top - y, 0, y - rect.bottom)
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 窗口左侧加长型胶囊伸缩抽屉组件
 * - 收起状态: 垂直加长悬浮胶囊，容纳多个占位功能图标
 * - 展开状态: 点击某图标直接向右伸长，直接展示该图标的对应子菜单项
 * - 关闭机制: 鼠标移出弹窗超过配置文件指定的 closeBuffer (closeDistance) 距离后，
 *             等待 closeDelay 延迟平滑收回；若移回安全距离内自动取消收回
 */
export default function SidebarCapsule() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState('settings')
  const capsuleRef = useRef<HTMLElement | null>(null)

  // 移出关闭距离、延迟与上下延伸配置 (从主进程注入的 HTML data 属性读取)
  const configRef = useRef({
    closeDistance: 40,
    closeDelay: 300,
    verticalExtension: 50
  })

  // 同步主进程注入的明暗主题模式与微调参数
  const [themeInfo, setThemeInfo] = useState({
    mode: 'dark',
    brightness: 0,
    contrast: 1.0,
    opacity: 0.3
  })

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 从 HTML attributes 同步配置参数
  useEffect(() => {
    const syncConfig = (): void => {
      const docEl = document.documentElement
      const bufferAttr = docEl.getAttribute('data-sidebar-close-buffer')
      const delayAttr = docEl.getAttribute('data-sidebar-close-delay')
      const extAttr = docEl.getAttribute('data-sidebar-vertical-extension')
      const themeAttr = docEl.getAttribute('data-theme')
      const brightnessAttr = docEl.getAttribute('data-theme-brightness')
      const contrastAttr = docEl.getAttribute('data-theme-contrast')
      const opacityAttr = docEl.getAttribute('data-sidebar-opacity')

      configRef.current = {
        closeDistance: bufferAttr ? Number.parseInt(bufferAttr, 10) || 40 : 40,
        closeDelay: delayAttr ? Number.parseInt(delayAttr, 10) || 300 : 300,
        verticalExtension: extAttr ? Number.parseInt(extAttr, 10) || 50 : 50
      }

      setThemeInfo({
        mode: themeAttr === 'light' ? 'light' : 'dark',
        brightness: brightnessAttr ? Number.parseFloat(brightnessAttr) || 0 : 0,
        contrast: contrastAttr ? Number.parseFloat(contrastAttr) || 1.0 : 1.0,
        opacity: opacityAttr ? Number.parseFloat(opacityAttr) || 0.3 : 0.3
      })
    }

    syncConfig()

    const observer = new MutationObserver(syncConfig)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'data-sidebar-close-buffer',
        'data-sidebar-close-delay',
        'data-sidebar-vertical-extension',
        'data-sidebar-opacity',
        'data-theme',
        'data-theme-brightness',
        'data-theme-contrast'
      ]
    })

    return () => {
      observer.disconnect()
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // 清除收回倒计时
  const cancelCloseTimer = (): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  // 展开状态下监听全局鼠标位置: 移出抽屉超过指定距离后启动延迟关闭
  useEffect(() => {
    if (!isExpanded) {
      cancelCloseTimer()
      return
    }

    const handleMouseMove = (e: MouseEvent): void => {
      if (!capsuleRef.current) return
      const rect = capsuleRef.current.getBoundingClientRect()
      const dist = getDistanceToRect(e.clientX, e.clientY, rect)

      if (dist <= configRef.current.closeDistance) {
        // 在弹窗内部或允许的缓冲外延距离之内, 取消收起倒计时
        cancelCloseTimer()
      } else {
        // 移出超出设定的距离, 启动收起倒计时
        if (!closeTimerRef.current) {
          closeTimerRef.current = setTimeout(() => {
            setIsExpanded(false)
            closeTimerRef.current = null
          }, configRef.current.closeDelay)
        }
      }
    }

    // 鼠标彻底离开当前窗口视口
    const handleMouseLeave = (): void => {
      if (!closeTimerRef.current) {
        closeTimerRef.current = setTimeout(() => {
          setIsExpanded(false)
          closeTimerRef.current = null
        }, configRef.current.closeDelay)
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsExpanded(false)
        cancelCloseTimer()
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('keydown', handleKeyDown)
      cancelCloseTimer()
    }
  }, [isExpanded])

  // 点击图标: 若未展开则展开并展示该模块子菜单; 若已展开且点击同一图标则收起抽屉; 若点击其他图标则切换到该模块子菜单
  const handleIconClick = (id: string): void => {
    cancelCloseTimer()
    if (isExpanded && activeModuleId === id) {
      setIsExpanded(false)
      return
    }
    setActiveModuleId(id)
    if (!isExpanded) {
      setIsExpanded(true)
    }
  }

  // 组装动态导航模块列表 (将实时主题与微调参数注入外观主题模块)
  const navModules: NavModule[] = MODULES.map((mod) => {
    if (mod.id === 'theme') {
      const isLight = themeInfo.mode === 'light'
      return {
        ...mod,
        items: [
          {
            id: 'thm-mode',
            title: '明暗模式',
            desc: isLight ? '浅色白玉霜雪模式 (Light Mode)' : '深色黑曜石模式 (Dark Mode)',
            badge: isLight ? '浅色' : '深色'
          },
          {
            id: 'thm-brightness',
            title: '明暗度微调',
            desc: `基准偏移量 (${themeInfo.brightness >= 0 ? '+' : ''}${themeInfo.brightness.toFixed(2)})`,
            badge: `${themeInfo.brightness >= 0 ? '+' : ''}${themeInfo.brightness.toFixed(2)}`
          },
          {
            id: 'thm-contrast',
            title: '对比度微调',
            desc: `明暗对比系数 (${themeInfo.contrast.toFixed(2)})`,
            badge: `${themeInfo.contrast.toFixed(2)}`
          },
          {
            id: 'thm-glass',
            title: '胶囊不透明度',
            desc: `毛玻璃底色通透度 (${themeInfo.opacity.toFixed(2)})`,
            badge: `${themeInfo.opacity.toFixed(2)}`
          }
        ]
      }
    }
    return mod
  })

  // 获取当前激活的模块及其子菜单
  const activeModule = navModules.find((m) => m.id === activeModuleId) || navModules[0]

  return (
    <aside
      ref={capsuleRef}
      className={`sidebar-capsule ${isExpanded ? 'expanded' : 'collapsed'}`}
      aria-label="主控制导航抽屉"
      onMouseEnter={cancelCloseTimer}
    >
      {/* 左侧固定图标导轨 (收起时即整只胶囊, 展开时作为左侧快速切换栏) */}
      <div className="capsule-rail">
        {/* 顶部微光呼吸指示点 */}
        <div className="capsule-rail-top" title="lpip 播放器">
          <span className="capsule-status-dot" />
        </div>

        {/* 6 大功能模块图标列 */}
        <nav className="capsule-rail-icons" aria-label="功能模块列表">
          {navModules.map((mod) => {
            // 仅在抽屉展开时显示高光；退出收起后恢复纯净无高光态
            const isActive = isExpanded && activeModuleId === mod.id
            return (
              <button
                key={mod.id}
                type="button"
                className={`capsule-icon-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleIconClick(mod.id)}
                title={mod.label}
                aria-label={mod.label}
              >
                <span className="capsule-icon-wrapper">{mod.icon}</span>
              </button>
            )
          })}
        </nav>

        {/* 导轨底部状态或简略标志 */}
        <div className="capsule-rail-bottom">
          <span className="capsule-model-badge">M-B</span>
        </div>
      </div>

      {/* 右侧子菜单内容区 (保持 DOM 结构恒定，通过外层视窗裁剪展开，彻底杜绝折行重排抖动) */}
      <section
        className="capsule-subpanel"
        aria-hidden={!isExpanded}
      >
        {/* 子菜单顶部标题栏 (根据需求隐藏右上角关闭按键 X，由移出距离自动收回) */}
        <header className="subpanel-header">
          <div className="subpanel-title-area">
            <span className="subpanel-icon">{activeModule.icon}</span>
            <h2 className="subpanel-title">{activeModule.label}</h2>
          </div>
        </header>

        {/* 子菜单项列表 (带模块切换轻量过渡) */}
        <div key={activeModuleId} className="subpanel-content subpanel-module-switch">
          <div className="subpanel-section-hint">
            <span>{activeModule.label} 子项配置</span>
            <span className="subpanel-config-hint">
              移出 {configRef.current.closeDistance}px / {configRef.current.closeDelay}ms 关闭
            </span>
          </div>

          <ul className="subpanel-list">
            {activeModule.items.map((item) => (
              <li key={item.id} className="subpanel-item">
                <div className="subpanel-item-info">
                  <span className="subpanel-item-title">{item.title}</span>
                  <span className="subpanel-item-desc">{item.desc}</span>
                </div>
                {item.badge && <span className="subpanel-item-badge">{item.badge}</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* 子菜单底部提示 */}
        <footer className="subpanel-footer">
          <span>lpip-player v0.1.0</span>
          <span className="subpanel-status-tag">就绪</span>
        </footer>
      </section>
    </aside>
  )
}
