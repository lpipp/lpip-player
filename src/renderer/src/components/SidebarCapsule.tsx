import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { MpdSong } from '../../../types/music'
import MusicLibraryList from './MusicLibraryList'
import QueueDrawer from './QueueDrawer'
import ArtistDrawer from './ArtistDrawer'
import PlaylistDrawer from './PlaylistDrawer'
import SettingsDrawer from './SettingsDrawer'
import StatisticsDrawer from './StatisticsDrawer'
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

function ArtistsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function PlaylistIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="15" y2="6" />
      <line x1="4" y1="12" x2="11" y2="12" />
      <line x1="4" y1="18" x2="11" y2="18" />
      <circle cx="17" cy="15" r="3" />
      <path d="M20 15V5h2" />
    </svg>
  )
}

function StatsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="20" x2="21" y2="20" />
      <line x1="6" y1="20" x2="6" y2="13" />
      <line x1="12" y1="20" x2="12" y2="5" />
      <line x1="18" y1="20" x2="18" y2="9" />
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
 * 6 大功能模块 (曲库中心 / 播放队列 / 艺人分类 / 歌单 / 统计信息 / 偏好设置)
 * 注意: items 仅为导航元数据占位, 当前渲染均走下方专属抽屉组件分支,
 * 不再消费 items (保留字段供未来子菜单复用, 勿删以免破坏 NavModule 类型)
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
    id: 'artists',
    label: '艺人分类',
    icon: <ArtistsIcon />,
    items: [
      { id: 'art-all', title: '全部艺人', desc: '按歌手分组浏览作品' }
    ]
  },
  {
    id: 'playlists',
    label: '歌单',
    icon: <PlaylistIcon />,
    items: [
      { id: 'pl-all', title: '全部自建歌单', desc: '按画册分类浏览曲目' }
    ]
  },
  {
    id: 'stats',
    label: '统计信息',
    icon: <StatsIcon />,
    items: [
      { id: 'stats-rank', title: '播放次数排行', desc: '按累计播放次数从高到低' }
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
 * 悬浮胶囊抽屉组件属性
 */
export interface SidebarCapsuleProps {
  /** 当前正在播放的曲目对象 */
  currentSong?: MpdSong | null
  /** 当前正在播放的曲目 ID / file */
  currentSongId?: string
  /** 点击播放曲目回调 */
  onPlaySong?: (song: MpdSong) => void
  /** 添加至播放队列回调 */
  onAddToQueue?: (song: MpdSong) => void
}

/**
 * 窗口左侧加长型胶囊伸缩抽屉组件
 * - 收起状态: 垂直加长悬浮胶囊，容纳多个功能图标
 * - 展开状态: 点击某图标直接向右伸长，直接展示该图标的对应子菜单项
 * - 关闭机制: 鼠标移出弹窗超过配置文件指定的 closeBuffer (closeDistance) 距离后，
 *             等待 closeDelay 延迟平滑收回；若移回安全距离内自动取消收回
 */
export default function SidebarCapsule({
  currentSong,
  currentSongId,
  onPlaySong,
  onAddToQueue
}: SidebarCapsuleProps = {}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState('library')
  const capsuleRef = useRef<HTMLElement | null>(null)

  // 移出关闭距离、延迟与上下延伸配置 (从主进程注入的 HTML data 属性读取)
  const configRef = useRef({
    closeDistance: 40,
    closeDelay: 300,
    verticalExtension: 50
  })

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 从 HTML attributes 同步配置参数
  useEffect(() => {
    const syncConfig = (): void => {
      const docEl = document.documentElement
      const bufferAttr = docEl.getAttribute('data-sidebar-close-buffer')
      const delayAttr = docEl.getAttribute('data-sidebar-close-delay')
      const extAttr = docEl.getAttribute('data-sidebar-vertical-extension')

      configRef.current = {
        closeDistance: bufferAttr ? Number.parseInt(bufferAttr, 10) || 40 : 40,
        closeDelay: delayAttr ? Number.parseInt(delayAttr, 10) || 300 : 300,
        verticalExtension: extAttr ? Number.parseInt(extAttr, 10) || 50 : 50
      }
    }

    syncConfig()

    const observer = new MutationObserver(syncConfig)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'data-sidebar-close-buffer',
        'data-sidebar-close-delay',
        'data-sidebar-vertical-extension'
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

    // 鼠标彻底离开文档视口 (window 不会触发 mouseleave, 改用 documentElement/mouseout 兜底)
    const handleMouseOut = (e: globalThis.MouseEvent): void => {
      if (!e.relatedTarget && !closeTimerRef.current) {
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
    document.documentElement.addEventListener('mouseleave', handleMouseOut)
    document.addEventListener('mouseout', handleMouseOut)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.documentElement.removeEventListener('mouseleave', handleMouseOut)
      document.removeEventListener('mouseout', handleMouseOut)
      window.removeEventListener('keydown', handleKeyDown)
      cancelCloseTimer()
    }
  }, [isExpanded])

  // 抽屉收展保护: 收起时强制将容器 scrollLeft 归零并释放子面板可能残留的焦点，杜绝横向位移
  useEffect(() => {
    if (capsuleRef.current) {
      capsuleRef.current.scrollLeft = 0
    }
    if (!isExpanded && capsuleRef.current) {
      const activeEl = document.activeElement as HTMLElement | null
      if (
        activeEl &&
        capsuleRef.current.contains(activeEl) &&
        !capsuleRef.current.querySelector('.capsule-rail')?.contains(activeEl)
      ) {
        activeEl.blur()
      }
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

  // 导航模块列表 (统计信息为专属抽屉, 与曲库/队列/艺人/歌单/设置同级, 无动态注入)
  const navModules: NavModule[] = MODULES

  // 获取当前激活的模块及其子菜单
  const activeModule = navModules.find((m) => m.id === activeModuleId) || navModules[0]

  return (
    <aside
      ref={capsuleRef}
      className={`sidebar-capsule ${isExpanded ? 'expanded' : 'collapsed'}`}
      aria-label="主控制导航抽屉"
      onMouseEnter={cancelCloseTimer}
      onScroll={(e) => {
        if (e.currentTarget.scrollLeft !== 0) {
          e.currentTarget.scrollLeft = 0
        }
      }}
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

        {/* 整洁化: 导轨底部 M-B 徽标已隐藏, 保留占位以维持布局 */}
        <div className="capsule-rail-bottom" aria-hidden="true" />
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
        <div
          key={activeModuleId}
          className={`subpanel-content subpanel-module-switch ${
            activeModuleId === 'library'
              ? 'subpanel-content-library'
              : activeModuleId === 'queue'
                ? 'subpanel-content-queue'
                : activeModuleId === 'artists'
                  ? 'subpanel-content-artists'
                  : activeModuleId === 'playlists'
                    ? 'subpanel-content-playlists'
                    : activeModuleId === 'stats'
                      ? 'subpanel-content-stats'
                      : activeModuleId === 'settings'
                        ? 'subpanel-content-settings'
                        : ''
          }`}
        >
          {activeModuleId === 'library' ? (
            <MusicLibraryList
              currentSongId={currentSongId}
              onPlaySong={onPlaySong}
              onAddToQueue={onAddToQueue}
            />
          ) : activeModuleId === 'queue' ? (
            <QueueDrawer
              currentSong={currentSong}
              currentSongId={currentSongId}
              onPlayQueueSong={onPlaySong}
            />
          ) : activeModuleId === 'artists' ? (
            <ArtistDrawer
              currentSong={currentSong}
              currentSongId={currentSongId}
              onPlaySong={onPlaySong}
              onAddToQueue={onAddToQueue}
            />
          ) : activeModuleId === 'playlists' ? (
            <PlaylistDrawer
              currentSong={currentSong}
              currentSongId={currentSongId}
              onPlaySong={onPlaySong}
              onAddToQueue={onAddToQueue}
            />
          ) : activeModuleId === 'stats' ? (
            <StatisticsDrawer />
          ) : activeModuleId === 'settings' ? (
            <SettingsDrawer />
          ) : null}
        </div>

        {/* 整洁化: 子菜单底部版本号与就绪提示已隐藏 */}
      </section>
    </aside>
  )
}
