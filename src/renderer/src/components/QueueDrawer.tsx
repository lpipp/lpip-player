import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type MouseEvent,
  type DragEvent
} from 'react'
import type { MpdSong, MpdStatus } from '../../../types/music'
import './QueueDrawer.css'

/**
 * 播放队列抽屉组件属性
 */
export interface QueueDrawerProps {
  /** 当前正在播放的曲目对象 */
  currentSong?: MpdSong | null
  /** 当前正在播放的曲目 ID / file */
  currentSongId?: string
  /** 点击播放队列曲目回调 */
  onPlayQueueSong?: (song: MpdSong) => void
}

/**
 * 黑胶唱片矢量占位图标
 */
function VinylDiscIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="queue-track-disc-icon"
    >
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.45" />
      <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="2 2" />
      <circle cx="16" cy="16" r="6.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="16" cy="16" r="1.4" fill="#6ee7b7" />
    </svg>
  )
}

/**
 * 定位当前播放曲目准星矢量图标
 */
function LocateIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="7" />
      <line x1="12" y1="1" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="1" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="23" y2="12" />
    </svg>
  )
}

/**
 * 垃圾桶清空矢量图标
 */
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

/**
 * 移除单曲叉号矢量图标
 */
function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/**
 * 红心收藏矢量图标
 */
function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="#6ee7b7" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    )
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

/**
 * 拖拽手柄 6 点矢量图标
 */
function DragGripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="queue-grip-icon">
      <circle cx="2" cy="2.5" r="1.2" />
      <circle cx="8" cy="2.5" r="1.2" />
      <circle cx="2" cy="7" r="1.2" />
      <circle cx="8" cy="7" r="1.2" />
      <circle cx="2" cy="11.5" r="1.2" />
      <circle cx="8" cy="11.5" r="1.2" />
    </svg>
  )
}

/**
 * 正在播放的动态微跳音符动效
 */
function EqualizerMiniBars() {
  return (
    <span className="queue-mini-equalizer" aria-label="正在播放">
      <span className="queue-mini-bar bar-1" />
      <span className="queue-mini-bar bar-2" />
      <span className="queue-mini-bar bar-3" />
    </span>
  )
}

/**
 * 空队列矢量图
 */
function QueueEmptyGraphic() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="queue-empty-svg">
      <line x1="8" y1="6" x2="21" y2="6" strokeOpacity="0.4" />
      <line x1="8" y1="12" x2="21" y2="12" strokeOpacity="0.4" />
      <line x1="8" y1="18" x2="16" y2="18" strokeOpacity="0.3" />
      <circle cx="4" cy="6" r="1.5" fill="#6ee7b7" fillOpacity="0.6" />
      <circle cx="4" cy="12" r="1.5" stroke="#6ee7b7" strokeOpacity="0.4" />
      <circle cx="4" cy="18" r="1.5" stroke="currentColor" strokeOpacity="0.3" />
    </svg>
  )
}

/**
 * 格式化时长秒数为 mm:ss
 */
function formatDuration(seconds: number): string {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const FAVORITES_STORAGE_KEY = 'lpip_player_favorites'

/**
 * 获取本地红心收藏集合
 */
function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed)) {
        return new Set(parsed)
      }
    }
  } catch {}
  return new Set()
}

/**
 * 保存本地红心收藏集合
 */
function saveFavorites(favs: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favs)))
    window.dispatchEvent(new CustomEvent('lpip:favorites-changed', { detail: Array.from(favs) }))
  } catch {}
}

/**
 * 悬浮胶囊第二按键：播放队列管理抽屉组件 (QueueDrawer)
 *
 * 核心特征:
 * 1. 实时读取 MPD playlistinfo，呈现序号、封面、标题、歌手专辑与时长
 * 2. 翡翠绿高亮正在播放曲目，支持一键精准定位视口 (scrollIntoView)
 * 3. 即时切歌、单项从 MPD 移除 (deleteid)、一键清空 (clear)
 * 4. 原生 HTML5 拖拽调整队列顺序并同步 MPD move
 * 5. 红心收藏状态轻量持久化
 * 6. 动静分离铁律：整像素网格与 ::before 承载卡片缩放与光效
 */
export default function QueueDrawer({
  currentSong,
  currentSongId,
  onPlayQueueSong
}: QueueDrawerProps) {
  const [songs, setSongs] = useState<MpdSong[]>([])
  const [loading, setLoading] = useState(true)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())

  // 拖拽排序状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null)

  const draggedIndexRef = useRef<number | null>(null)
  const dropPositionRef = useRef<'top' | 'bottom' | null>(null)
  const isDraggingRef = useRef(false)

  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const activeItemRef = useRef<HTMLDivElement | null>(null)
  const lastPlaylistLenRef = useRef<number>(-1)
  const lastPlaylistVerRef = useRef<number>(-1)
  const hasAutoScrolledRef = useRef(false)

  // 读取 MPD 当前播放队列
  const refreshQueue = useCallback(async (showLoading = false): Promise<void> => {
    if (showLoading) setLoading(true)
    try {
      if (window.electronAPI?.mpd) {
        const queue = await window.electronAPI.mpd.getQueue()
        setSongs(queue)
        lastPlaylistLenRef.current = queue.length
      }
    } catch (err) {
      console.error('[lpip-player:queue] 获取队列失败:', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  // 挂载时加载队列并监听 MPD 状态广播
  useEffect(() => {
    let isMounted = true

    refreshQueue(true)

    // 监听 MPD 状态广播：当队列长度或版本号改变时自动刷新队列
    const unsubscribe = window.electronAPI?.mpd.onStatusChange((status: MpdStatus) => {
      if (!isMounted) return
      const lenChanged = status.playlistLength !== lastPlaylistLenRef.current
      const verChanged =
        status.playlistVersion !== undefined && status.playlistVersion !== lastPlaylistVerRef.current
      if (lenChanged || verChanged) {
        if (status.playlistVersion !== undefined) {
          lastPlaylistVerRef.current = status.playlistVersion
        }
        refreshQueue(false)
      }
    })

    // 监听收藏状态同步广播
    const handleFavChange = (): void => {
      if (isMounted) setFavorites(loadFavorites())
    }
    window.addEventListener('lpip:favorites-changed', handleFavChange)

    return () => {
      isMounted = false
      unsubscribe?.()
      window.removeEventListener('lpip:favorites-changed', handleFavChange)
    }
  }, [refreshQueue])

  // 首次加载完成且有正在播放曲目时，平滑视口定位
  useEffect(() => {
    if (!loading && songs.length > 0 && !hasAutoScrolledRef.current) {
      hasAutoScrolledRef.current = true
      // 微延时确保 DOM 渲染完成
      const timer = setTimeout(() => {
        if (activeItemRef.current) {
          activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 120)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [loading, songs.length])

  // 判断指定曲目是否为当前播放曲目
  const isSongActive = useCallback(
    (song: MpdSong): boolean => {
      if (currentSong?.queueId !== undefined && song.queueId !== undefined) {
        return song.queueId === currentSong.queueId
      }
      if (currentSong?.pos !== undefined && song.pos !== undefined) {
        return song.pos === currentSong.pos
      }
      if (currentSong?.file && song.file) {
        return currentSong.file === song.file
      }
      if (currentSongId && (song.id === currentSongId || song.file === currentSongId)) {
        return true
      }
      return false
    },
    [currentSong, currentSongId]
  )

  // 一键滚动定位至当前正在播放的曲目
  const handleScrollToCurrent = (): void => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // 点击单曲切歌 (带拖拽保护，避免释放鼠标时误触切歌)
  const handleSongClick = (song: MpdSong): void => {
    if (isDraggingRef.current) return
    onPlayQueueSong?.(song)
  }

  // 移除单曲 (deleteid)
  const handleRemoveSong = async (e: MouseEvent, song: MpdSong, index: number): Promise<void> => {
    e.stopPropagation()
    // 乐观剔除
    setSongs((prev) => prev.filter((_, idx) => idx !== index))
    lastPlaylistLenRef.current = Math.max(0, lastPlaylistLenRef.current - 1)

    try {
      if (window.electronAPI?.mpd) {
        await window.electronAPI.mpd.removeQueueItem(song.pos ?? index, song.queueId)
        // 从 MPD 重新对齐一次最新队列
        const updated = await window.electronAPI.mpd.getQueue()
        setSongs(updated)
        lastPlaylistLenRef.current = updated.length
      }
    } catch (err) {
      console.error('[lpip-player:queue] 移除单曲失败:', err)
      refreshQueue(false)
    }
  }

  // 一键清空队列 (clear)
  const handleClearQueue = async (e: MouseEvent): Promise<void> => {
    e.stopPropagation()
    setSongs([])
    lastPlaylistLenRef.current = 0
    try {
      if (window.electronAPI?.mpd) {
        await window.electronAPI.mpd.clearQueue()
      }
    } catch (err) {
      console.error('[lpip-player:queue] 清空队列失败:', err)
      refreshQueue(false)
    }
  }

  // 切换红心收藏状态
  const handleToggleFavorite = (e: MouseEvent, song: MpdSong): void => {
    e.stopPropagation()
    const nextFavs = new Set(favorites)
    if (nextFavs.has(song.file)) {
      nextFavs.delete(song.file)
    } else {
      nextFavs.add(song.file)
    }
    setFavorites(nextFavs)
    saveFavorites(nextFavs)
  }

  // 封面加载失败
  const handleImageError = (id: string): void => {
    setImgErrors((prev) => ({ ...prev, [id]: true }))
  }

  // 原生拖拽排序事件处理
  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number): void => {
    isDraggingRef.current = true
    draggedIndexRef.current = index
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const pos = e.clientY < midY ? 'top' : 'bottom'

    dropPositionRef.current = pos
    setDragOverIndex(index)
    setDropPosition(pos)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    // 离开元素时清除高亮 (检查是否真正离开)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null)
      setDropPosition(null)
    }
  }

  const handleDragEnd = (): void => {
    draggedIndexRef.current = null
    dropPositionRef.current = null
    setDraggedIndex(null)
    setDragOverIndex(null)
    setDropPosition(null)
    setTimeout(() => {
      isDraggingRef.current = false
    }, 60)
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>, index: number): Promise<void> => {
    e.preventDefault()

    const dataTransferIndex = Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
    const fromIndex =
      draggedIndexRef.current !== null && !Number.isNaN(draggedIndexRef.current)
        ? draggedIndexRef.current
        : !Number.isNaN(dataTransferIndex)
          ? dataTransferIndex
          : draggedIndex

    const currentDropPos = dropPositionRef.current || dropPosition

    if (fromIndex === null || fromIndex === undefined || fromIndex === index) {
      handleDragEnd()
      return
    }

    let targetPos = index
    if (currentDropPos === 'top') {
      targetPos = fromIndex < index ? index - 1 : index
    } else if (currentDropPos === 'bottom') {
      targetPos = fromIndex < index ? index : index + 1
    }
    targetPos = Math.max(0, Math.min(songs.length - 1, targetPos))

    if (targetPos === fromIndex) {
      handleDragEnd()
      return
    }

    // 1. 本地乐观重排
    const nextSongs = [...songs]
    const [movedItem] = nextSongs.splice(fromIndex, 1)
    nextSongs.splice(targetPos, 0, movedItem)
    const reindexed = nextSongs.map((s, idx) => ({ ...s, pos: idx }))
    setSongs(reindexed)
    handleDragEnd()

    // 2. 同步 MPD move 指令
    try {
      if (window.electronAPI?.mpd) {
        await window.electronAPI.mpd.moveQueueItem(fromIndex, targetPos)
        // 延时拉取真实 MPD 队列对齐状态
        const updated = await window.electronAPI.mpd.getQueue()
        setSongs(updated)
      }
    } catch (err) {
      console.error('[lpip-player:queue] 拖拽排序同步失败:', err)
      refreshQueue(false)
    }
  }

  const hasCurrentSong = songs.some((s) => isSongActive(s))

  return (
    <div className="queue-drawer-container">
      {/* 顶部工具栏: 标题、总曲数、定位按键与一键清空按键 */}
      <div className="queue-drawer-toolbar">
        <div className="queue-toolbar-left">
          <span className="queue-toolbar-title">播放队列</span>
          <span className="queue-toolbar-count">
            {songs.length > 0 ? `${songs.length} 首曲目` : '空队列'}
          </span>
        </div>

        <div className="queue-toolbar-actions">
          {/* 一键定位至正在播放曲目 */}
          <button
            type="button"
            className="queue-toolbar-btn queue-btn-locate"
            onClick={handleScrollToCurrent}
            disabled={!hasCurrentSong}
            title={hasCurrentSong ? '定位当前播放曲目' : '当前无正在播放曲目'}
            aria-label="定位当前播放曲目"
          >
            <LocateIcon />
            <span>定位</span>
          </button>

          {/* 一键清空队列 */}
          <button
            type="button"
            className="queue-toolbar-btn queue-btn-clear"
            onClick={handleClearQueue}
            disabled={songs.length === 0}
            title={songs.length > 0 ? '一键清空当前播放队列' : '队列已为空'}
            aria-label="清空播放队列"
          >
            <TrashIcon />
            <span>清空</span>
          </button>
        </div>
      </div>

      {/* 队列滚动区 (GPU 视窗裁剪加速，隐藏横纵滚动条) */}
      <div className="queue-drawer-scroll-area" ref={scrollAreaRef}>
        {loading ? (
          <div className="queue-drawer-empty-state">
            <span className="queue-drawer-loading-dot" />
            <span>正在读取播放队列...</span>
          </div>
        ) : songs.length === 0 ? (
          <div className="queue-drawer-empty-state">
            <QueueEmptyGraphic />
            <span className="queue-empty-title">当前播放队列为空</span>
            <span className="queue-empty-subtitle">可在「曲库中心」点击「+」按键添加歌曲</span>
          </div>
        ) : (
          <div className="queue-track-list">
            {songs.map((song, index) => {
              const isCurrent = isSongActive(song)
              const hasImgError = imgErrors[song.id || String(song.queueId)]
              const isFav = favorites.has(song.file)
              const isDragging = draggedIndex === index
              const isOver = dragOverIndex === index
              const dropCls = isOver ? (dropPosition === 'top' ? 'drag-over-top' : 'drag-over-bottom') : ''

              const indexStr = String((song.pos ?? index) + 1).padStart(2, '0')

              return (
                <div
                  key={song.queueId ?? song.id ?? `${song.file}_${index}`}
                  ref={isCurrent ? activeItemRef : null}
                  className={`queue-track-item ${isCurrent ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${dropCls}`}
                  onClick={() => handleSongClick(song)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  title={`点击播放: ${song.title} - ${song.artist}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSongClick(song)
                    }
                  }}
                >
                  {/* 序号与拖拽手柄切换区 */}
                  <div className="queue-track-index-col">
                    <span className="queue-track-index-num">{indexStr}</span>
                    <span className="queue-track-grip">
                      <DragGripIcon />
                    </span>
                  </div>

                  {/* 专辑封面与播放动效 */}
                  <div className="queue-track-cover-wrapper">
                    {!hasImgError ? (
                      <img
                        src={song.coverUrl}
                        alt={song.album || song.title}
                        className="queue-track-cover-img"
                        loading="lazy"
                        draggable={false}
                        onError={() => handleImageError(song.id || String(song.queueId))}
                      />
                    ) : (
                      <div className="queue-track-cover-fallback">
                        <VinylDiscIcon />
                      </div>
                    )}
                    {isCurrent && <EqualizerMiniBars />}
                  </div>

                  {/* 中间信息区: 第一行标题，第二行 SQ徽标与歌手专辑 */}
                  <div className="queue-track-info">
                    <div className="queue-track-title-row">
                      <span className="queue-track-title" title={song.title}>
                        {song.title}
                      </span>
                    </div>

                    <div className="queue-track-meta-row">
                      <span className={`queue-quality-badge badge-${(song.quality || 'STD').toLowerCase()}`}>
                        {song.quality || 'STD'}
                      </span>
                      <span
                        className="queue-track-artist-album"
                        title={`${song.artist}${song.album && song.album !== '未知专辑' ? ` - ${song.album}` : ''}`}
                      >
                        {song.artist}
                        {song.album && song.album !== '未知专辑' ? ` · ${song.album}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* 时长 */}
                  <span className="queue-track-duration">
                    {formatDuration(song.duration)}
                  </span>

                  {/* 右侧交互按键组: 红心收藏与移除单曲 */}
                  <div
                    className="queue-track-actions"
                    draggable={false}
                    onDragStart={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`queue-track-fav-btn ${isFav ? 'favorited' : ''}`}
                      onClick={(e) => handleToggleFavorite(e, song)}
                      title={isFav ? '取消红心收藏' : '添加红心收藏'}
                      aria-label="红心收藏"
                    >
                      <HeartIcon filled={isFav} />
                    </button>

                    <button
                      type="button"
                      className="queue-track-remove-btn"
                      onClick={(e) => handleRemoveSong(e, song, index)}
                      title="从队列中移除"
                      aria-label="移除曲目"
                    >
                      <RemoveIcon />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
