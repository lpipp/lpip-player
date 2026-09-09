/**
 * IPC 通道名称常量集合
 * 集中管理所有主进程与渲染进程之间的 IPC 通道，杜绝魔术字符串
 */
export const IPC_CHANNELS = {
  /** 获取 MPD 曲库所有音频元数据列表 */
  MPD_GET_LIBRARY: 'mpd:get-library',
  /** 触发 MPD 后端重新扫描曲库并返回最新列表 */
  MPD_RESCAN: 'mpd:rescan',
  /** 播放指定音频文件 (写入 MPD 队列并触发播放) */
  MPD_PLAY: 'mpd:play',
  /** 暂停播放 */
  MPD_PAUSE: 'mpd:pause',
  /** 恢复播放 */
  MPD_RESUME: 'mpd:resume',
  /** 切换播放/暂停 */
  MPD_TOGGLE_PLAY: 'mpd:toggle-play',
  /** 下一曲 */
  MPD_NEXT: 'mpd:next',
  /** 上一曲 */
  MPD_PREV: 'mpd:prev',
  /** 跳转指定播放进度 (秒) */
  MPD_SEEK: 'mpd:seek',
  /** 获取 MPD 实时播放状态与当前曲目信息 */
  MPD_GET_STATUS: 'mpd:get-status',
  /** 获取指定音频文件的歌词行列表 */
  MPD_GET_LYRICS: 'mpd:get-lyrics',
  /** 将指定音频文件追加至 MPD 当前播放队列末尾 */
  MPD_ADD_QUEUE: 'mpd:add-queue',
  /** 设置 MPD 音量 (0 ~ 100) */
  MPD_SET_VOLUME: 'mpd:set-volume',
  /** 设置 MPD 播放模式 ('sequence' | 'shuffle' | 'single') */
  MPD_SET_MODE: 'mpd:set-mode',
  /** 主进程向渲染层广播的播放器状态变更事件 */
  MPD_STATUS_CHANGED: 'mpd:status-changed'
} as const
