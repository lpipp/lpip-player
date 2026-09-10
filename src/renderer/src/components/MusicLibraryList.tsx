import { useEffect, useState, useMemo, useRef, type MouseEvent } from 'react'
import type { MpdSong } from '../../../types/music'
import './MusicLibraryList.css'

/**
 * 曲库列表组件属性
 */
export interface MusicLibraryListProps {
  /** 当前正在播放的曲目 ID / file */
  currentSongId?: string
  /** 点击播放曲目回调 */
  onPlaySong?: (song: MpdSong) => void
  /** 添加至播放队列回调 */
  onAddToQueue?: (song: MpdSong) => void
}

/**
 * 优雅的黑胶唱片矢量占位图标 (无封面或加载中时优雅呈现)
 */
function VinylDiscIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="music-track-disc-icon"
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
 * 刷新重扫矢量图标
 */
function RefreshIcon({ isSpinning }: { isSpinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`music-lib-refresh-icon ${isSpinning ? 'spinning' : ''}`}
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  )
}

/**
 * 搜索放大镜矢量图标
 */
function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

/**
 * 清除输入矢量图标
 */
function ClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/**
 * 悬浮胶囊“曲库中心”子菜单展示列表组件
 *
 * 核心特征:
 * 1. 严格排版对齐设计图 (左侧封面 + 居中标题与 SQ 徽标/歌手专辑 + 右侧圆环加号)
 * 2. 动静分离铁律: 宿主卡片整像素物理定位，::before 伪元素承载磨砂微光与等比缩放
 * 3. 集成 MPD 真实音频源，支持关键字极速过滤与后端刷新
 */
export default function MusicLibraryList({
  currentSongId,
  onPlaySong,
  onAddToQueue
}: MusicLibraryListProps) {
  const [songs, setSongs] = useState<MpdSong[]>([])
  const [loading, setLoading] = useState(true)
  const [isRescanning, setIsRescanning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({})
  const [duplicateMap, setDuplicateMap] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // 加载本地曲库
  useEffect(() => {
    let isMounted = true

    const fetchSongs = async (): Promise<void> => {
      try {
        if (window.electronAPI?.mpd) {
          const list = await window.electronAPI.mpd.getLibrary()
          if (isMounted) {
            setSongs(list)
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('[lpip-player:ui] 获取曲库失败:', err)
        if (isMounted) setLoading(false)
      }
    }

    fetchSongs()

    return () => {
      isMounted = false
    }
  }, [])

  // 触发 MPD 曲库重新扫描
  const handleRescan = async (e: MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (isRescanning) return
    setIsRescanning(true)
    try {
      if (window.electronAPI?.mpd) {
        const updated = await window.electronAPI.mpd.rescan()
        setSongs(updated)
      }
    } catch (err) {
      console.error('[lpip-player:ui] 重新扫描失败:', err)
    } finally {
      setIsRescanning(false)
    }
  }

  // 封面加载失败回退处理
  const handleImageError = (fileId: string): void => {
    setImgErrors((prev) => ({ ...prev, [fileId]: true }))
  }

  // 点击添加至播放队列 (严格去重约束: 不能有两首同样的歌，已在队列时明确提示)
  const handleAddClick = async (e: MouseEvent, song: MpdSong): Promise<void> => {
    e.stopPropagation()
    if (!window.electronAPI?.mpd) return

    const res = await window.electronAPI.mpd.addToQueue(song.file)

    // 若歌曲已在队列中：不重复添加，明确呈现“该歌曲已在队列”
    if (res.alreadyInQueue) {
      // 触发当前曲目按钮与徽标微光提示 (1.8s)
      setDuplicateMap((prev) => ({ ...prev, [song.id]: true }))
      setTimeout(() => {
        setDuplicateMap((prev) => ({ ...prev, [song.id]: false }))
      }, 1800)

      // 触发顶部液态玻璃 Toast 提示 (2s)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setToastMessage('该歌曲已在队列')
      toastTimerRef.current = setTimeout(() => {
        setToastMessage(null)
      }, 2000)
      return
    }

    if (res.success) {
      onAddToQueue?.(song)

      // 首次添加成功：显示 1.5s 翡翠绿打勾反馈
      setAddedMap((prev) => ({ ...prev, [song.id]: true }))
      setTimeout(() => {
        setAddedMap((prev) => ({ ...prev, [song.id]: false }))
      }, 1500)
    }
  }

  // 点击单曲触发播放
  const handleSongClick = (song: MpdSong): void => {
    onPlaySong?.(song)
  }

  // 内存极速过滤搜索
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return songs
    return songs.filter((s) => {
      return (
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
      )
    })
  }, [songs, searchQuery])

  return (
    <div className="music-library-container">
      {/* 轻量液态玻璃 Toast 浮层提示: "该歌曲已在队列" */}
      {toastMessage && (
        <div className="music-library-toast" role="status">
          <span className="toast-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <span className="toast-text">{toastMessage}</span>
        </div>
      )}

      {/* 搜索与曲库信息微控制栏 */}
      <div className="music-library-toolbar">
        <div className="music-search-box">
          <span className="music-search-icon">
            <SearchIcon />
          </span>
          <input
            type="text"
            className="music-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索歌曲、歌手或专辑..."
            aria-label="搜索曲库"
          />
          {searchQuery && (
            <button
              type="button"
              className="music-search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="清除输入"
              aria-label="清除输入"
            >
              <ClearIcon />
            </button>
          )}
        </div>

        {/* 顶部统计与重新扫描按键 */}
        <div className="music-library-stats-row">
          <span className="music-library-count">
            {searchQuery ? `匹配 ${filteredSongs.length} 首 / 共 ${songs.length} 首` : `共 ${songs.length} 首音源`}
          </span>
          <button
            type="button"
            className={`music-library-rescan-btn ${isRescanning ? 'loading' : ''}`}
            onClick={handleRescan}
            title="重新扫描本地 MPD 曲库"
            aria-label="重新扫描本地 MPD 曲库"
          >
            <RefreshIcon isSpinning={isRescanning} />
            <span>{isRescanning ? '扫描中...' : '刷新'}</span>
          </button>
        </div>
      </div>

      {/* 音源列表主体: 支持 content-visibility 现代 GPU 虚拟视窗裁剪，零卡顿 */}
      <div className="music-library-scroll-area">
        {loading ? (
          <div className="music-library-empty-state">
            <span className="music-library-loading-dot" />
            <span>正在读取 MPD 曲库...</span>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="music-library-empty-state">
            <span>未检索到匹配的本地音源</span>
          </div>
        ) : (
          <div className="music-track-list">
            {filteredSongs.map((song) => {
              const isCurrent = currentSongId === song.id || currentSongId === song.file
              const hasImgError = imgErrors[song.id]
              const isAdded = addedMap[song.id]

              return (
                <div
                  key={song.id}
                  className={`music-track-item ${isCurrent ? 'active' : ''}`}
                  onClick={() => handleSongClick(song)}
                  title={`点击播放: ${song.title} - ${song.artist}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSongClick(song)
                    }
                  }}
                >
                  {/* 左侧正方形专辑封面 (44px × 44px, 带圆角与黑胶占位回退) */}
                  <div className="music-track-cover-wrapper">
                    {!hasImgError ? (
                      <img
                        src={song.coverUrl}
                        alt={song.album || song.title}
                        className="music-track-cover-img"
                        loading="lazy"
                        draggable={false}
                        onError={() => handleImageError(song.id)}
                      />
                    ) : (
                      <div className="music-track-cover-fallback">
                        <VinylDiscIcon />
                      </div>
                    )}
                    {/* 正在播放时的微光脉冲指示 */}
                    {isCurrent && <span className="music-track-playing-badge" />}
                  </div>

                  {/* 中间信息区: 第一行标题，第二行 SQ 徽标 + 歌手与专辑 */}
                  <div className="music-track-info">
                    <div className="music-track-title-row">
                      <span className="music-track-title" title={song.title}>
                        {song.title}
                      </span>
                    </div>

                    <div className="music-track-meta-row">
                      {/* 音质等级徽标 (严格复刻参考设计中的 SQ 浅蓝圆角标签) */}
                      <span className={`music-quality-badge badge-${song.quality.toLowerCase()}`}>
                        {song.quality}
                      </span>
                      {/* 歌手与专辑副文本 */}
                      <span
                        className="music-track-artist-album"
                        title={`${song.artist}${song.album && song.album !== '未知专辑' ? ` - ${song.album}` : ''}`}
                      >
                        {song.artist}
                        {song.album && song.album !== '未知专辑' ? ` - ${song.album}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* 右侧微圆环加号按键区: 加入播放队列与去重反馈 */}
                  <div className="music-track-actions">
                    {duplicateMap[song.id] && (
                      <span className="music-track-duplicate-badge">该歌曲已在队列</span>
                    )}
                    <button
                      type="button"
                      className={`music-track-add-btn ${isAdded ? 'added' : ''} ${duplicateMap[song.id] ? 'duplicate' : ''}`}
                      onClick={(e) => handleAddClick(e, song)}
                      title={duplicateMap[song.id] ? '该歌曲已在队列' : isAdded ? '已追加至当前队列' : '添加到播放队列'}
                      aria-label={duplicateMap[song.id] ? '该歌曲已在队列' : isAdded ? '已追加至当前队列' : '添加到播放队列'}
                    >
                      {duplicateMap[song.id] ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : isAdded ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
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
