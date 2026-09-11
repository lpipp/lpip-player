/**
 * 频谱可视化风格预设
 * 'blueprint': 高级制表纯线条蓝图工程风 + 散点粒子微光 (默认)
 * 'wave': 极细高频工程波形正弦包络线
 * 'bars': 精密制表刻度柱状频段
 */
export type VisualizerStyle = 'blueprint' | 'wave' | 'bars'

/**
 * 音频频谱可视化律动详细配置项
 */
export interface VisualizerConfig {
  /** 是否启用频谱可视化 (默认 true) */
  enabled: boolean
  /** 频谱画布高度 (px, 范围 40 ~ 600, 默认 160) */
  height: number
  /** 可视化整体不透明度 (0.0 ~ 1.0, 默认 0.85) */
  opacity: number
  /** 视觉渲染风格 (默认 'blueprint') */
  style: VisualizerStyle
}

/**
 * 云母微光色调风格预设
 * default: 品牌翡翠青绿与冷紫蓝交织 (默认)
 * cool: 纯冷夜蓝与深靛微光
 * neutral: 素雅黑白灰中性微光
 * warm: 微暖玄武岩与木炭色微光
 */
export type MicaStyle = 'default' | 'cool' | 'neutral' | 'warm'

/**
 * 窗口背景效果模式
 * 'default': 经典黑曜石纯深色渐变舞台
 * 'mica': 云母矿物晶体微光材质
 * 'wallpaper': 自定义本地图片/视频壁纸
 */
export type BackgroundMode = 'default' | 'mica' | 'wallpaper'

/**
 * 壁纸缩放填充模式
 * 'cover': 保持宽高比填满窗口, 裁剪超出部分 (默认)
 * 'contain': 保持宽高比完整显示在窗口内
 * 'fill': 强制拉伸填满整个窗口
 */
export type WallpaperFit = 'cover' | 'contain' | 'fill'

/**
 * 自定义壁纸详细微调配置项
 */
export interface WallpaperConfig {
  /** 本地壁纸图片或视频绝对路径或以 ~ 开头的家目录路径 */
  path: string
  /** 壁纸高斯模糊半径 (px, 范围 0 ~ 50, 默认 0) */
  blur: number
  /** 暗色遮罩不透明度 (范围 0.0 ~ 1.0, 默认 0.5) */
  overlayOpacity: number
  /** 缩放填充模式 (默认 'cover') */
  fit: WallpaperFit
  /** 视频壁纸是否静音 (默认 true) */
  muted?: boolean
  /** 视频壁纸是否循环播放 (默认 true) */
  loop?: boolean
  /** 视频壁纸播放速率 (范围 0.25 ~ 2.0, 默认 1.0) */
  playbackRate?: number
}

/**
 * 云母效果详细微调配置项
 */
export interface MicaConfig {
  /** 是否启用云母效果 (默认 false) */
  enabled: boolean
  /** 矿物颗粒度强弱 (0.0 ~ 0.1, 默认 0.035) */
  grainOpacity: number
  /** 环境微光漫射强度 (0.0 ~ 0.2, 默认 0.05) */
  tintOpacity: number
  /** 云母微光色调风格预设 (默认 'default') */
  style: MicaStyle
  /** 顶部内高光棱线强度 (0.0 ~ 0.2, 默认 0.08) */
  edgeHighlight: number
  /** 是否在全周增加 1px 微弱外边框轮廓 (默认 false) */
  border: boolean
}

/**
 * 主窗口统一背景效果配置项
 */
export interface BackgroundConfig {
  /** 当前激活的背景模式 */
  mode: BackgroundMode
  /** 云母微调配置 */
  mica: MicaConfig
  /** 自定义壁纸微调配置 */
  wallpaper: WallpaperConfig
}

/**
 * 窗口左侧滑出气泡弹窗微调配置项
 */
export interface SidebarConfig {
  /** 是否启用左侧边缘悬浮抽屉/气泡弹窗 (默认 true) */
  enabled: boolean
  /** 是否启用左侧边缘动态微光提示 (默认 true) */
  glowHint: boolean
  /** 触发范围/感应热区宽度 (单位 px, 范围 4 ~ 120, 默认 30) */
  triggerWidth: number
  /** 关闭范围/移出抽屉的安全缓冲范围 (单位 px, 范围 0 ~ 200, 默认 30) */
  closeBuffer: number
  /** 鼠标悬停触发延迟 (单位 ms, 范围 0 ~ 2000, 默认 80) */
  triggerDelay: number
  /** 鼠标移出自动收起延迟 (单位 ms, 范围 0 ~ 3000, 默认 300) */
  closeDelay: number
  /** 滑出/收起动画过渡时长 (单位 ms, 范围 100 ~ 1000, 默认 280) */
  animationDuration: number
  /** 动画缓动函数 (默认 'cubic-bezier(0.16, 1, 0.3, 1)') */
  animationEasing: string
  /** 气泡弹窗展开宽度 (单位 px, 范围 160 ~ 600, 默认 460) */
  width: number
  /** 抽屉展开时上下各延伸的像素幅度 (单位 px, 范围 0 ~ 200, 默认 50) */
  verticalExtension: number
  /** 悬浮胶囊与抽屉背景不透明度 (范围 0.0 ~ 1.0, 默认 0.78) */
  opacity: number
}

/**
 * 主题与明暗模式微调配置项
 */
export interface ThemeConfig {
  /** 当前主题模式: 'dark' (深色黑曜石) | 'light' (浅色白玉霜雪) */
  mode: 'dark' | 'light'
  /** 明暗度微调偏移量 (范围 -0.2 ~ +0.2, 默认 0) */
  brightness: number
  /** 对比度微调系数 (范围 0.8 ~ 1.2, 默认 1.0) */
  contrast: number
}

/**
 * 窗口相关配置项
 */
export interface WindowConfig {
  /** 是否启用沉浸式效果 (无边框模式) */
  immersive: boolean
  /** 主题与明暗模式微调配置 */
  theme: ThemeConfig
  /** 窗口背景效果 */
  background: BackgroundConfig
  /** 左侧滑出气泡弹窗抽屉配置 */
  sidebar: SidebarConfig
  /** 向下兼容字段: 云母效果配置 */
  mica: MicaConfig
}

/**
 * 切歌与歌词跳转时的音频淡出淡入过渡配置
 */
export interface FadeConfig {
  /** 是否开启淡出淡入平滑过渡 (默认 true) */
  enabled: boolean
  /** 淡入淡出时长 (毫秒, 范围 20 ~ 1000, 默认 120) */
  duration: number
}

/**
 * 音频播放与音效微调配置项
 */
export interface AudioConfig {
  /** 切歌与歌词跳转淡出淡入配置 */
  fade: FadeConfig
}

/**
 * MPD 服务端连接配置项
 */
export interface MpdConfig {
  host: string
  port: number
  streamPort: number
}

/**
 * 应用全局运行时配置结构
 */
export interface AppConfig {
  window: WindowConfig
  audio: AudioConfig
  visualizer: VisualizerConfig
  mpd: MpdConfig
}

/**
 * 递归深度 Partial 辅助类型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * 默认频谱可视化配置
 */
export const DEFAULT_VISUALIZER_CONFIG: VisualizerConfig = {
  enabled: true,
  height: 160,
  opacity: 0.85,
  style: 'blueprint'
}

export const DEFAULT_MICA_CONFIG: MicaConfig = {
  enabled: false,
  grainOpacity: 0.035,
  tintOpacity: 0.05,
  style: 'default',
  edgeHighlight: 0.08,
  border: false
}

export const DEFAULT_WALLPAPER_CONFIG: WallpaperConfig = {
  path: '',
  blur: 0,
  overlayOpacity: 0.5,
  fit: 'cover',
  muted: true,
  loop: true,
  playbackRate: 1.0
}

export const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
  mode: 'default',
  mica: DEFAULT_MICA_CONFIG,
  wallpaper: DEFAULT_WALLPAPER_CONFIG
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'dark',
  brightness: 0,
  contrast: 1.0
}

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  enabled: true,
  glowHint: true,
  triggerWidth: 30,
  closeBuffer: 40,
  triggerDelay: 80,
  closeDelay: 300,
  animationDuration: 280,
  animationEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  width: 460,
  verticalExtension: 50,
  opacity: 0.78
}

export const DEFAULT_FADE_CONFIG: FadeConfig = {
  enabled: true,
  duration: 120
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  fade: DEFAULT_FADE_CONFIG
}

export const DEFAULT_MPD_CONFIG: MpdConfig = {
  host: '127.0.0.1',
  port: 6600,
  streamPort: 8000
}

export const DEFAULT_WINDOW_CONFIG: WindowConfig = {
  immersive: false,
  theme: DEFAULT_THEME_CONFIG,
  background: DEFAULT_BACKGROUND_CONFIG,
  sidebar: DEFAULT_SIDEBAR_CONFIG,
  mica: DEFAULT_MICA_CONFIG
}

export const DEFAULT_CONFIG: AppConfig = {
  window: DEFAULT_WINDOW_CONFIG,
  audio: DEFAULT_AUDIO_CONFIG,
  visualizer: DEFAULT_VISUALIZER_CONFIG,
  mpd: DEFAULT_MPD_CONFIG
}

/**
 * 数值区间钳位辅助函数
 */
export function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min
  return Math.min(Math.max(val, min), max)
}

/**
 * 剥除 JSON 文本中的单行与多行注释 (支持 JSONC)
 */
export function stripJsonComments(text: string): string {
  let result = ''
  let inString = false
  let isEscaped = false
  let inSingleComment = false
  let inBlockComment = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inSingleComment) {
      if (char === '\n' || char === '\r') {
        inSingleComment = false
        result += char
      }
      i++
      continue
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false
        i += 2
        continue
      }
      i++
      continue
    }

    if (inString) {
      result += char
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === '"') {
        inString = false
      }
      i++
      continue
    }

    if (char === '/' && nextChar === '/') {
      inSingleComment = true
      i += 2
      continue
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true
      i += 2
      continue
    }

    if (char === '"') {
      inString = true
    }

    result += char
    i++
  }

  return result
}

/**
 * 解析并校验音频频谱可视化配置
 */
export function parseVisualizerConfig(rawVisualizer: unknown): VisualizerConfig {
  if (typeof rawVisualizer === 'boolean') {
    return {
      ...DEFAULT_VISUALIZER_CONFIG,
      enabled: rawVisualizer
    }
  }

  if (typeof rawVisualizer === 'object' && rawVisualizer !== null) {
    const obj = rawVisualizer as Record<string, unknown>
    const validStyles: VisualizerStyle[] = ['blueprint', 'wave', 'bars']
    const styleCandidate = obj['style']
    const style: VisualizerStyle =
      typeof styleCandidate === 'string' && validStyles.includes(styleCandidate as VisualizerStyle)
        ? (styleCandidate as VisualizerStyle)
        : DEFAULT_VISUALIZER_CONFIG.style

    return {
      enabled: typeof obj['enabled'] === 'boolean' ? obj['enabled'] : DEFAULT_VISUALIZER_CONFIG.enabled,
      height:
        typeof obj['height'] === 'number'
          ? Math.round(clamp(obj['height'], 40, 600))
          : DEFAULT_VISUALIZER_CONFIG.height,
      opacity:
        typeof obj['opacity'] === 'number'
          ? clamp(obj['opacity'], 0, 1)
          : DEFAULT_VISUALIZER_CONFIG.opacity,
      style
    }
  }

  return DEFAULT_VISUALIZER_CONFIG
}

/**
 * 解析并校验 MPD 服务端连接配置
 */
export function parseMpdConfig(rawMpd: unknown): MpdConfig {
  if (typeof rawMpd === 'object' && rawMpd !== null) {
    const obj = rawMpd as Record<string, unknown>
    const host =
      typeof obj['host'] === 'string' && obj['host'].trim().length > 0
        ? obj['host'].trim()
        : DEFAULT_MPD_CONFIG.host
    const port =
      typeof obj['port'] === 'number' && !Number.isNaN(obj['port'])
        ? Math.round(clamp(obj['port'], 1, 65535))
        : DEFAULT_MPD_CONFIG.port
    const streamPort =
      typeof obj['streamPort'] === 'number' && !Number.isNaN(obj['streamPort'])
        ? Math.round(clamp(obj['streamPort'], 1, 65535))
        : DEFAULT_MPD_CONFIG.streamPort
    return { host, port, streamPort }
  }

  return DEFAULT_MPD_CONFIG
}

