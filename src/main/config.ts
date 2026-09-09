import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

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
 * 'wallpaper': 自定义本地图片壁纸
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
 * 自定义壁纸详细微调配置项 (支持静态图片与动态视频格式)
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
  /** 视频壁纸是否静音 (默认 true, 避免壁纸自带音频与音乐播放冲突) */
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
 * 整合云母、自定义壁纸等多种视觉背景，便于后续横向扩充更多效果
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
  /** 气泡弹窗展开宽度 (单位 px, 范围 160 ~ 480, 默认 360) */
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
  /** 明暗度微调偏移量 (范围 -0.2 ~ +0.2, 默认 0, 负值更深邃, 正值更通透) */
  brightness: number
  /** 对比度微调系数 (范围 0.8 ~ 1.2, 默认 1.0) */
  contrast: number
}

/**
 * 窗口相关配置项
 */
export interface WindowConfig {
  /**
   * 是否启用沉浸式效果 (无边框模式)
   * false: 传统窗口, 带有系统原生标题栏与边框
   * true: 沉浸式窗口, 无系统边框, 不绘制最小化/最大化按钮
   */
  immersive: boolean
  /**
   * 主题与明暗模式微调配置
   */
  theme: ThemeConfig
  /**
   * 窗口背景效果 (统一承载云母、壁纸等效果)
   */
  background: BackgroundConfig
  /**
   * 左侧滑出气泡弹窗抽屉配置
   */
  sidebar: SidebarConfig
  /**
   * 向下兼容字段: 云母效果配置
   */
  mica: MicaConfig
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
  mpd: MpdConfig
}

/**
 * 默认云母配置
 */
export const DEFAULT_MICA_CONFIG: MicaConfig = {
  enabled: false,
  grainOpacity: 0.035,
  tintOpacity: 0.05,
  style: 'default',
  edgeHighlight: 0.08,
  border: false
}

/**
 * 默认壁纸配置
 */
export const DEFAULT_WALLPAPER_CONFIG: WallpaperConfig = {
  path: '',
  blur: 0,
  overlayOpacity: 0.5,
  fit: 'cover',
  muted: true,
  loop: true,
  playbackRate: 1.0
}

/**
 * 默认背景配置
 */
export const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
  mode: 'default',
  mica: DEFAULT_MICA_CONFIG,
  wallpaper: DEFAULT_WALLPAPER_CONFIG
}

/**
 * 默认主题与明暗模式配置
 */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'dark',
  brightness: 0,
  contrast: 1.0
}

/**
 * 默认侧边气泡弹窗抽屉配置
 */
export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  enabled: true,
  glowHint: true,
  triggerWidth: 30,
  closeBuffer: 40,
  triggerDelay: 80,
  closeDelay: 300,
  animationDuration: 280,
  animationEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  width: 360,
  verticalExtension: 50,
  opacity: 0.78
}

/**
 * 默认配置 (当配置文件不存在或缺省字段时使用)
 */
export const DEFAULT_CONFIG: AppConfig = {
  window: {
    immersive: false,
    theme: DEFAULT_THEME_CONFIG,
    background: DEFAULT_BACKGROUND_CONFIG,
    sidebar: DEFAULT_SIDEBAR_CONFIG,
    mica: DEFAULT_MICA_CONFIG
  },
  mpd: {
    host: '127.0.0.1',
    port: 6600,
    streamPort: 8000
  }
}

/**
 * 数值区间钳位辅助函数
 */
function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min
  return Math.min(Math.max(val, min), max)
}

/**
 * 解析并校验主题与明暗模式配置
 */
export function parseThemeConfig(rawTheme: unknown): ThemeConfig {
  if (typeof rawTheme === 'object' && rawTheme !== null) {
    const obj = rawTheme as Record<string, unknown>
    const modeCandidate = obj['mode']
    const mode: 'dark' | 'light' = modeCandidate === 'light' ? 'light' : 'dark'

    return {
      mode,
      brightness: typeof obj['brightness'] === 'number'
        ? clamp(obj['brightness'], -0.2, 0.2)
        : DEFAULT_THEME_CONFIG.brightness,
      contrast: typeof obj['contrast'] === 'number'
        ? clamp(obj['contrast'], 0.8, 1.2)
        : DEFAULT_THEME_CONFIG.contrast
    }
  }

  return DEFAULT_THEME_CONFIG
}

/**
 * 解析并校验云母配置, 支持 boolean 简写与详细对象双模式
 */
export function parseMicaConfig(rawMica: unknown): MicaConfig {
  if (typeof rawMica === 'boolean') {
    return {
      ...DEFAULT_MICA_CONFIG,
      enabled: rawMica
    }
  }

  if (typeof rawMica === 'object' && rawMica !== null) {
    const obj = rawMica as Record<string, unknown>
    const styleCandidate = obj['style']
    const validStyles: MicaStyle[] = ['default', 'cool', 'neutral', 'warm']
    const style: MicaStyle = typeof styleCandidate === 'string' && validStyles.includes(styleCandidate as MicaStyle)
      ? (styleCandidate as MicaStyle)
      : DEFAULT_MICA_CONFIG.style

    return {
      enabled: typeof obj['enabled'] === 'boolean' ? obj['enabled'] : DEFAULT_MICA_CONFIG.enabled,
      grainOpacity: typeof obj['grainOpacity'] === 'number'
        ? clamp(obj['grainOpacity'], 0, 0.1)
        : DEFAULT_MICA_CONFIG.grainOpacity,
      tintOpacity: typeof obj['tintOpacity'] === 'number'
        ? clamp(obj['tintOpacity'], 0, 0.2)
        : DEFAULT_MICA_CONFIG.tintOpacity,
      style,
      edgeHighlight: typeof obj['edgeHighlight'] === 'number'
        ? clamp(obj['edgeHighlight'], 0, 0.2)
        : DEFAULT_MICA_CONFIG.edgeHighlight,
      border: typeof obj['border'] === 'boolean' ? obj['border'] : DEFAULT_MICA_CONFIG.border
    }
  }

  return DEFAULT_MICA_CONFIG
}

/**
 * 展开家目录路径 (~ 替换为用户家目录绝对路径)
 */
export function resolveHomePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') return ''
  const trimmed = filePath.trim()
  if (trimmed === '~') {
    return app.getPath('home')
  }
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return join(app.getPath('home'), trimmed.slice(2))
  }
  return trimmed
}

/**
 * 解析并校验自定义壁纸配置
 */
export function parseWallpaperConfig(rawWallpaper: unknown): WallpaperConfig {
  if (typeof rawWallpaper === 'object' && rawWallpaper !== null) {
    const obj = rawWallpaper as Record<string, unknown>
    const validFits: WallpaperFit[] = ['cover', 'contain', 'fill']
    const fitCandidate = obj['fit']
    const fit: WallpaperFit = typeof fitCandidate === 'string' && validFits.includes(fitCandidate as WallpaperFit)
      ? (fitCandidate as WallpaperFit)
      : DEFAULT_WALLPAPER_CONFIG.fit

    return {
      path: typeof obj['path'] === 'string' ? resolveHomePath(obj['path']) : DEFAULT_WALLPAPER_CONFIG.path,
      blur: typeof obj['blur'] === 'number' ? clamp(obj['blur'], 0, 50) : DEFAULT_WALLPAPER_CONFIG.blur,
      overlayOpacity: typeof obj['overlayOpacity'] === 'number'
        ? clamp(obj['overlayOpacity'], 0, 1)
        : DEFAULT_WALLPAPER_CONFIG.overlayOpacity,
      fit,
      muted: typeof obj['muted'] === 'boolean' ? obj['muted'] : DEFAULT_WALLPAPER_CONFIG.muted,
      loop: typeof obj['loop'] === 'boolean' ? obj['loop'] : DEFAULT_WALLPAPER_CONFIG.loop,
      playbackRate: typeof obj['playbackRate'] === 'number'
        ? clamp(obj['playbackRate'], 0.25, 2.0)
        : DEFAULT_WALLPAPER_CONFIG.playbackRate
    }
  }

  return DEFAULT_WALLPAPER_CONFIG
}

/**
 * 解析并校验窗口背景统一效果配置 (支持 mode, mica, wallpaper 及其向下兼容回退)
 */
export function parseBackgroundConfig(rawBackground: unknown, legacyMica: unknown): BackgroundConfig {
  // 场景 1: 显式配置了 window.background 对象
  if (typeof rawBackground === 'object' && rawBackground !== null) {
    const bgObj = rawBackground as Record<string, unknown>
    const modeCandidate = bgObj['mode']
    const validModes: BackgroundMode[] = ['default', 'mica', 'wallpaper']

    let mode: BackgroundMode = 'default'
    if (typeof modeCandidate === 'string' && validModes.includes(modeCandidate as BackgroundMode)) {
      mode = modeCandidate as BackgroundMode
    } else if (bgObj['wallpaper'] && typeof (bgObj['wallpaper'] as Record<string, unknown>)['path'] === 'string') {
      mode = 'wallpaper'
    }

    const mica = parseMicaConfig(bgObj['mica'] ?? legacyMica)
    const wallpaper = parseWallpaperConfig(bgObj['wallpaper'])

    // 同步 mica.enabled 状态与当前激活的 mode
    mica.enabled = mode === 'mica'

    return {
      mode,
      mica,
      wallpaper
    }
  }

  // 场景 2: 未配置 window.background, 但配置了旧版 window.mica
  if (legacyMica !== undefined && legacyMica !== null) {
    const mica = parseMicaConfig(legacyMica)
    const mode: BackgroundMode = mica.enabled ? 'mica' : 'default'
    return {
      mode,
      mica,
      wallpaper: DEFAULT_WALLPAPER_CONFIG
    }
  }

  // 场景 3: 缺省回退
  return DEFAULT_BACKGROUND_CONFIG
}

/**
 * 解析并校验侧边气泡弹窗抽屉配置项
 */
export function parseSidebarConfig(rawSidebar: unknown): SidebarConfig {
  if (typeof rawSidebar === 'boolean') {
    return {
      ...DEFAULT_SIDEBAR_CONFIG,
      enabled: rawSidebar
    }
  }

  if (typeof rawSidebar === 'object' && rawSidebar !== null) {
    const obj = rawSidebar as Record<string, unknown>
    const rawCloseBuffer = typeof obj['closeDistance'] === 'number'
      ? obj['closeDistance']
      : typeof obj['closeBuffer'] === 'number'
        ? obj['closeBuffer']
        : typeof obj['closeWidth'] === 'number'
          ? obj['closeWidth']
          : DEFAULT_SIDEBAR_CONFIG.closeBuffer

    return {
      enabled: typeof obj['enabled'] === 'boolean' ? obj['enabled'] : DEFAULT_SIDEBAR_CONFIG.enabled,
      glowHint: typeof obj['glowHint'] === 'boolean' ? obj['glowHint'] : DEFAULT_SIDEBAR_CONFIG.glowHint,
      triggerWidth: typeof obj['triggerWidth'] === 'number'
        ? clamp(obj['triggerWidth'], 4, 120)
        : DEFAULT_SIDEBAR_CONFIG.triggerWidth,
      closeBuffer: clamp(rawCloseBuffer, 0, 200),
      triggerDelay: typeof obj['triggerDelay'] === 'number'
        ? clamp(obj['triggerDelay'], 0, 2000)
        : DEFAULT_SIDEBAR_CONFIG.triggerDelay,
      closeDelay: typeof obj['closeDelay'] === 'number'
        ? clamp(obj['closeDelay'], 0, 3000)
        : DEFAULT_SIDEBAR_CONFIG.closeDelay,
      animationDuration: typeof obj['animationDuration'] === 'number'
        ? clamp(obj['animationDuration'], 100, 1000)
        : DEFAULT_SIDEBAR_CONFIG.animationDuration,
      animationEasing: typeof obj['animationEasing'] === 'string' && obj['animationEasing'].trim().length > 0
        ? obj['animationEasing'].trim()
        : DEFAULT_SIDEBAR_CONFIG.animationEasing,
      width: typeof obj['width'] === 'number'
        ? clamp(obj['width'], 160, 480)
        : DEFAULT_SIDEBAR_CONFIG.width,
      verticalExtension: typeof obj['verticalExtension'] === 'number'
        ? clamp(obj['verticalExtension'], 0, 200)
        : typeof obj['verticalExpansion'] === 'number'
          ? clamp(obj['verticalExpansion'], 0, 200)
          : DEFAULT_SIDEBAR_CONFIG.verticalExtension,
      opacity: typeof obj['opacity'] === 'number'
        ? clamp(obj['opacity'], 0, 1)
        : typeof obj['bgOpacity'] === 'number'
          ? clamp(obj['bgOpacity'], 0, 1)
          : DEFAULT_SIDEBAR_CONFIG.opacity
    }
  }

  return DEFAULT_SIDEBAR_CONFIG
}

/**
 * 剥除 JSON 文本中的单行与多行注释 (支持 JSONC)
 * 严格保护字符串字面量内的斜杠与转义符 (例如 "http://..." 不会被破坏)
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

    // 不在字符串内, 检查是否进入注释
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
 * 获取运行时配置文件的默认绝对路径 (~/.config/lpip-player/config.json)
 */
export function getDefaultConfigPath(): string {
  const configHome = process.env['XDG_CONFIG_HOME'] || join(app.getPath('home'), '.config')
  return join(configHome, 'lpip-player', 'config.json')
}

/**
 * 安全加载运行时配置文件
 * 若文件不存在、无法读取或 JSON 解析失败, 则安全回退至默认配置
 * 
 * @param customPath 可选的自定义配置文件绝对路径 (方便自动化验证与覆盖)
 */
export function loadConfig(customPath?: string): AppConfig {
  const configPath = customPath || process.env['LPIP_CONFIG_PATH'] || getDefaultConfigPath()

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    // 预先剥离单行与多行中文注释 (支持 JSONC)
    const cleanJson = stripJsonComments(raw)
    const parsed = JSON.parse(cleanJson) as Partial<AppConfig>
    const theme = parseThemeConfig(parsed.window?.theme)
    const background = parseBackgroundConfig(parsed.window?.background, parsed.window?.mica)
    const sidebar = parseSidebarConfig(parsed.window?.sidebar)

    return {
      window: {
        immersive: typeof parsed.window?.immersive === 'boolean'
          ? parsed.window.immersive
          : DEFAULT_CONFIG.window.immersive,
        theme,
        background,
        sidebar,
        mica: background.mica
      },
      mpd: {
        host: typeof parsed.mpd?.host === 'string' ? parsed.mpd.host : DEFAULT_CONFIG.mpd.host,
        port: typeof parsed.mpd?.port === 'number' ? parsed.mpd.port : DEFAULT_CONFIG.mpd.port,
        streamPort: typeof parsed.mpd?.streamPort === 'number' ? parsed.mpd.streamPort : DEFAULT_CONFIG.mpd.streamPort
      }
    }
  } catch {
    // 遇到解析异常或无权限时, 安全使用默认配置
    return DEFAULT_CONFIG
  }
}
