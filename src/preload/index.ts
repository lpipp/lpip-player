import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../main/ipc-channels'
import type { LyricLine, MpdSong, MpdStatus, PlaybackMode } from '../types/music'

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
    /** 追加指定音源文件至队列 */
    addToQueue: (file: string) => Promise<boolean>
    /** 监听 MPD 播放器状态实时变更 */
    onStatusChange: (callback: (status: MpdStatus) => void) => () => void
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
    onStatusChange: (callback: (status: MpdStatus) => void) => {
      const handler = (_event: unknown, status: MpdStatus): void => callback(status)
      ipcRenderer.on(IPC_CHANNELS.MPD_STATUS_CHANGED, handler)
      return (): void => {
        ipcRenderer.removeListener(IPC_CHANNELS.MPD_STATUS_CHANGED, handler)
      }
    }
  }
}

// 遵循安全沙箱铁律: 仅暴露最小必要 API 面，严禁直接对外泄露 ipcRenderer 原生对象
contextBridge.exposeInMainWorld('electronAPI', api)
