import { useEffect, useState, useMemo, useRef, useCallback, type MouseEvent, type KeyboardEvent } from 'react'
import type { MpdSong, MpdStatus } from '../../../types/music'
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
  // MPD 播放队列数据映射 (以 file 与 id 双键索引，保证 O(1) 匹配)
  const [queuedSongs, setQueuedSongs] = useState<Map<string, MpdSong>>(new Map())
  const lastPlaylistLenRef = useRef<number>(-1)
  const lastPlaylistVerRef = useRef<number>(-1)
  const syncSeqRef = useRef<number>(0)
  const clickLockRef = useRef<Set<string>>(new Set())
  const pendingOpsRef = useRef<Map<string, 'add' | 'remove'>>(new Map())
  const isMountedRef = useRef<boolean>(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 加载本地曲库
  useEffect(() => {
    const fetchSongs = async (): Promise<void> => {
      try {
        if (window.electronAPI?.mpd) {
          const list = await window.electronAPI.mpd.getLibrary()
          if (isMountedRef.current) {
            setSongs(list)
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('[lpip-player:ui] 获取曲库失败:', err)
        if (isMountedRef.current) setLoading(false)
      }
    }

    fetchSongs()
  }, [])

  // 极速同步 MPD 当前实时播放队列 (支持版本序列锁与乐观状态锁定，杜绝闪烁与乱序)
  const syncQueue = useCallback(async (): Promise<void> => {
    const seq = ++syncSeqRef.current
    try {
      if (window.electronAPI?.mpd) {
        const [queue, status] = await Promise.all([
          window.electronAPI.mpd.getQueue(),
          window.electronAPI.mpd.getStatus()
        ])
        if (!isMountedRef.current || seq !== syncSeqRef.current) return

        const map = new Map<string, MpdSong>()
        for (const item of queue) {
          if (item.file) map.set(item.file, item)
          if (item.id) map.set(item.id, item)
        }
        // 维持尚在执行中的乐观状态，避免在 500ms 轮询间隙发生按键闪烁
        for (const [file, op] of pendingOpsRef.current.entries()) {
          if (op === 'add') {
            if (!map.has(file)) {
              map.set(file, { id: file, file } as MpdSong)
            }
          } else if (op === 'remove') {
            const existing = map.get(file)
            if (existing?.id) map.delete(existing.id)
            map.delete(file)
          }
        }
        if (isMountedRef.current) {
          setQueuedSongs(map)
          lastPlaylistLenRef.current = queue.length
          if (status?.playlistVersion !== undefined) {
            lastPlaylistVerRef.current = status.playlistVersion
          }
        }
      }
    } catch (err) {
      console.error('[lpip-player:library] 同步播放队列失败:', err)
    }
  }, [])

  // 监听 MPD 播放器状态广播与全局队列事件，实现双向响应式同步
  useEffect(() => {
    let isMounted = true

    syncQueue()

    // 监听 MPD 状态广播：当队列长度或版本号改变时自动同步
    const unsubscribe = window.electronAPI?.mpd.onStatusChange((status: MpdStatus) => {
      if (!isMounted) return
      const lenChanged = status.playlistLength !== lastPlaylistLenRef.current
      const verChanged =
        status.playlistVersion !== undefined && status.playlistVersion !== lastPlaylistVerRef.current
      if (lenChanged || verChanged) {
        if (status.playlistVersion !== undefined) {
          lastPlaylistVerRef.current = status.playlistVersion
        }
        syncQueue()
      }
    })

    // 监听全局队列变化自定义事件 (跨组件极速响应)
    const handleQueueChanged = (): void => {
      if (isMounted) syncQueue()
    }
    window.addEventListener('lpip:queue-changed', handleQueueChanged)

    return () => {
      isMounted = false
      unsubscribe?.()
      window.removeEventListener('lpip:queue-changed', handleQueueChanged)
    }
  }, [syncQueue])

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

  // 点击切换队列状态 (二态开关: 未在队列为 +，点击追加并切换为 -；已在队列为 -，点击移出并切换为 +)
  const handleToggleQueue = async (
    e: MouseEvent | KeyboardEvent,
    song: MpdSong
  ): Promise<void> => {
    e.stopPropagation()
    if (!window.electronAPI?.mpd) return

    // 避免对同一首歌曲连续点击产生并发竞争 (操作互斥锁)
    if (clickLockRef.current.has(song.file)) return
    clickLockRef.current.add(song.file)

    const isCurrentlyQueued = queuedSongs.has(song.file) || (song.id ? queuedSongs.has(song.id) : false)

    if (isCurrentlyQueued) {
      // ------------------------------------------------------------
      // 状态 B -> 状态 A: 从播放队列移出
      // ------------------------------------------------------------
      pendingOpsRef.current.set(song.file, 'remove')
      const queuedItem = queuedSongs.get(song.file) || (song.id ? queuedSongs.get(song.id) : undefined)

      // 乐观更新：即刻切换按键为状态 A (+)
      setQueuedSongs((prev) => {
        const next = new Map(prev)
        next.delete(song.file)
        if (song.id) next.delete(song.id)
        if (queuedItem?.id) next.delete(queuedItem.id)
        return next
      })

      try {
        const ok = await window.electronAPI.mpd.removeQueueItem(
          queuedItem?.pos ?? -1,
          queuedItem?.queueId,
          song.file
        )
        if (ok) {
          window.dispatchEvent(new CustomEvent('lpip:queue-changed'))
        }
      } catch (err) {
        console.error('[lpip-player:library] 移出播放队列失败:', err)
      } finally {
        // IPC 飞行操作已返回，移除 pendingOps 记录以允许 syncQueue 依据真实状态对齐（含失败回滚）
        pendingOpsRef.current.delete(song.file)
        try {
          await syncQueue()
        } finally {
          clickLockRef.current.delete(song.file)
        }
      }
    } else {
      // ------------------------------------------------------------
      // 状态 A -> 状态 B: 追加至播放队列
      // ------------------------------------------------------------
      pendingOpsRef.current.set(song.file, 'add')

      // 乐观更新：即刻切换按键为状态 B (-)
      setQueuedSongs((prev) => {
        const next = new Map(prev)
        next.set(song.file, song)
        if (song.id) next.set(song.id, song)
        return next
      })

      try {
        const res = await window.electronAPI.mpd.addToQueue(song.file)
        if (res.success) {
          onAddToQueue?.(song)
          window.dispatchEvent(new CustomEvent('lpip:queue-changed'))
        }
      } catch (err) {
        console.error('[lpip-player:library] 添加至播放队列失败:', err)
      } finally {
        // IPC 飞行操作已返回，移除 pendingOps 记录以允许 syncQueue 依据真实状态对齐（含失败回滚）
        pendingOpsRef.current.delete(song.file)
        try {
          await syncQueue()
        } finally {
          clickLockRef.current.delete(song.file)
        }
      }
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

      {/* 音源列表主体: 支持 content-visibility 现代 GPU 虚拟视窗裁剪与液态玻璃微光滑动条 */}
      <div className="music-library-scroll-area liquid-scrollbar">
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
              const isQueued = queuedSongs.has(song.file) || (song.id ? queuedSongs.has(song.id) : false)

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

                  {/* 右侧微圆环队列二态开关按键区: 状态 A 为 +，状态 B 为 - */}
                  <div className="music-track-actions">
                    <button
                      type="button"
                      className={`music-track-add-btn ${isQueued ? 'in-queue' : ''}`}
                      onClick={(e) => handleToggleQueue(e, song)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                      title={isQueued ? '从播放队列移出' : '添加至播放队列'}
                      aria-label={isQueued ? '从播放队列移出' : '添加至播放队列'}
                      aria-pressed={isQueued}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="music-track-btn-icon"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" className="music-track-btn-line-h" />
                        <line x1="12" y1="5" x2="12" y2="19" className="music-track-btn-line-v" />
                      </svg>
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
