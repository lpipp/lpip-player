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
 * 歌词滚轮预览确认延迟配置
 */
export interface LyricPreviewConfig {
  /** 滚轮预览后等待单击确认的超时时长 (毫秒, 范围 500 ~ 5000, 默认 1500) */
  timeoutMs: number
}

/**
 * 音频播放与音效微调配置项
 */
export interface AudioConfig {
  /** 切歌与歌词跳转淡出淡入配置 */
  fade: FadeConfig
  /** 歌词滚轮预览确认延迟配置 */
  lyricPreview: LyricPreviewConfig
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
 * 单项字体字形与字号配置
 */
export interface FontItemConfig {
  /** 字体族名称 (如推荐优质字体族或自定义字体名) */
  fontFamily: string
  /** 字体基准大小 (px) */
  fontSize: number
}

/**
 * 歌词专用字体配置 (区分正文主歌词与次级翻译文本)
 */
export interface LyricsTypographyConfig {
  /** 歌词正文/原文大号高亮字形配置 */
  body: FontItemConfig
  /** 歌词翻译/次级辅助字形配置 */
  translation: FontItemConfig
  /** 是否显示歌词翻译行 (默认 true; 关闭则全局隐藏 .lyric-secondary) */
  showTranslation: boolean
}

/**
 * 全局文字排印与字体系统配置
 */
export interface TypographyConfig {
  /** 界面通用字体 (控制主工作区、状态栏曲目名、抽屉导航列表等) */
  ui: FontItemConfig
  /** 提示与辅助文本 (控制等宽播放时间、SQ/Hi-Res 音质徽标、歌手专辑副标题等较小字阶) */
  hint: FontItemConfig
  /** 歌词文本 (含正文与翻译) */
  lyrics: LyricsTypographyConfig
}

/**
 * 应用全局运行时配置结构
 */
export interface AppConfig {
  window: WindowConfig
  audio: AudioConfig
  visualizer: VisualizerConfig
  mpd: MpdConfig
  typography: TypographyConfig
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

export const DEFAULT_LYRIC_PREVIEW_CONFIG: LyricPreviewConfig = {
  timeoutMs: 1500
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  fade: DEFAULT_FADE_CONFIG,
  lyricPreview: DEFAULT_LYRIC_PREVIEW_CONFIG
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

export const DEFAULT_TYPOGRAPHY_CONFIG: TypographyConfig = {
  ui: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 13
  },
  hint: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "JetBrains Mono", monospace',
    fontSize: 12
  },
  lyrics: {
    body: {
      fontFamily: "'Playfair Display', 'DejaVu Serif', 'Liberation Serif', 'Noto Serif CJK SC', 'Noto Serif SC', 'Source Han Serif SC', Georgia, serif",
      fontSize: 18
    },
    translation: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      fontSize: 12
    },
    showTranslation: true
  }
}

export const DEFAULT_CONFIG: AppConfig = {
  window: DEFAULT_WINDOW_CONFIG,
  audio: DEFAULT_AUDIO_CONFIG,
  visualizer: DEFAULT_VISUALIZER_CONFIG,
  mpd: DEFAULT_MPD_CONFIG,
  typography: DEFAULT_TYPOGRAPHY_CONFIG
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
 * 解析并校验歌词滚轮预览确认延迟配置
 * 兼容毫秒整数/数字字符串; 秒级小数输入 (<10) 按秒换算为毫秒
 */
export function parseLyricPreviewConfig(rawPreview: unknown): LyricPreviewConfig {
  if (typeof rawPreview === 'object' && rawPreview !== null) {
    const obj = rawPreview as Record<string, unknown>
    const rawTimeout = obj['timeoutMs'] ?? obj['timeout'] ?? obj['delayMs']
    let parsed: number = NaN
    if (typeof rawTimeout === 'number') {
      parsed = rawTimeout
    } else if (typeof rawTimeout === 'string') {
      const num = parseFloat(rawTimeout)
      if (Number.isFinite(num)) parsed = num
    }
    if (Number.isFinite(parsed)) {
      // 秒级小数 (如 1.5) 按秒换算为毫秒
      if (parsed > 0 && parsed < 10 && !Number.isInteger(parsed)) parsed = parsed * 1000
      return { timeoutMs: Math.round(clamp(parsed, 500, 5000)) }
    }
  }
  if (typeof rawPreview === 'number' && Number.isFinite(rawPreview)) {
    let parsed = rawPreview
    if (parsed > 0 && parsed < 10 && !Number.isInteger(parsed)) parsed = parsed * 1000
    return { timeoutMs: Math.round(clamp(parsed, 500, 5000)) }
  }
  if (typeof rawPreview === 'string') {
    const num = parseFloat(rawPreview)
    if (Number.isFinite(num)) {
      let parsed = num
      if (parsed > 0 && parsed < 10 && !Number.isInteger(parsed)) parsed = parsed * 1000
      return { timeoutMs: Math.round(clamp(parsed, 500, 5000)) }
    }
  }
  return { ...DEFAULT_LYRIC_PREVIEW_CONFIG }
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

  // 缺省回退返回拷贝, 禁止外泄 DEFAULT 单例引用 (调用方可能直接改写)
  return { ...DEFAULT_VISUALIZER_CONFIG }
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

  // 缺省回退返回拷贝, 禁止外泄 DEFAULT 单例引用 (调用方可能直接改写)
  return { ...DEFAULT_MPD_CONFIG }
}

/**
 * 清理与规范化用户输入的字体族名称
 * 1. 去除首尾空白字符与非法换行/控制字符
 * 2. 剥除 CSS 样式声明前缀如 font-family:
 * 3. 剥除 !important 声明 (杜绝 CSSOM setProperty 静默失效)
 * 4. 剥除 CSS 注释 /* ... *\/
 * 5. 剥除分号、花括号、反斜杠 (CSS 逃逸符)、反引号与尖括号 (彻底杜绝 CSS 逃逸与 HTML 注入)
 * 6. 规范化逗号 (去除首尾悬垂逗号与重复逗号)
 * 7. 闭合或补齐未闭合的单双引号
 */
export function sanitizeFontFamily(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback
  let clean = input.trim()
  if (!clean) return fallback

  // 移除控制字符与换行 (ASCII 0-31 以及 DEL 127)
  clean = clean.replace(/[\x00-\x1F\x7F]/g, ' ')

  // 剥除 CSS 声明前缀 (如用户误粘贴 font-family: ...)
  clean = clean.replace(/^font-family\s*:\s*/i, '')

  // 剥除 !important 声明 (避免 setProperty 传参后静默失效)
  clean = clean.replace(/!\s*important/gi, '')

  // 剥除 CSS 注释
  clean = clean.replace(/\/\*[\s\S]*?\*\//g, '')

  // 剥除分号、花括号、反斜杠 (CSS 逃逸字符)、尖括号与反引号
  clean = clean.replace(/[;{}\\\\<>`]/g, '')

  // 规范化逗号 (移除重复逗号以及首尾未完成的悬垂逗号)
  clean = clean.replace(/,(\s*,)+/g, ',').replace(/^,\s*|,\s*$/g, '')

  // 修复未配对的单双引号
  const singleQuotes = (clean.match(/'/g) || []).length
  if (singleQuotes % 2 !== 0) {
    if (clean.startsWith("'") && !clean.endsWith("'")) {
      clean = clean + "'"
    } else if (clean.endsWith("'") && !clean.startsWith("'")) {
      clean = "'" + clean
    } else {
      clean = clean.replace(/'/g, '')
    }
  }

  const doubleQuotes = (clean.match(/"/g) || []).length
  if (doubleQuotes % 2 !== 0) {
    if (clean.startsWith('"') && !clean.endsWith('"')) {
      clean = clean + '"'
    } else if (clean.endsWith('"') && !clean.startsWith('"')) {
      clean = '"' + clean
    } else {
      clean = clean.replace(/"/g, '')
    }
  }

  clean = clean.replace(/\s+/g, ' ').trim()

  // 若清理后不包含任何有效字符 (例如输入只有引号、逗号或空白: '""', "''", ",,")，安全回退
  if (clean.replace(/['"\s,]/g, '').length === 0) {
    return fallback
  }

  // 防御性拦截字符串化字面量 "null" 或 "undefined"
  const lower = clean.toLowerCase()
  if (lower === 'null' || lower === 'undefined') {
    return fallback
  }

  return clean.length > 0 ? clean : fallback
}

/**
 * 解析并校验单项字体字形与字号配置
 */
export function parseFontItemConfig(
  rawItem: unknown,
  defaultItem: FontItemConfig,
  minSize: number,
  maxSize: number
): FontItemConfig {
  if (typeof rawItem === 'object' && rawItem !== null) {
    const obj = rawItem as Record<string, unknown>
    const rawFont = obj['fontFamily']
    const fontFamily = sanitizeFontFamily(rawFont, defaultItem.fontFamily)

    const rawSize = obj['fontSize']
    let parsedSize: number = NaN
    if (typeof rawSize === 'number') {
      parsedSize = rawSize
    } else if (typeof rawSize === 'string') {
      const parsedFloat = parseFloat(rawSize)
      if (Number.isFinite(parsedFloat)) {
        parsedSize = parsedFloat
      }
    }

    const fontSize =
      Number.isFinite(parsedSize)
        ? Math.round(clamp(parsedSize, minSize, maxSize))
        : defaultItem.fontSize

    return { fontFamily, fontSize }
  }

  return { ...defaultItem }
}

/**
 * 解析并校验全局文字排印与字体系统配置
 */
export function parseTypographyConfig(rawTypography: unknown): TypographyConfig {
  if (typeof rawTypography === 'object' && rawTypography !== null) {
    const obj = rawTypography as Record<string, unknown>
    // 兼容可能直接传入包含 typography 或 font 包装节点的外层对象
    const targetObj =
      typeof obj['typography'] === 'object' && obj['typography'] !== null
        ? (obj['typography'] as Record<string, unknown>)
        : typeof obj['font'] === 'object' && obj['font'] !== null
          ? (obj['font'] as Record<string, unknown>)
          : obj

    const lyricsObj =
      typeof targetObj['lyrics'] === 'object' && targetObj['lyrics'] !== null
        ? (targetObj['lyrics'] as Record<string, unknown>)
        : {}

    // 支持向后兼容旧版扁平 lyrics 配置: { lyrics: { fontFamily: string, fontSize: number | string } }
    const flatFont = typeof lyricsObj['fontFamily'] === 'string' && lyricsObj['fontFamily'].trim().length > 0
      ? lyricsObj['fontFamily'].trim()
      : undefined
    const flatSize = lyricsObj['fontSize']
    let parsedFlatSize: number = NaN
    if (typeof flatSize === 'number') {
      parsedFlatSize = flatSize
    } else if (typeof flatSize === 'string') {
      const parsedFloat = parseFloat(flatSize)
      if (Number.isFinite(parsedFloat)) {
        parsedFlatSize = parsedFloat
      }
    }

    const bodyObj =
      typeof lyricsObj['body'] === 'object' && lyricsObj['body'] !== null
        ? (lyricsObj['body'] as Record<string, unknown>)
        : (flatFont !== undefined || Number.isFinite(parsedFlatSize) ? { fontFamily: flatFont, fontSize: flatSize } : undefined)

    const defaultBody = flatFont !== undefined || Number.isFinite(parsedFlatSize)
      ? {
          fontFamily: sanitizeFontFamily(flatFont, DEFAULT_TYPOGRAPHY_CONFIG.lyrics.body.fontFamily),
          fontSize: Number.isFinite(parsedFlatSize)
            ? Math.round(clamp(parsedFlatSize, 14, 36))
            : DEFAULT_TYPOGRAPHY_CONFIG.lyrics.body.fontSize
        }
      : DEFAULT_TYPOGRAPHY_CONFIG.lyrics.body

    const transObj =
      typeof lyricsObj['translation'] === 'object' && lyricsObj['translation'] !== null
        ? (lyricsObj['translation'] as Record<string, unknown>)
        : undefined

    return {
      ui: parseFontItemConfig(targetObj['ui'], DEFAULT_TYPOGRAPHY_CONFIG.ui, 12, 20),
      hint: parseFontItemConfig(targetObj['hint'], DEFAULT_TYPOGRAPHY_CONFIG.hint, 12, 16),
      lyrics: {
        body: parseFontItemConfig(bodyObj, defaultBody, 14, 36),
        translation: parseFontItemConfig(transObj, DEFAULT_TYPOGRAPHY_CONFIG.lyrics.translation, 12, 22),
        showTranslation: typeof lyricsObj['showTranslation'] === 'boolean'
          ? lyricsObj['showTranslation']
          : DEFAULT_TYPOGRAPHY_CONFIG.lyrics.showTranslation
      }
    }
  }

  // 缺省回退返回深拷贝, 禁止外泄 DEFAULT 单例引用 (lyrics 嵌套对象必须逐层拷贝)
  return {
    ...DEFAULT_TYPOGRAPHY_CONFIG,
    ui: { ...DEFAULT_TYPOGRAPHY_CONFIG.ui },
    hint: { ...DEFAULT_TYPOGRAPHY_CONFIG.hint },
    lyrics: {
      body: { ...DEFAULT_TYPOGRAPHY_CONFIG.lyrics.body },
      translation: { ...DEFAULT_TYPOGRAPHY_CONFIG.lyrics.translation },
      showTranslation: DEFAULT_TYPOGRAPHY_CONFIG.lyrics.showTranslation
    }
  }
}


