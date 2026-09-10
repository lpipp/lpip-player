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
  /** 获取 MPD 当前播放队列中的曲目列表 */
  MPD_GET_QUEUE: 'mpd:get-queue',
  /** 播放当前队列中的指定曲目 */
  MPD_PLAY_QUEUE_ITEM: 'mpd:play-queue-item',
  /** 从当前队列中移除指定曲目 */
  MPD_REMOVE_QUEUE_ITEM: 'mpd:remove-queue-item',
  /** 清空当前播放队列 */
  MPD_CLEAR_QUEUE: 'mpd:clear-queue',
  /** 移动/重排队列中的曲目位置 */
  MPD_MOVE_QUEUE_ITEM: 'mpd:move-queue-item',
  /** 设置 MPD 音量 (0 ~ 100) */
  MPD_SET_VOLUME: 'mpd:set-volume',
  /** 设置 MPD 播放模式 ('sequence' | 'shuffle' | 'single') */
  MPD_SET_MODE: 'mpd:set-mode',
  /** 获取所有已保存歌单列表 */
  MPD_GET_PLAYLISTS: 'mpd:get-playlists',
  /** 获取指定歌单的单曲列表 */
  MPD_GET_PLAYLIST_SONGS: 'mpd:get-playlist-songs',
  /** 新建歌单 */
  MPD_CREATE_PLAYLIST: 'mpd:create-playlist',
  /** 删除歌单 */
  MPD_DELETE_PLAYLIST: 'mpd:delete-playlist',
  /** 重命名歌单 */
  MPD_RENAME_PLAYLIST: 'mpd:rename-playlist',
  /** 向歌单追加歌曲 */
  MPD_ADD_TO_PLAYLIST: 'mpd:add-to-playlist',
  /** 从歌单移除歌曲 */
  MPD_REMOVE_FROM_PLAYLIST: 'mpd:remove-from-playlist',
  /** 播放指定歌单 */
  MPD_PLAY_PLAYLIST: 'mpd:play-playlist',
  /** 将整张歌单全部歌曲追加至当前播放队列 (自动去重) */
  MPD_ENQUEUE_PLAYLIST: 'mpd:enqueue-playlist',
  /** 主进程向渲染层广播的播放器状态变更事件 */
  MPD_STATUS_CHANGED: 'mpd:status-changed',
  /** 获取当前应用全局配置 */
  CONFIG_GET: 'config:get',
  /** 主进程向渲染层广播的配置变更事件 (文件热更新) */
  CONFIG_CHANGED: 'config:changed'
} as const
