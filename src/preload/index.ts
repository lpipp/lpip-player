import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../main/ipc-channels'
import type { AddToQueueResult, LyricLine, MpdPlaylist, MpdSong, MpdStatus, PlaybackMode } from '../types/music'
import type { AppConfig } from '../main/config'

/**
 * 暴露给渲染进程的安全 API 接口定义
 */
export interface ElectronAPI {
  mpd: {
    /** 获取曲库全量音源列表 */
    getLibrary: () => Promise<MpdSong[]>
    /** 触发 MPD 重新扫描并返回更新后的列表 */
    rescan: () => Promise<MpdSong[]>
    /** 播放指定音源文件 */
    play: (file: string) => Promise<boolean>
    /** 暂停播放 */
    pause: () => Promise<boolean>
    /** 恢复播放 */
    resume: () => Promise<boolean>
    /** 切换播放/暂停 */
    togglePlay: () => Promise<'play' | 'pause' | 'stop'>
    /** 下一曲 */
    next: () => Promise<boolean>
    /** 上一曲 */
    prev: () => Promise<boolean>
    /** 寻道跳转播放进度 (秒) */
    seek: (timeSeconds: number) => Promise<boolean>
    /** 设置 MPD 音量 (0 ~ 100) */
    setVolume: (volume: number) => Promise<boolean>
    /** 设置播放模式 ('sequence' | 'shuffle' | 'single') */
    setMode: (mode: PlaybackMode) => Promise<boolean>
    /** 查询播放器当前状态 */
    getStatus: () => Promise<MpdStatus>
    /** 获取歌曲对应的 LRC 歌词行 */
    getLyrics: (file: string) => Promise<LyricLine[]>
    /** 追加指定音源文件至队列 (带去重防重复保障) */
    addToQueue: (file: string) => Promise<AddToQueueResult>
    /** 获取当前播放队列中的全部曲目列表 */
    getQueue: () => Promise<MpdSong[]>
    /** 播放队列中指定位置或 ID 的曲目 */
    playQueueItem: (pos: number, queueId?: number) => Promise<boolean>
    /** 从当前队列中移除指定曲目 */
    removeQueueItem: (pos: number, queueId?: number, file?: string) => Promise<boolean>
    /** 清空当前播放队列 */
    clearQueue: () => Promise<boolean>
    /** 移动队列中曲目的位置 */
    moveQueueItem: (fromPos: number, toPos: number) => Promise<boolean>
    /** 获取所有已保存歌单列表 */
    getPlaylists: () => Promise<MpdPlaylist[]>
    /** 获取指定歌单的单曲列表 */
    getPlaylistSongs: (name: string) => Promise<MpdSong[]>
    /** 新建歌单 */
    createPlaylist: (name: string) => Promise<boolean>
    /** 删除歌单 */
    deletePlaylist: (name: string) => Promise<boolean>
    /** 重命名歌单 */
    renamePlaylist: (oldName: string, newName: string) => Promise<boolean>
    /** 向歌单追加歌曲 */
    addToPlaylist: (name: string, file: string) => Promise<boolean>
    /** 从歌单移除歌曲 */
    removeFromPlaylist: (name: string, pos: number) => Promise<boolean>
    /** 播放指定歌单 */
    playPlaylist: (name: string) => Promise<boolean>
    /** 将整张歌单全部歌曲批量追加至当前播放队列 (自动去重) */
    enqueuePlaylist: (name: string) => Promise<boolean>
    /** 监听 MPD 播放器状态实时变更 */
    onStatusChange: (callback: (status: MpdStatus) => void) => () => void
  }
  config: {
    /** 获取当前应用全局运行时配置 */
    get: () => Promise<AppConfig>
    /** 监听配置文件变更并触发回调 */
    onChange: (callback: (config: AppConfig) => void) => () => void
  }
}

const api: ElectronAPI = {
  mpd: {
    getLibrary: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_GET_LIBRARY),
    rescan: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_RESCAN),
    play: (file: string) => ipcRenderer.invoke(IPC_CHANNELS.MPD_PLAY, file),
    pause: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_PAUSE),
    resume: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_RESUME),
    togglePlay: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_TOGGLE_PLAY),
    next: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_NEXT),
    prev: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_PREV),
    seek: (timeSeconds: number) => ipcRenderer.invoke(IPC_CHANNELS.MPD_SEEK, timeSeconds),
    setVolume: (volume: number) => ipcRenderer.invoke(IPC_CHANNELS.MPD_SET_VOLUME, volume),
    setMode: (mode: PlaybackMode) => ipcRenderer.invoke(IPC_CHANNELS.MPD_SET_MODE, mode),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_GET_STATUS),
    getLyrics: (file: string) => ipcRenderer.invoke(IPC_CHANNELS.MPD_GET_LYRICS, file),
    addToQueue: (file: string) => ipcRenderer.invoke(IPC_CHANNELS.MPD_ADD_QUEUE, file),
    getQueue: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_GET_QUEUE),
    playQueueItem: (pos: number, queueId?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_PLAY_QUEUE_ITEM, pos, queueId),
    removeQueueItem: (pos: number, queueId?: number, file?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_REMOVE_QUEUE_ITEM, pos, queueId, file),
    clearQueue: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_CLEAR_QUEUE),
    moveQueueItem: (fromPos: number, toPos: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_MOVE_QUEUE_ITEM, fromPos, toPos),
    getPlaylists: () => ipcRenderer.invoke(IPC_CHANNELS.MPD_GET_PLAYLISTS),
    getPlaylistSongs: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_GET_PLAYLIST_SONGS, name),
    createPlaylist: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_CREATE_PLAYLIST, name),
    deletePlaylist: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_DELETE_PLAYLIST, name),
    renamePlaylist: (oldName: string, newName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_RENAME_PLAYLIST, oldName, newName),
    addToPlaylist: (name: string, file: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_ADD_TO_PLAYLIST, name, file),
    removeFromPlaylist: (name: string, pos: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_REMOVE_FROM_PLAYLIST, name, pos),
    playPlaylist: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_PLAY_PLAYLIST, name),
    enqueuePlaylist: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MPD_ENQUEUE_PLAYLIST, name),
    onStatusChange: (callback: (status: MpdStatus) => void) => {
      const handler = (_event: unknown, status: MpdStatus): void => callback(status)
      ipcRenderer.on(IPC_CHANNELS.MPD_STATUS_CHANGED, handler)
      return (): void => {
        ipcRenderer.removeListener(IPC_CHANNELS.MPD_STATUS_CHANGED, handler)
      }
    }
  },
  config: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
    onChange: (callback: (config: AppConfig) => void) => {
      const handler = (_event: unknown, cfg: AppConfig): void => callback(cfg)
      ipcRenderer.on(IPC_CHANNELS.CONFIG_CHANGED, handler)
      return (): void => {
        ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_CHANGED, handler)
      }
    }
  }
}

// 遵循安全沙箱铁律: 仅暴露最小必要 API 面，严禁直接对外泄露 ipcRenderer 原生对象
contextBridge.exposeInMainWorld('electronAPI', api)
