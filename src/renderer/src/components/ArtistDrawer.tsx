import { useEffect, useState, useMemo, useRef, useCallback, type MouseEvent, type KeyboardEvent } from 'react'
import type { MpdSong, MpdStatus } from '../../../types/music'
import './ArtistDrawer.css'

/**
 * 艺人分组模型
 */
export interface ArtistGroup {
  artist: string
  songs: MpdSong[]
  albumCount: number
  totalDuration: number
  coverSong?: MpdSong
}

/**
 * 艺人抽屉组件属性
 */
export interface ArtistDrawerProps {
  currentSong?: MpdSong | null
  currentSongId?: string
  onPlaySong?: (song: MpdSong) => void
  onAddToQueue?: (song: MpdSong) => void
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

/**
 * 搜索放大镜矢量图标
 */
function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

/**
 * 纯线条艺人矢量占位图标 (制表人像)
 */
function ArtistAvatarPlaceholderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/**
 * 播放矢量图标
 */
function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

/**
 * 优雅的黑胶唱片矢量占位图标
 */
function VinylDiscIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.45" />
      <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="2 2" />
      <circle cx="16" cy="16" r="6.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="16" cy="16" r="1.4" fill="#6ee7b7" />
    </svg>
  )
}

/**
 * 悬浮胶囊第三按键：艺人分类抽屉组件 (ArtistDrawer)
 *
 * 核心架构:
 * 1. 双级钻取 (Drill-Down: 艺人总览列表 ⟷ 艺人名下曲目详情)
 * 2. 前端纯内存极速聚合并根据首曲内嵌提取圆形头像
 * 3. 单曲列表无缝集成 + / - 队列二态开关与 MPD 全局双向同步
 * 4. 动静分离与 60fps 原生手势滚动
 */
export default function ArtistDrawer({
  currentSong,
  currentSongId,
  onPlaySong,
  onAddToQueue
}: ArtistDrawerProps) {
  const [songs, setSongs] = useState<MpdSong[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArtist, setSelectedArtist] = useState<ArtistGroup | null>(null)
  const [queuedSongs, setQueuedSongs] = useState<Map<string, MpdSong>>(new Map())
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})

  const isMountedRef = useRef(true)
  const syncSeqRef = useRef<number>(0)
  // 批量操作互斥锁 (与歌单整单播放/入队口径一致, 防连点并发)
  const isEnqueueingRef = useRef(false)
  const isPlayingEntireRef = useRef(false)
  const clickLockRef = useRef<Record<string, boolean>>({})
  const pendingOpsRef = useRef<Map<string, 'add' | 'remove'>>(new Map())
  const lastPlaylistLenRef = useRef<number>(-1)
  const lastPlaylistVerRef = useRef<number>(-1)

  // 1. 获取全量本地曲库
  useEffect(() => {
    isMountedRef.current = true

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
        console.error('[lpip-player:artist] 获取曲库失败:', err)
        if (isMountedRef.current) setLoading(false)
      }
    }

    fetchSongs()

    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 2. 同步 MPD 当前实时播放队列 (维护二态开关状态)
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
        for (const [file, op] of pendingOpsRef.current.entries()) {
          if (op === 'add') {
            if (!map.has(file)) map.set(file, { id: file, file } as MpdSong)
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
      console.error('[lpip-player:artist] 同步队列失败:', err)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    syncQueue()

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

    const handleQueueChanged = (): void => {
      if (isMounted) syncQueue()
    }
    window.addEventListener('lpip:queue-changed', handleQueueChanged)

    // 键盘无障碍: 详情层 Escape/Backspace 返回总览 (输入编辑态让输入框自有 onKeyDown 先行)
    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      const active = document.activeElement
      const isEditing = Boolean(
        active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            (active as HTMLElement).isContentEditable)
      )
      if (e.key === 'Escape') {
        if (selectedArtist !== null) {
          if (isEditing) return
          e.stopImmediatePropagation()
          e.preventDefault()
          setSelectedArtist(null)
        }
      } else if (e.key === 'Backspace') {
        if (selectedArtist !== null && !isEditing) {
          e.stopImmediatePropagation()
          e.preventDefault()
          setSelectedArtist(null)
        }
      }
    }
    // 捕获阶段优先拦截, 防止外层胶囊整栏误收起
    window.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      isMounted = false
      unsubscribe?.()
      window.removeEventListener('lpip:queue-changed', handleQueueChanged)
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [syncQueue, selectedArtist])

  // 3. 将全量曲库按歌手名称进行纯内存极速聚合
  const artistGroups = useMemo<ArtistGroup[]>(() => {
    const map = new Map<string, { songs: MpdSong[]; albums: Set<string>; coverSong?: MpdSong; totalSecs: number }>()

    for (const song of songs) {
      const artistName = (song.artist || '未知艺人').trim() || '未知艺人'
      let group = map.get(artistName)
      if (!group) {
        group = { songs: [], albums: new Set(), totalSecs: 0 }
        map.set(artistName, group)
      }
      group.songs.push(song)
      if (song.album) group.albums.add(song.album)
      group.totalSecs += song.duration || 0
      if (!group.coverSong && song.file) {
        group.coverSong = song
      }
    }

    const list: ArtistGroup[] = []
    for (const [artist, val] of map.entries()) {
      list.push({
        artist,
        songs: val.songs,
        albumCount: val.albums.size,
        totalDuration: val.totalSecs,
        coverSong: val.coverSong
      })
    }

    // 统一按首字母 / 中文拼音 A-Z 升序排布
    list.sort((a, b) => a.artist.localeCompare(b.artist, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))

    return list
  }, [songs])

  // 4. 搜索过滤
  const filteredArtists = useMemo<ArtistGroup[]>(() => {
    if (!searchQuery.trim()) return artistGroups
    const q = searchQuery.trim().toLowerCase()
    return artistGroups.filter((g) => g.artist.toLowerCase().includes(q))
  }, [artistGroups, searchQuery])

  // 判断指定曲目是否已在 MPD 播放队列中
  const isQueued = useCallback(
    (song: MpdSong): boolean => {
      if (!song) return false
      if (song.file && queuedSongs.has(song.file)) return true
      if (song.id && queuedSongs.has(song.id)) return true
      return false
    },
    [queuedSongs]
  )

  // 判断曲目是否正在播放
  const isSongActive = useCallback(
    (song: MpdSong): boolean => {
      if (currentSong?.id && song.id && currentSong.id === song.id) return true
      if (currentSong?.file && song.file && currentSong.file === song.file) return true
      if (currentSongId && (song.id === currentSongId || song.file === currentSongId)) return true
      return false
    },
    [currentSong, currentSongId]
  )

  // 播放指定单曲
  const handlePlaySong = (song: MpdSong): void => {
    if (onPlaySong) {
      onPlaySong(song)
    }
  }

  // 播放某个艺人的全部单曲 (互斥锁防连点并发, 跳过已在队列曲目避免主进程重复灌入)
  const handlePlayArtist = async (e: MouseEvent, group: ArtistGroup): Promise<void> => {
    e.stopPropagation()
    if (!group.songs.length || isPlayingEntireRef.current) return
    isPlayingEntireRef.current = true
    try {
      const first = group.songs[0]
      if (onPlaySong) {
        onPlaySong(first)
      } else if (window.electronAPI?.mpd) {
        await window.electronAPI.mpd.play(first.file)
      }
      // 将该艺人后续歌曲依次追加至播放队列
      if (window.electronAPI?.mpd && group.songs.length > 1) {
        for (let i = 1; i < group.songs.length; i++) {
          if (isQueued(group.songs[i])) continue
          await window.electronAPI.mpd.addToQueue(group.songs[i].file)
        }
        window.dispatchEvent(new CustomEvent('lpip:queue-changed'))
      }
    } catch (err) {
      console.error('[lpip-player:artist] 播放艺人全部歌曲失败:', err)
    } finally {
      setTimeout(() => {
        isPlayingEntireRef.current = false
      }, 500)
    }
  }

  // 一键将该艺人全部单曲追加至队列 (互斥锁防连点并发, 已在队列曲目跳过)
  const handleEnqueueAll = async (e: MouseEvent, group: ArtistGroup): Promise<void> => {
    e.stopPropagation()
    if (isEnqueueingRef.current) return
    isEnqueueingRef.current = true
    try {
      if (window.electronAPI?.mpd) {
        for (const s of group.songs) {
          if (!isQueued(s)) {
            await window.electronAPI.mpd.addToQueue(s.file)
          }
        }
        window.dispatchEvent(new CustomEvent('lpip:queue-changed'))
        syncQueue()
      }
    } catch (err) {
      console.error('[lpip-player:artist] 全部追加至队列失败:', err)
    } finally {
      setTimeout(() => {
        isEnqueueingRef.current = false
      }, 500)
    }
  }

  // 二态开关点击处理 (+ 添加 / - 移出)
  const handleToggleQueue = async (e: MouseEvent, song: MpdSong): Promise<void> => {
    e.stopPropagation()
    const songKey = song.file || song.id
    if (!songKey) return

    if (clickLockRef.current[songKey]) return
    clickLockRef.current[songKey] = true

    const currentlyQueued = isQueued(song)

    if (!currentlyQueued) {
      // 乐观添加
      pendingOpsRef.current.set(songKey, 'add')
      setQueuedSongs((prev) => {
        const next = new Map(prev)
        next.set(songKey, song)
        return next
      })

      try {
        if (onAddToQueue) {
          onAddToQueue(song)
        } else if (window.electronAPI?.mpd) {
          await window.electronAPI.mpd.addToQueue(song.file)
        }
      } catch (err) {
        console.error('[lpip-player:artist] 添加至队列失败:', err)
        pendingOpsRef.current.delete(songKey)
        syncQueue()
      } finally {
        setTimeout(() => {
          delete clickLockRef.current[songKey]
          pendingOpsRef.current.delete(songKey)
        }, 300)
      }
    } else {
      // 乐观移出
      pendingOpsRef.current.set(songKey, 'remove')
      setQueuedSongs((prev) => {
        const next = new Map(prev)
        next.delete(songKey)
        if (song.id) next.delete(song.id)
        return next
      })

      try {
        if (window.electronAPI?.mpd) {
          const queueItem = queuedSongs.get(songKey) || song
          await window.electronAPI.mpd.removeQueueItem(queueItem.pos ?? 0, queueItem.queueId, song.file)
          window.dispatchEvent(new CustomEvent('lpip:queue-changed'))
        }
      } catch (err) {
        console.error('[lpip-player:artist] 从队列移出失败:', err)
        pendingOpsRef.current.delete(songKey)
        syncQueue()
      } finally {
        setTimeout(() => {
          delete clickLockRef.current[songKey]
          pendingOpsRef.current.delete(songKey)
        }, 300)
      }
    }
  }

  // 封面加载失败
  const handleImageError = (key: string): void => {
    setImgErrors((prev) => ({ ...prev, [key]: true }))
  }

  return (
    <div className="artist-drawer-wrapper">
      {/* 视图 1: 艺人总览列表 */}
      {!selectedArtist && (
        <>
          {/* 顶部工具栏: 搜索、排序与统计 */}
          <div className="artist-drawer-toolbar">
            <div className="artist-search-box">
              <span className="artist-search-icon">
                <SearchIcon />
              </span>
              <input
                type="text"
                className="artist-search-input"
                placeholder="搜索艺人 / 歌手..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="artist-toolbar-actions">
              <span className="artist-count-badge">
                {filteredArtists.length} 位
              </span>
            </div>
          </div>

          {/* 滚动列表区 (液态玻璃微光滑动条) */}
          <div className="artist-drawer-scroll-area liquid-scrollbar">
            {loading ? (
              <div className="artist-empty-state">
                <span>曲库歌手整理中...</span>
              </div>
            ) : filteredArtists.length === 0 ? (
              <div className="artist-empty-state">
                <span>未找到匹配的艺人</span>
              </div>
            ) : (
              <div className="artist-list">
                {filteredArtists.map((group) => {
                  const coverKey = group.coverSong?.id || group.coverSong?.file || group.artist
                  const hasImgError = imgErrors[coverKey]
                  const coverUrl = group.coverSong && !hasImgError
                    ? `app-media://cover/${encodeURIComponent(group.coverSong.file)}`
                    : null
                  const isCurrentArtist = currentSong?.artist?.trim() === group.artist.trim()

                  return (
                    <div
                      key={group.artist}
                      className={`artist-item ${isCurrentArtist ? 'active' : ''}`}
                      onClick={() => setSelectedArtist(group)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedArtist(group)
                        }
                      }}
                    >
                      {/* 圆形头像 (44px) */}
                      <div className="artist-avatar-wrapper">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={group.artist}
                            className="artist-avatar-img"
                            loading="lazy"
                            onError={() => handleImageError(coverKey)}
                          />
                        ) : (
                          <div className="artist-avatar-placeholder">
                            <ArtistAvatarPlaceholderIcon />
                          </div>
                        )}
                      </div>

                      {/* 中段信息 */}
                      <div className="artist-info">
                        <span className="artist-name">{group.artist}</span>
                        <span className="artist-subtext">
                          {group.songs.length} 首歌曲 · {group.albumCount} 张专辑
                        </span>
                      </div>

                      {/* 右侧操作: 一键播放与进入箭头 */}
                      <div className="artist-actions">
                        <button
                          type="button"
                          className="artist-play-btn"
                          onClick={(e) => handlePlayArtist(e, group)}
                          title={`播放 ${group.artist} 全部曲目`}
                          aria-label="全部播放"
                        >
                          <PlayIcon />
                        </button>
                        <span className="artist-arrow-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 视图 2: 艺人单曲详情页 */}
      {selectedArtist && (
        <div className="artist-detail-wrapper">
          {/* 顶部 Hero 导航卡片 */}
          <header className="artist-detail-hero">
            <button
              type="button"
              className="artist-back-btn"
              onClick={() => setSelectedArtist(null)}
              title="返回全部艺人列表"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>全部艺人</span>
            </button>

            <div className="artist-detail-header-body">
              {/* 大头像 (52px) */}
              <div className="artist-detail-avatar">
                {selectedArtist.coverSong && !imgErrors[selectedArtist.coverSong.id || selectedArtist.coverSong.file] ? (
                  <img
                    src={`app-media://cover/${encodeURIComponent(selectedArtist.coverSong.file)}`}
                    alt={selectedArtist.artist}
                    className="artist-avatar-img"
                    onError={() => handleImageError(selectedArtist.coverSong!.id || selectedArtist.coverSong!.file)}
                  />
                ) : (
                  <div className="artist-avatar-placeholder">
                    <ArtistAvatarPlaceholderIcon />
                  </div>
                )}
              </div>

              <div className="artist-detail-header-info">
                <h3 className="artist-detail-name">{selectedArtist.artist}</h3>
                <span className="artist-detail-stats">
                  共 {selectedArtist.songs.length} 首作品 · {selectedArtist.albumCount} 张专辑
                </span>
              </div>
            </div>

            {/* 顶部快捷操作按键组 */}
            <div className="artist-detail-actions">
              <button
                type="button"
                className="artist-hero-btn primary"
                onClick={(e) => handlePlayArtist(e, selectedArtist)}
                title="立即播放该艺人全部曲目"
              >
                <PlayIcon />
                <span>播放全部</span>
              </button>
              <button
                type="button"
                className="artist-hero-btn secondary"
                onClick={(e) => handleEnqueueAll(e, selectedArtist)}
                title="将该艺人曲目全部加入播放队列"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>全部入队</span>
              </button>
            </div>
          </header>

          {/* 单曲列表区 (液态玻璃微光滑动条) */}
          <div className="artist-drawer-scroll-area liquid-scrollbar">
            <div className="artist-song-list">
              {selectedArtist.songs.map((song, idx) => {
                const isCurrent = isSongActive(song)
                const queued = isQueued(song)
                const coverKey = song.id || song.file
                const hasImgError = imgErrors[coverKey]
                const coverUrl = !hasImgError && song.file
                  ? `app-media://cover/${encodeURIComponent(song.file)}`
                  : null

                return (
                  <div
                    key={song.id || `${song.file}_${idx}`}
                    className={`artist-song-item ${isCurrent ? 'active' : ''}`}
                    onClick={() => handlePlaySong(song)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handlePlaySong(song)
                      }
                    }}
                  >
                    {/* 序号 */}
                    <span className="artist-song-index">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    {/* 封面缩略图 */}
                    <div className="artist-song-cover-box">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={song.title}
                          className="artist-song-cover-img"
                          loading="lazy"
                          onError={() => handleImageError(coverKey)}
                        />
                      ) : (
                        <VinylDiscIcon />
                      )}
                    </div>

                    {/* 歌曲信息与音质徽标 (整洁化: 专辑名已隐藏, 仅保留标题与徽标) */}
                    <div className="artist-song-meta">
                      <span className="artist-song-title">{song.title}</span>
                      <div className="artist-song-subinfo">
                        <span className={`artist-badge-${(song.quality || 'STD').toLowerCase()}`}>{song.quality || 'STD'}</span>
                      </div>
                    </div>

                    {/* 时长 */}
                    <span className="artist-song-duration">
                      {formatDuration(song.duration)}
                    </span>

                    {/* 二态开关 (+ 添加至队列 / - 从队列移出) */}
                    <button
                      type="button"
                      className={`artist-song-toggle-btn ${queued ? 'queued' : ''}`}
                      onClick={(e) => handleToggleQueue(e, song)}
                      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                      title={queued ? '从播放队列移出' : '添加至播放队列'}
                      aria-label={queued ? '移出队列' : '加入队列'}
                    >
                      {queued ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
