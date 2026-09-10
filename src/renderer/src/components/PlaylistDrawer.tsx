import { useEffect, useState, useMemo, useRef, useCallback, type MouseEvent, type KeyboardEvent } from 'react'
import type { MpdPlaylist, MpdSong, MpdStatus } from '../../../types/music'
import './PlaylistDrawer.css'

/**
 * 歌单抽屉组件属性
 */
export interface PlaylistDrawerProps {
  currentSong?: MpdSong | null
  currentSongId?: string
  onPlaySong?: (song: MpdSong) => void
  onAddToQueue?: (song: MpdSong) => void
}

/**
 * 格式化时长秒数为 mm:ss
 */
function formatDuration(seconds?: number): string {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * 格式化总时长为更亲和的长文本 (如 "12 首 · 48 分钟")
 */
function formatTotalTime(seconds?: number): string {
  if (!seconds || Number.isNaN(seconds) || seconds <= 0) return '0 分钟'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} 分钟`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins > 0 ? `${hours} 小时 ${remMins} 分钟` : `${hours} 小时`
}

/**
 * 校验并清洗歌单名称 (与后端逻辑保持严密一致)
 */
function sanitizePlaylistInput(name: string): string {
  return name
    .trim()
    .replace(/[\r\n\t\0]/g, '')
    .replace(/[/\\]/g, '-')
    .replace(/["']/g, '')
    .replace(/^[.]+/, '')
    .replace(/\.m3u$/i, '')
    .trim()
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
 * 清除输入矢量图标
 */
function ClearIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/**
 * 加号矢量图标
 */
function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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
 * 编辑/重命名笔形矢量图标
 */
function EditPencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

/**
 * 垃圾桶删除矢量图标
 */
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

/**
 * 对勾成功矢量图标
 */
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
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
 * 悬浮胶囊第四按键：歌单抽屉组件 (PlaylistDrawer)
 *
 * 核心架构:
 * 1. 双级钻取 (Two-Tier Drill-Down: 歌单总览列表 ⟷ 歌单单曲详情)
 * 2. 歌单总览: 封面画册流展示、模糊检索、新建歌单、一键全单播放与平滑钻取
 * 3. 歌单详情: Hero 头部概览、全部播放、全部入队、从本地曲库向歌单添加歌曲、从歌单移出单曲
 * 4. 单曲列表: 无缝集成 + / - 队列二态开关与 MPD 全局双向同步
 * 5. 动静分离铁律与 5px 液态玻璃滑动条 (.liquid-scrollbar)
 */
export default function PlaylistDrawer({
  currentSong,
  currentSongId,
  onPlaySong,
  onAddToQueue
}: PlaylistDrawerProps) {
  // 歌单总览层状态
  const [playlists, setPlaylists] = useState<MpdPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // 歌单详情层状态
  const [selectedPlaylist, setSelectedPlaylist] = useState<MpdPlaylist | null>(null)
  const [playlistSongs, setPlaylistSongs] = useState<MpdSong[]>([])
  const [loadingSongs, setLoadingSongs] = useState(false)

  // 新建歌单状态
  const [isCreating, setIsCreating] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [createError, setCreateError] = useState('')

  // 重命名歌单状态
  const [renamingPlaylist, setRenamingPlaylist] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // 删除确认状态
  const [deletingPlaylist, setDeletingPlaylist] = useState<string | null>(null)

  // 向当前歌单添加单曲状态 (内嵌曲库选择器)
  const [isAddingSongs, setIsAddingSongs] = useState(false)
  const [librarySongs, setLibrarySongs] = useState<MpdSong[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [addSongQuery, setAddSongQuery] = useState('')
  const [pendingAddFiles, setPendingAddFiles] = useState<Set<string>>(new Set())
  const [removingIdx, setRemovingIdx] = useState<number | null>(null)

  // MPD 实时播放队列映射
  const [queuedSongs, setQueuedSongs] = useState<Map<string, MpdSong>>(new Map())
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})

  const isMountedRef = useRef(true)
  const syncSeqRef = useRef<number>(0)
  const clickLockRef = useRef<Record<string, boolean>>({})
  const pendingOpsRef = useRef<Map<string, 'add' | 'remove'>>(new Map())
  const isPlayingEntireRef = useRef(false)
  const isEnqueueingRef = useRef(false)
  const lastPlaylistLenRef = useRef<number>(-1)
  const lastPlaylistVerRef = useRef<number>(-1)
  const createInputRef = useRef<HTMLInputElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  // 1. 获取所有歌单概览
  const fetchPlaylists = useCallback(async (): Promise<void> => {
    try {
      if (window.electronAPI?.mpd) {
        const list = await window.electronAPI.mpd.getPlaylists()
        if (isMountedRef.current) {
          setPlaylists(list)
          setLoading(false)
        }
      } else {
        if (isMountedRef.current) setLoading(false)
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 获取歌单失败:', err)
      if (isMountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    fetchPlaylists()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchPlaylists])

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
      console.error('[lpip-player:playlist] 同步队列失败:', err)
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

    return () => {
      isMounted = false
      unsubscribe?.()
      window.removeEventListener('lpip:queue-changed', handleQueueChanged)
    }
  }, [syncQueue])

  // 3. 加载指定歌单详情单曲列表
  const loadPlaylistSongs = useCallback(async (playlistName: string): Promise<void> => {
    setLoadingSongs(true)
    try {
      if (window.electronAPI?.mpd) {
        const songs = await window.electronAPI.mpd.getPlaylistSongs(playlistName)
        if (isMountedRef.current) {
          setPlaylistSongs(songs)
          setSelectedPlaylist((prev) => {
            if (!prev || prev.name !== playlistName) return prev
            const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0)
            return {
              ...prev,
              songCount: songs.length,
              totalDuration,
              coverSong: songs[0]
            }
          })
          setLoadingSongs(false)
        }
      } else {
        if (isMountedRef.current) setLoadingSongs(false)
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 获取歌单曲目失败:', err)
      if (isMountedRef.current) setLoadingSongs(false)
    }
  }, [])

  // 4. 进入歌单详情
  const handleSelectPlaylist = (playlist: MpdPlaylist): void => {
    if (renamingPlaylist || deletingPlaylist) return
    setSelectedPlaylist(playlist)
    setIsAddingSongs(false)
    setPendingAddFiles(new Set())
    setAddSongQuery('')
    loadPlaylistSongs(playlist.name)
  }

  // 返回歌单总览
  const handleBackToOverview = (): void => {
    setSelectedPlaylist(null)
    setIsAddingSongs(false)
    setAddSongQuery('')
    setPendingAddFiles(new Set())
  }

  // 5. 模糊检索过滤
  const filteredPlaylists = useMemo<MpdPlaylist[]>(() => {
    if (!searchQuery.trim()) return playlists
    const q = searchQuery.trim().toLowerCase()
    return playlists.filter((p) => p.name.toLowerCase().includes(q))
  }, [playlists, searchQuery])

  // 6. 新建歌单
  const handleStartCreate = (): void => {
    setRenamingPlaylist(null)
    setDeletingPlaylist(null)
    setIsCreating(true)
    setNewPlaylistName('')
    setCreateError('')
    setTimeout(() => {
      createInputRef.current?.focus()
    }, 50)
  }

  const handleCancelCreate = (): void => {
    setIsCreating(false)
    setNewPlaylistName('')
    setCreateError('')
  }

  const handleConfirmCreate = async (): Promise<void> => {
    const trimmed = sanitizePlaylistInput(newPlaylistName)
    if (!trimmed) {
      setCreateError('歌单名称不能为空或特殊字符')
      return
    }
    if (playlists.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setCreateError('已存在同名歌单')
      return
    }

    try {
      if (window.electronAPI?.mpd) {
        const ok = await window.electronAPI.mpd.createPlaylist(trimmed)
        if (ok) {
          setIsCreating(false)
          setNewPlaylistName('')
          setCreateError('')
          setSearchQuery('')
          await fetchPlaylists()
          // 自动钻入新建的歌单方便用户添加单曲
          const newlyCreated: MpdPlaylist = {
            name: trimmed,
            songCount: 0,
            totalDuration: 0
          }
          handleSelectPlaylist(newlyCreated)
        } else {
          setCreateError('创建失败，名称可能包含冲突')
        }
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 创建歌单失败:', err)
      setCreateError('创建失败，请重试')
    }
  }

  // 7. 重命名歌单
  const handleStartRename = (e: MouseEvent, plName: string): void => {
    e.stopPropagation()
    setIsCreating(false)
    setDeletingPlaylist(null)
    setRenamingPlaylist(plName)
    setRenameValue(plName)
    setTimeout(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }, 50)
  }

  const handleConfirmRename = async (e: MouseEvent | KeyboardEvent): Promise<void> => {
    e.stopPropagation()
    if (!renamingPlaylist) return
    const trimmed = sanitizePlaylistInput(renameValue)
    if (!trimmed || trimmed === renamingPlaylist) {
      setRenamingPlaylist(null)
      return
    }
    if (playlists.some((p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.name !== renamingPlaylist)) {
      setRenamingPlaylist(null)
      return
    }
    try {
      if (window.electronAPI?.mpd) {
        const ok = await window.electronAPI.mpd.renamePlaylist(renamingPlaylist, trimmed)
        if (ok) {
          if (selectedPlaylist && selectedPlaylist.name === renamingPlaylist) {
            setSelectedPlaylist((prev) => (prev ? { ...prev, name: trimmed } : null))
          }
          setRenamingPlaylist(null)
          fetchPlaylists()
        } else {
          setRenamingPlaylist(null)
        }
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 重命名失败:', err)
      setRenamingPlaylist(null)
    }
  }

  // 8. 删除歌单
  const handleConfirmDelete = async (e: MouseEvent, plName: string): Promise<void> => {
    e.stopPropagation()
    try {
      if (window.electronAPI?.mpd) {
        const ok = await window.electronAPI.mpd.deletePlaylist(plName)
        if (ok) {
          if (selectedPlaylist && selectedPlaylist.name === plName) {
            setSelectedPlaylist(null)
            setIsAddingSongs(false)
          }
          setDeletingPlaylist(null)
          fetchPlaylists()
        }
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 删除歌单失败:', err)
      setDeletingPlaylist(null)
    }
  }

  // 9. 一键播放整个歌单
  const handlePlayEntirePlaylist = async (e: MouseEvent, pl: MpdPlaylist): Promise<void> => {
    e.stopPropagation()
    if (isPlayingEntireRef.current) return
    isPlayingEntireRef.current = true
    try {
      if (window.electronAPI?.mpd) {
        let targetSongs = playlistSongs
        if (selectedPlaylist?.name !== pl.name) {
          targetSongs = await window.electronAPI.mpd.getPlaylistSongs(pl.name)
        }
        if (!targetSongs.length) return

        const ok = await window.electronAPI.mpd.playPlaylist(pl.name)
        if (ok) {
          window.dispatchEvent(new CustomEvent('lpip:queue-changed'))
          if (onPlaySong && targetSongs.length > 0) {
            onPlaySong({
              ...targetSongs[0],
              pos: undefined,
              queueId: undefined
            })
          }
        }
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 播放整张歌单失败:', err)
    } finally {
      setTimeout(() => {
        isPlayingEntireRef.current = false
      }, 500)
    }
  }

  // 10. 一键全部追加至当前队列 (极速批量入队)
  const handleEnqueueEntirePlaylist = async (e: MouseEvent, pl: MpdPlaylist): Promise<void> => {
    e.stopPropagation()
    if (isEnqueueingRef.current) return
    isEnqueueingRef.current = true
    const targetName = pl?.name || selectedPlaylist?.name
    if (!targetName) {
      isEnqueueingRef.current = false
      return
    }
    try {
      if (window.electronAPI?.mpd) {
        await window.electronAPI.mpd.enqueuePlaylist(targetName)
        window.dispatchEvent(new CustomEvent('lpip:queue-changed'))
        syncQueue()
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 全部入队失败:', err)
    } finally {
      setTimeout(() => {
        isEnqueueingRef.current = false
      }, 500)
    }
  }

  // 11. 从本地曲库向当前歌单添加单曲
  const handleToggleAddSongsPanel = async (): Promise<void> => {
    const nextState = !isAddingSongs
    setIsAddingSongs(nextState)
    if (nextState && librarySongs.length === 0) {
      setLoadingLibrary(true)
      try {
        if (window.electronAPI?.mpd) {
          const list = await window.electronAPI.mpd.getLibrary()
          if (isMountedRef.current) {
            setLibrarySongs(list)
            setLoadingLibrary(false)
          }
        }
      } catch (err) {
        console.error('[lpip-player:playlist] 获取曲库单曲失败:', err)
        if (isMountedRef.current) setLoadingLibrary(false)
      }
    }
  }

  const handleAddSongToPlaylist = async (song: MpdSong): Promise<void> => {
    if (!selectedPlaylist || pendingAddFiles.has(song.file)) return
    setPendingAddFiles((prev) => new Set(prev).add(song.file))
    try {
      if (window.electronAPI?.mpd) {
        const ok = await window.electronAPI.mpd.addToPlaylist(selectedPlaylist.name, song.file)
        if (ok) {
          await loadPlaylistSongs(selectedPlaylist.name)
          fetchPlaylists()
        }
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 向歌单添加单曲失败:', err)
    } finally {
      if (isMountedRef.current) {
        setPendingAddFiles((prev) => {
          const next = new Set(prev)
          next.delete(song.file)
          return next
        })
      }
    }
  }

  // 12. 从当前歌单移出单曲
  const handleRemoveSongFromPlaylist = async (e: MouseEvent, _song: MpdSong, idx: number): Promise<void> => {
    e.stopPropagation()
    if (!selectedPlaylist || removingIdx !== null) return
    setRemovingIdx(idx)
    try {
      if (window.electronAPI?.mpd) {
        const ok = await window.electronAPI.mpd.removeFromPlaylist(selectedPlaylist.name, idx)
        if (ok) {
          await loadPlaylistSongs(selectedPlaylist.name)
          fetchPlaylists()
        }
      }
    } catch (err) {
      console.error('[lpip-player:playlist] 从歌单移出单曲失败:', err)
    } finally {
      if (isMountedRef.current) {
        setRemovingIdx(null)
      }
    }
  }

  // 13. 判断曲目是否已在队列中
  const isQueued = useCallback(
    (song: MpdSong): boolean => {
      if (!song) return false
      if (song.file && queuedSongs.has(song.file)) return true
      if (song.id && queuedSongs.has(song.id)) return true
      return false
    },
    [queuedSongs]
  )

  // 14. 判断曲目是否正在播放
  const isSongActive = useCallback(
    (song: MpdSong): boolean => {
      if (currentSong?.id && song.id && currentSong.id === song.id) return true
      if (currentSong?.file && song.file && currentSong.file === song.file) return true
      if (currentSongId && (song.id === currentSongId || song.file === currentSongId)) return true
      return false
    },
    [currentSong, currentSongId]
  )

  // 15. 点击播放某曲
  const handlePlaySong = (song: MpdSong): void => {
    if (onPlaySong) {
      // 传递前剔除 pos 与 queueId，避免 App.tsx 误当成当前播放队列槽位执行 playQueueItem
      onPlaySong({
        ...song,
        pos: undefined,
        queueId: undefined
      })
    }
  }

  // 16. 二态开关点击处理 (+ 添加 / - 移出)
  const handleToggleQueue = async (e: MouseEvent, song: MpdSong): Promise<void> => {
    e.stopPropagation()
    const songKey = song.file || song.id
    if (!songKey) return

    if (clickLockRef.current[songKey]) return
    clickLockRef.current[songKey] = true

    const currentlyQueued = isQueued(song)

    if (!currentlyQueued) {
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
        console.error('[lpip-player:playlist] 添加至队列失败:', err)
        pendingOpsRef.current.delete(songKey)
        syncQueue()
      } finally {
        setTimeout(() => {
          delete clickLockRef.current[songKey]
          pendingOpsRef.current.delete(songKey)
        }, 300)
      }
    } else {
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
        console.error('[lpip-player:playlist] 从队列移出失败:', err)
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

  const handleImageError = (key: string): void => {
    setImgErrors((prev) => ({ ...prev, [key]: true }))
  }

  // 过滤曲库单曲供添加选择
  const filteredLibrarySongs = useMemo(() => {
    if (!addSongQuery.trim()) return librarySongs
    const q = addSongQuery.trim().toLowerCase()
    return librarySongs.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    )
  }, [librarySongs, addSongQuery])

  // 当前选中歌单的总时长
  const currentTotalDuration = useMemo(() => {
    return playlistSongs.reduce((sum, s) => sum + (s.duration || 0), 0)
  }, [playlistSongs])

  return (
    <div className="playlist-drawer-wrapper">
      {/* 视图 1: 歌单总览层 (Playlist Overview View) */}
      {!selectedPlaylist && (
        <>
          {/* 顶部工具栏: 搜索、新建歌单与统计 */}
          <div className="playlist-drawer-toolbar">
            <div className="playlist-search-box">
              <span className="playlist-search-icon">
                <SearchIcon />
              </span>
              <input
                type="text"
                className="playlist-search-input"
                placeholder="搜索自建歌单..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="playlist-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="清除搜索"
                  aria-label="清除"
                >
                  <ClearIcon />
                </button>
              )}
            </div>

            <div className="playlist-toolbar-actions">
              <button
                type="button"
                className={`playlist-new-btn ${isCreating ? 'active' : ''}`}
                onClick={handleStartCreate}
                title="新建自建歌单"
              >
                <PlusIcon />
                <span>新建</span>
              </button>
              <span className="playlist-count-badge">
                {filteredPlaylists.length} 组
              </span>
            </div>
          </div>

          {/* 新建歌单展开表单 */}
          {isCreating && (
            <div className="playlist-create-bar">
              <input
                ref={createInputRef}
                type="text"
                className="playlist-create-input"
                placeholder="输入新歌单名称..."
                value={newPlaylistName}
                onChange={(e) => {
                  setNewPlaylistName(e.target.value)
                  if (createError) setCreateError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmCreate()
                  if (e.key === 'Escape') handleCancelCreate()
                }}
              />
              <button
                type="button"
                className="playlist-create-submit-btn"
                onClick={handleConfirmCreate}
              >
                创建
              </button>
              <button
                type="button"
                className="playlist-create-cancel-btn"
                onClick={handleCancelCreate}
              >
                取消
              </button>
              {createError && <span className="playlist-create-error">{createError}</span>}
            </div>
          )}

          {/* 滚动列表区 (液态玻璃微光滑动条) */}
          <div className="playlist-drawer-scroll-area liquid-scrollbar">
            {loading ? (
              <div className="playlist-empty-state">
                <span>歌单整理载入中...</span>
              </div>
            ) : filteredPlaylists.length === 0 ? (
              <div className="playlist-empty-state">
                <span>{searchQuery ? '未找到匹配的歌单' : '暂无自建歌单，点击上方“新建”即刻创建'}</span>
                {!searchQuery && !isCreating && (
                  <button
                    type="button"
                    className="playlist-empty-create-btn"
                    onClick={handleStartCreate}
                  >
                    <PlusIcon />
                    <span>立即创建首个歌单</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="playlist-list">
                {filteredPlaylists.map((pl) => {
                  const coverKey = pl.coverSong?.id || pl.coverSong?.file || pl.name
                  const hasImgError = imgErrors[coverKey]
                  const coverUrl = pl.coverSong && !hasImgError
                    ? `app-media://cover/${encodeURIComponent(pl.coverSong.file)}`
                    : null
                  const isRenaming = renamingPlaylist === pl.name
                  const isDeleting = deletingPlaylist === pl.name

                  return (
                    <div
                      key={pl.name}
                      className="playlist-item"
                      onClick={() => handleSelectPlaylist(pl)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSelectPlaylist(pl)
                        }
                      }}
                      title={`进入歌单【${pl.name}】(${pl.songCount} 首曲目)`}
                    >
                      {/* 封面画册缩略图 (44px 方形微棱) */}
                      <div className="playlist-cover-wrapper">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={pl.name}
                            className="playlist-cover-img"
                            loading="lazy"
                            onError={() => handleImageError(coverKey)}
                          />
                        ) : (
                          <div className="playlist-cover-placeholder">
                            <VinylDiscIcon />
                          </div>
                        )}
                      </div>

                      {/* 中段信息区 */}
                      <div className="playlist-info">
                        {isRenaming ? (
                          <div className="playlist-rename-form" onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={renameInputRef}
                              type="text"
                              className="playlist-rename-input"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmRename(e)
                                if (e.key === 'Escape') setRenamingPlaylist(null)
                              }}
                            />
                            <button
                              type="button"
                              className="playlist-rename-save-btn"
                              onClick={handleConfirmRename}
                              title="保存重命名"
                            >
                              <CheckIcon />
                            </button>
                            <button
                              type="button"
                              className="playlist-rename-cancel-btn"
                              onClick={() => setRenamingPlaylist(null)}
                              title="取消"
                            >
                              <ClearIcon />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="playlist-name">{pl.name}</span>
                            <span className="playlist-subtext">
                              {pl.songCount} 首歌曲
                              {pl.totalDuration ? ` · ${formatTotalTime(pl.totalDuration)}` : ''}
                            </span>
                          </>
                        )}
                      </div>

                      {/* 右侧快捷操作 */}
                      <div className="playlist-actions">
                        {isDeleting ? (
                          <div className="playlist-delete-confirm-box" onClick={(e) => e.stopPropagation()}>
                            <span className="playlist-delete-hint">确定删除?</span>
                            <button
                              type="button"
                              className="playlist-delete-confirm-btn"
                              onClick={(e) => handleConfirmDelete(e, pl.name)}
                              title="确认删除"
                            >
                              确定
                            </button>
                            <button
                              type="button"
                              className="playlist-delete-cancel-btn"
                              onClick={() => setDeletingPlaylist(null)}
                              title="取消"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* 重命名按键 */}
                            <button
                              type="button"
                              className="playlist-action-btn"
                              onClick={(e) => handleStartRename(e, pl.name)}
                              title="重命名歌单"
                              aria-label="重命名"
                            >
                              <EditPencilIcon />
                            </button>

                            {/* 删除歌单按键 */}
                            <button
                              type="button"
                              className="playlist-action-btn danger"
                              onClick={(e) => {
                                e.stopPropagation()
                                setIsCreating(false)
                                setRenamingPlaylist(null)
                                setDeletingPlaylist(pl.name)
                              }}
                              title="删除此歌单"
                              aria-label="删除"
                            >
                              <TrashIcon />
                            </button>

                            {/* 一键播放该歌单 */}
                            <button
                              type="button"
                              className={`playlist-play-btn ${pl.songCount === 0 ? 'disabled' : ''}`}
                              onClick={(e) => pl.songCount > 0 && handlePlayEntirePlaylist(e, pl)}
                              disabled={pl.songCount === 0}
                              title={pl.songCount === 0 ? `歌单【${pl.name}】暂无曲目` : `一键播放歌单【${pl.name}】`}
                              aria-label="播放整张歌单"
                            >
                              <PlayIcon />
                            </button>

                            {/* 钻取指示箭头 */}
                            <span className="playlist-arrow-icon">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 视图 2: 歌单单曲详情层 (Playlist Detail View) */}
      {selectedPlaylist && (
        <div className="playlist-detail-wrapper">
          {/* 顶部 Hero 导航卡片 */}
          <header className="playlist-detail-hero">
            <button
              type="button"
              className="playlist-back-btn"
              onClick={handleBackToOverview}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleBackToOverview()
                }
              }}
              title="返回全部歌单总览"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>全部歌单</span>
            </button>

            <div className="playlist-detail-header-body">
              {/* 大封面画册预览 (52px) */}
              <div className="playlist-detail-cover">
                {(() => {
                  const coverSong = playlistSongs.length > 0 ? playlistSongs[0] : (loadingSongs ? selectedPlaylist.coverSong : undefined)
                  const coverKey = coverSong ? (coverSong.id || coverSong.file) : ''
                  const hasCover = coverSong && coverSong.file && !imgErrors[coverKey]
                  return hasCover ? (
                    <img
                      src={`app-media://cover/${encodeURIComponent(coverSong.file)}`}
                      alt={selectedPlaylist.name}
                      className="playlist-cover-img"
                      onError={() => handleImageError(coverKey)}
                    />
                  ) : (
                    <div className="playlist-cover-placeholder">
                      <VinylDiscIcon />
                    </div>
                  )
                })()}
              </div>

              <div className="playlist-detail-header-info">
                <h3 className="playlist-detail-name" title={selectedPlaylist.name}>
                  {selectedPlaylist.name}
                </h3>
                <span className="playlist-detail-stats">
                  共 {playlistSongs.length} 首歌曲 · {formatTotalTime(currentTotalDuration)}
                </span>
              </div>
            </div>

            {/* 顶部快捷操作按键组 */}
            <div className="playlist-detail-actions">
              <button
                type="button"
                className="playlist-hero-btn primary"
                onClick={(e) => handlePlayEntirePlaylist(e, selectedPlaylist)}
                disabled={playlistSongs.length === 0}
                title="立即播放该歌单全部单曲"
              >
                <PlayIcon />
                <span>全部播放</span>
              </button>
              <button
                type="button"
                className="playlist-hero-btn secondary"
                onClick={(e) => handleEnqueueEntirePlaylist(e, selectedPlaylist)}
                disabled={playlistSongs.length === 0}
                title="将该歌单曲目全部追加至当前播放队列"
              >
                <PlusIcon />
                <span>全部入队</span>
              </button>
              <button
                type="button"
                className={`playlist-hero-btn secondary ${isAddingSongs ? 'active' : ''}`}
                onClick={handleToggleAddSongsPanel}
                title="从本地曲库向此歌单添加单曲"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span>{isAddingSongs ? '收起曲库' : '添加单曲'}</span>
              </button>
            </div>
          </header>

          {/* 添加单曲抽屉面板 (内嵌曲库搜索流) */}
          {isAddingSongs && (
            <div className="playlist-add-panel">
              <div className="playlist-add-search-bar">
                <span className="playlist-search-icon">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  className="playlist-add-search-input"
                  placeholder="搜索曲库歌曲并添加到本歌单..."
                  value={addSongQuery}
                  onChange={(e) => setAddSongQuery(e.target.value)}
                />
                {addSongQuery && (
                  <button
                    type="button"
                    className="playlist-search-clear"
                    onClick={() => setAddSongQuery('')}
                  >
                    <ClearIcon />
                  </button>
                )}
              </div>

              <div className="playlist-add-scroll-area liquid-scrollbar">
                {loadingLibrary ? (
                  <div className="playlist-empty-state mini">
                    <span>曲库载入中...</span>
                  </div>
                ) : filteredLibrarySongs.length === 0 ? (
                  <div className="playlist-empty-state mini">
                    <span>未找到匹配歌曲</span>
                  </div>
                ) : (
                  <div className="playlist-add-list">
                    {filteredLibrarySongs.map((song) => {
                      const inPlaylist = playlistSongs.some((ps) => ps.file === song.file)
                      const isPending = pendingAddFiles.has(song.file)
                      const isDisabled = inPlaylist || isPending

                      return (
                        <div key={song.file} className="playlist-add-item">
                          <div className="playlist-add-item-info">
                            <span className="playlist-add-item-title">{song.title}</span>
                            <span className="playlist-add-item-artist">
                              {song.artist} · {song.album || '单曲'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={`playlist-add-item-btn ${inPlaylist ? 'added' : ''}`}
                            onClick={() => !isDisabled && handleAddSongToPlaylist(song)}
                            disabled={isDisabled}
                            title={inPlaylist ? '已在歌单中' : isPending ? '正在添加' : '加入歌单'}
                          >
                            {inPlaylist ? (
                              <>
                                <CheckIcon />
                                <span>已加</span>
                              </>
                            ) : isPending ? (
                              <span>添加中</span>
                            ) : (
                              <>
                                <PlusIcon />
                                <span>添加</span>
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 单曲列表区 (液态玻璃微光滑动条) */}
          <div className="playlist-drawer-scroll-area liquid-scrollbar">
            {loadingSongs ? (
              <div className="playlist-empty-state">
                <span>歌单单曲载入中...</span>
              </div>
            ) : playlistSongs.length === 0 ? (
              <div className="playlist-empty-state">
                <span>此歌单尚未添加任何歌曲</span>
                {!isAddingSongs && (
                  <button
                    type="button"
                    className="playlist-empty-create-btn"
                    onClick={handleToggleAddSongsPanel}
                  >
                    <PlusIcon />
                    <span>从本地曲库添加歌曲</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="playlist-song-list">
                {playlistSongs.map((song, idx) => {
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
                      className={`playlist-song-item ${isCurrent ? 'active' : ''}`}
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
                      title={`点击播放: ${song.title} - ${song.artist}`}
                    >
                      {/* 序号 */}
                      <span className="playlist-song-index">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {/* 封面缩略图 */}
                      <div className="playlist-song-cover-box">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={song.title}
                            className="playlist-song-cover-img"
                            loading="lazy"
                            onError={() => handleImageError(coverKey)}
                          />
                        ) : (
                          <VinylDiscIcon />
                        )}
                      </div>

                      {/* 歌曲信息与音质徽标 */}
                      <div className="playlist-song-meta">
                        <span className="playlist-song-title">{song.title}</span>
                        <div className="playlist-song-subinfo">
                          <span className={`playlist-badge-${song.quality.toLowerCase()}`}>
                            {song.quality}
                          </span>
                          <span className="playlist-song-artist">
                            {song.artist} · {song.album || '单曲'}
                          </span>
                        </div>
                      </div>

                      {/* 等宽时长 */}
                      <span className="playlist-song-duration">
                        {formatDuration(song.duration)}
                      </span>

                      {/* 二态开关 (+ 添加至队列 / - 从队列移出) */}
                      <button
                        type="button"
                        className={`playlist-song-toggle-btn ${queued ? 'queued' : ''}`}
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

                      {/* 从歌单移除按钮 */}
                      <button
                        type="button"
                        className="playlist-song-remove-btn"
                        onClick={(e) => handleRemoveSongFromPlaylist(e, song, idx)}
                        disabled={removingIdx !== null}
                        title="从歌单移出此曲"
                        aria-label="从歌单移除"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
