/**
 * MPD 单曲音源数据结构
 */
export interface MpdSong {
  /** 唯一标识 (通常为曲库相对路径) */
  id: string
  /** MPD 内部相对音频路径，如 "music_1/1874 - 陈奕迅.flac" */
  file: string
  /** 歌曲名称 */
  title: string
  /** 歌手 / 艺术家 */
  artist: string
  /** 专辑名称 */
  album: string
  /** 时长 (秒数，浮点) */
  duration: number
  /** 原始采样规格，如 "44100:16:2" 或 "48000:24:2" */
  format: string
  /** 音质徽标等级 (Hi-Res: 24bit/高采样; SQ: 无损 16bit FLAC; HQ: 320k MP3; STD: 标准) */
  quality: 'Hi-Res' | 'SQ' | 'HQ' | 'STD'
  /** 封面图片请求地址 (通过 app-media:// 协议提取并缓存) */
  coverUrl: string
  /** 发行年份 */
  date?: string
  /** 音轨编号 */
  track?: string
}

/**
 * 歌词行数据结构 (适配极坐标星盘歌词轨道)
 */
export interface LyricLine {
  /** 唯一序号或行索引 */
  id: number
  /** 主歌词文本 (大号高亮衬线字体) */
  primary: string
  /** 辅歌词文本 (翻译或副歌) */
  secondary?: string
  /** 对应歌曲时间秒数 */
  time?: number
}

/**
 * MPD 播放模式类型
 */
export type PlaybackMode = 'sequence' | 'shuffle' | 'single'

/**
 * MPD 播放器全局实时状态数据模型
 */
export interface MpdStatus {
  /** 播放状态: 'play' 播放中 | 'pause' 已暂停 | 'stop' 已停止 */
  state: 'play' | 'pause' | 'stop'
  /** 播放器音量 (0 ~ 100) */
  volume: number
  /** 当前播放秒数 (浮点秒) */
  currentTime: number
  /** 当前音轨总秒数 (浮点秒) */
  duration: number
  /** 当前正在播放的歌曲元数据 */
  currentSong: MpdSong | null
  /** 播放队列长度 */
  playlistLength: number
  /** 当前歌曲在队列中的索引号 */
  songPos: number
  /** 是否开启列表循环 */
  repeat: boolean
  /** 是否开启随机播放 */
  random: boolean
  /** 是否开启单曲循环 */
  single: boolean
  /** 当前播放模式 ('sequence' | 'shuffle' | 'single') */
  mode: PlaybackMode
}
