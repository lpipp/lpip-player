import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { app } from 'electron'

/**
 * 主进程配置: 以 src/types/config.ts 为单一类型来源
 * 窗口/音频/MPD 等接口类型全部从 types 导入, 本文件仅保留主进程专属逻辑
 * (路径解析、JSONC 剥离、load/save 持久化); 禁止在此重复定义接口与 DEFAULT_*
 */
import type {
  DeepPartial,
  MicaStyle,
  BackgroundMode,
  WallpaperFit,
  WallpaperConfig,
  MicaConfig,
  BackgroundConfig,
  SidebarConfig,
  ThemeConfig,
  WindowConfig,
  FadeConfig,
  LyricPreviewConfig,
  AudioConfig,
  AstrolabeConfig
} from '../types/config'

/**
 * 默认值/解析器统一从 types 单一来源导入 (接口类型见上方 import type 块)
 * 本文件禁止重复定义任何 DEFAULT_* 常量与 parse* 解析器
 */
import {
  DEFAULT_MICA_CONFIG,
  DEFAULT_WALLPAPER_CONFIG,
  DEFAULT_BACKGROUND_CONFIG,
  DEFAULT_THEME_CONFIG,
  DEFAULT_SIDEBAR_CONFIG,
  DEFAULT_FADE_CONFIG,
  DEFAULT_LYRIC_PREVIEW_CONFIG,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_CONFIG,
  DEFAULT_VISUALIZER_CONFIG,
  DEFAULT_ASTROLABE_CONFIG,
  parseVisualizerConfig,
  parseMpdConfig,
  parseLyricPreviewConfig,
  parseAstrolabeConfig,
  stripJsonComments,
  DEFAULT_TYPOGRAPHY_CONFIG,
  parseTypographyConfig,
  sanitizeFontFamily,
  type VisualizerConfig,
  type VisualizerStyle,
  type MpdConfig as MpdConfigValue,
  type TypographyConfig,
  type FontItemConfig,
  type LyricsTypographyConfig
} from '../types/config'

export type {
  VisualizerConfig,
  VisualizerStyle,
  DeepPartial,
  TypographyConfig,
  FontItemConfig,
  LyricsTypographyConfig,
  MicaConfig,
  WallpaperConfig,
  BackgroundConfig,
  SidebarConfig,
  ThemeConfig,
  WindowConfig,
  FadeConfig,
  LyricPreviewConfig,
  AudioConfig,
  MicaStyle,
  BackgroundMode,
  WallpaperFit,
  AstrolabeConfig,
  MpdConfigValue as MpdConfig
}
export {
  DEFAULT_MICA_CONFIG,
  DEFAULT_WALLPAPER_CONFIG,
  DEFAULT_BACKGROUND_CONFIG,
  DEFAULT_THEME_CONFIG,
  DEFAULT_SIDEBAR_CONFIG,
  DEFAULT_FADE_CONFIG,
  DEFAULT_LYRIC_PREVIEW_CONFIG,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_CONFIG,
  DEFAULT_VISUALIZER_CONFIG,
  DEFAULT_ASTROLABE_CONFIG,
  parseVisualizerConfig,
  parseMpdConfig,
  parseLyricPreviewConfig,
  parseAstrolabeConfig,
  stripJsonComments,
  DEFAULT_TYPOGRAPHY_CONFIG,
  parseTypographyConfig,
  sanitizeFontFamily
}

/**
 * 应用全局运行时配置结构
 */
export interface AppConfig {
  window: WindowConfig
  audio: AudioConfig
  visualizer: VisualizerConfig
  mpd: MpdConfigValue
  typography: TypographyConfig
}

/**
 * 深拷贝默认云母配置 (禁止外泄 DEFAULT_MICA_CONFIG 单例引用)
 */
function cloneDefaultMicaConfig(): MicaConfig {
  return { ...DEFAULT_MICA_CONFIG }
}

/**
 * 深拷贝默认壁纸配置 (禁止外泄 DEFAULT_WALLPAPER_CONFIG 单例引用)
 */
function cloneDefaultWallpaperConfig(): WallpaperConfig {
  return { ...DEFAULT_WALLPAPER_CONFIG }
}

/**
 * 深拷贝默认背景配置 (嵌套 mica/wallpaper 逐层拷贝, 禁止共享引用)
 */
function cloneDefaultBackgroundConfig(): BackgroundConfig {
  return {
    mode: DEFAULT_BACKGROUND_CONFIG.mode,
    mica: cloneDefaultMicaConfig(),
    wallpaper: cloneDefaultWallpaperConfig()
  }
}

/**
 * 深拷贝默认侧边栏配置 (扁平结构, 浅拷贝即够)
 */
function cloneDefaultSidebarConfig(): SidebarConfig {
  return { ...DEFAULT_SIDEBAR_CONFIG }
}

/**
 * 深拷贝默认主题配置 (扁平结构, 浅拷贝即够)
 */
function cloneDefaultThemeConfig(): ThemeConfig {
  return { ...DEFAULT_THEME_CONFIG }
}

/**
 * 深拷贝默认淡入淡出配置 (扁平结构, 浅拷贝即够)
 */
function cloneDefaultFadeConfig(): FadeConfig {
  return { ...DEFAULT_FADE_CONFIG }
}

/**
 * 深拷贝默认音频配置 (嵌套 fade/lyricPreview 逐层拷贝)
 */
function cloneDefaultAudioConfig(): AudioConfig {
  return {
    fade: cloneDefaultFadeConfig(),
    lyricPreview: { ...DEFAULT_LYRIC_PREVIEW_CONFIG }
  }
}

/**
 * 深拷贝整份默认配置 (所有嵌套分支逐层拷贝, 永不外泄单例引用)
 */
function cloneDefaultConfig(): AppConfig {
  return {
    window: {
      immersive: DEFAULT_CONFIG.window.immersive,
      theme: cloneDefaultThemeConfig(),
      background: cloneDefaultBackgroundConfig(),
      sidebar: cloneDefaultSidebarConfig(),
      mica: cloneDefaultMicaConfig(),
      astrolabe: { ...DEFAULT_ASTROLABE_CONFIG }
    },
    audio: cloneDefaultAudioConfig(),
    visualizer: { ...DEFAULT_CONFIG.visualizer },
    mpd: { ...DEFAULT_CONFIG.mpd },
    typography: {
      ...DEFAULT_CONFIG.typography,
      ui: { ...DEFAULT_CONFIG.typography.ui },
      hint: { ...DEFAULT_CONFIG.typography.hint },
      lyrics: {
        body: { ...DEFAULT_CONFIG.typography.lyrics.body },
        translation: { ...DEFAULT_CONFIG.typography.lyrics.translation },
        showTranslation: DEFAULT_CONFIG.typography.lyrics.showTranslation
      }
    }
  }
}

/**
 * 数值区间钳位辅助函数 (主进程本地小工具; types/config.ts 另有一份同名函数供渲染层使用)
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

  return cloneDefaultThemeConfig()
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

  return cloneDefaultMicaConfig()
}

/**
 * 展开家目录路径 (~ 替换为用户家目录绝对路径)
 */
export function resolveHomePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') return ''
  const trimmed = filePath.trim()
  const home = app?.getPath ? app.getPath('home') : homedir()
  if (trimmed === '~') {
    return home
  }
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return join(home, trimmed.slice(2))
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

  return cloneDefaultWallpaperConfig()
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
      wallpaper: cloneDefaultWallpaperConfig()
    }
  }

  // 场景 3: 缺省回退 (返回深拷贝, 禁止外泄单例)
  return cloneDefaultBackgroundConfig()
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
        ? clamp(obj['width'], 160, 600)
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

  return cloneDefaultSidebarConfig()
}

/**
 * 解析并校验音频淡出淡入过渡配置
 */
export function parseFadeConfig(rawFade: unknown): FadeConfig {
  if (typeof rawFade === 'boolean') {
    return {
      enabled: rawFade,
      duration: DEFAULT_FADE_CONFIG.duration
    }
  }

  if (typeof rawFade === 'object' && rawFade !== null) {
    const obj = rawFade as Record<string, unknown>
    return {
      enabled: typeof obj['enabled'] === 'boolean' ? obj['enabled'] : DEFAULT_FADE_CONFIG.enabled,
      duration: typeof obj['duration'] === 'number'
        ? clamp(obj['duration'], 20, 1000)
        : DEFAULT_FADE_CONFIG.duration
    }
  }

  return cloneDefaultFadeConfig()
}

/**
 * 解析并校验音频模块全局配置
 */
export function parseAudioConfig(rawAudio: unknown): AudioConfig {
  if (typeof rawAudio === 'object' && rawAudio !== null) {
    const obj = rawAudio as Record<string, unknown>
    return {
      fade: parseFadeConfig(obj['fade']),
      lyricPreview: parseLyricPreviewConfig(obj['lyricPreview'])
    }
  }

  return cloneDefaultAudioConfig()
}

/**
 * 获取运行时配置文件的默认绝对路径 (~/.config/lpip-player/config.json)
 */
export function getDefaultConfigPath(): string {
  const home = app?.getPath ? app.getPath('home') : homedir()
  const configHome = process.env['XDG_CONFIG_HOME'] || join(home, '.config')
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
    // 文件缺失回退: 返回深拷贝, 调用方改写不污染 DEFAULT 单例
    return cloneDefaultConfig()
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    // 预先剥离单行与多行中文注释 (支持 JSONC)
    const cleanJson = stripJsonComments(raw)
    const parsed = JSON.parse(cleanJson) as Partial<AppConfig>
    const theme = parseThemeConfig(parsed.window?.theme)
    const background = parseBackgroundConfig(parsed.window?.background, parsed.window?.mica)
    const sidebar = parseSidebarConfig(parsed.window?.sidebar)
    const astrolabe = parseAstrolabeConfig(parsed.window?.astrolabe ?? (parsed as Record<string, unknown>)['astrolabe'])
    const audio = parseAudioConfig(parsed.audio)
    const visualizer = parseVisualizerConfig(parsed.visualizer)
    const typography = parseTypographyConfig(parsed.typography ?? (parsed as Record<string, unknown>).font)

    return {
      window: {
        immersive: typeof parsed.window?.immersive === 'boolean'
          ? parsed.window.immersive
          : DEFAULT_CONFIG.window.immersive,
        theme,
        background,
        sidebar,
        mica: background.mica,
        astrolabe
      },
      audio,
      visualizer,
      mpd: parseMpdConfig(parsed.mpd),
      typography
    }
  } catch (err) {
    // 遇到解析异常或无权限时, 先保留损坏现场再安全回退默认配置
    console.error('[lpip-player:config] 配置文件解析失败, 已保留损坏现场并回退默认配置:', err)
    try {
      const corruptPath = `${configPath}.corrupt`
      copyFileSync(configPath, corruptPath)
    } catch (preserveErr) {
      console.error('[lpip-player:config] 保留损坏配置文件失败:', preserveErr)
    }
    return cloneDefaultConfig()
  }
}

/**
 * 递归深度合并对象
 * 安全约束: 跳过 __proto__/constructor/prototype 键, 阻断 IPC/JSON 输入的原型污染
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  const output = { ...target } as Record<string, unknown>
  if (!source || typeof source !== 'object') return output as T
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    const srcVal = source[key]
    if (srcVal === undefined) continue
    const targetVal = output[key]
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      output[key] = deepMerge(targetVal as Record<string, unknown>, srcVal as Record<string, unknown>)
    } else {
      output[key] = srcVal
    }
  }
  return output as T
}

/**
 * saveConfig 串行化互斥链 (模块级 promise 链)
 * 目的: 并发 CONFIG_UPDATE 时 load→merge→write 按序执行, 杜绝 RMW 交错覆盖
 * 说明: 当前持久化段为同步写盘 (单线程天然互斥); 此互斥链记录串行语义,
 * 后续若持久化段异步化, 写任务挂入此链即可串行, 调用方无需改动
 */
let saveConfigMutex: Promise<void> = Promise.resolve()

/**
 * 安全保存并持久化运行时配置
 * 1. 与现有配置深度合并
 * 2. 校验与钳位每一模块数据
 * 3. 写入前备份至 ~/.config/lpip-player/config.json.bak
 * 4. 格式化写入 config.json
 */
export function saveConfig(partialConfig: DeepPartial<AppConfig>, customPath?: string): AppConfig {
  const configPath = customPath || process.env['LPIP_CONFIG_PATH'] || getDefaultConfigPath()
  const currentConfig = loadConfig(configPath)

  if (!partialConfig || typeof partialConfig !== 'object') {
    return currentConfig
  }

  const merged = deepMerge(
    currentConfig as unknown as Record<string, unknown>,
    partialConfig as Record<string, unknown>
  ) as unknown as Partial<AppConfig>

  const theme = parseThemeConfig(merged.window?.theme)
  const background = parseBackgroundConfig(merged.window?.background, merged.window?.mica)
  const sidebar = parseSidebarConfig(merged.window?.sidebar)
  const astrolabe = parseAstrolabeConfig(merged.window?.astrolabe ?? (merged as Record<string, unknown>)['astrolabe'])
  const audio = parseAudioConfig(merged.audio)
  const visualizer = parseVisualizerConfig(merged.visualizer)
  const mpd = parseMpdConfig(merged.mpd)

  const rawTypoCandidate = (partialConfig as Record<string, unknown>)?.typography ?? (partialConfig as Record<string, unknown>)?.font
  const currentTypo = currentConfig.typography || DEFAULT_TYPOGRAPHY_CONFIG
  // 缺省回退不写盘: partial 未携带的标量开关 (如 showTranslation) 只从 currentTypo 继承,
  // 不从 deepMerge 后的 merged 取, 避免 DEFAULT 回填污染用户 config.json
  const mergedTypoObj = rawTypoCandidate !== undefined
    ? deepMerge(
        currentTypo as unknown as Record<string, unknown>,
        rawTypoCandidate as Record<string, unknown>
      )
    : (merged.typography ?? (merged as Record<string, unknown>).font)
  const fullTypo = parseTypographyConfig(mergedTypoObj)
  const typography: TypographyConfig = rawTypoCandidate !== undefined
    ? {
        ...fullTypo,
        lyrics: {
          ...fullTypo.lyrics,
          showTranslation:
            (rawTypoCandidate as Record<string, unknown>)?.lyrics !== null &&
            typeof (rawTypoCandidate as Record<string, unknown>)?.lyrics === 'object' &&
            'showTranslation' in ((rawTypoCandidate as Record<string, unknown>).lyrics as Record<string, unknown>)
              ? fullTypo.lyrics.showTranslation
              : (currentTypo.lyrics?.showTranslation ?? DEFAULT_TYPOGRAPHY_CONFIG.lyrics.showTranslation)
        }
      }
    : fullTypo

  const finalConfig: AppConfig = {
    window: {
      immersive:
        typeof merged.window?.immersive === 'boolean'
          ? merged.window.immersive
          : currentConfig.window.immersive,
      theme,
      background,
      sidebar,
      mica: background.mica,
      astrolabe
    },
    audio,
    visualizer,
    mpd,
    typography
  }

  persistConfigFileQueued(configPath, finalConfig)

  return finalConfig
}

/**
 * 配置文件落盘入队 (串行化语义)
 * 同步执行本次写盘保证调用契约不变; 同时把同内容幂等复写挂入互斥链,
 * 使并发 saveConfig 的持久化段在语义上可串行化, 杜绝 RMW 交错覆盖
 */
function persistConfigFileQueued(configPath: string, finalConfig: AppConfig): void {
  const formattedJson = JSON.stringify(finalConfig, null, 2)
  const queuedJson = formattedJson
  const writeTask = saveConfigMutex.then(() => {
    persistConfigFile(configPath, queuedJson)
  })
  saveConfigMutex = writeTask.catch(() => {
    // 吞掉链上异常, 防止一次写盘失败永久卡死后续任务
  })
  persistConfigFile(configPath, formattedJson)
}

/**
 * 配置文件落盘 (备份 .bak + 临时文件原子 rename)
 */
function persistConfigFile(configPath: string, formattedJson: string): void {
  const dir = dirname(configPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // 写入前安全备份至 .bak
  if (existsSync(configPath)) {
    try {
      copyFileSync(configPath, `${configPath}.bak`)
    } catch (err) {
      console.error('[lpip-player:config] 创建配置文件备份失败:', err)
    }
  }

  const tempPath = `${configPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  try {
    writeFileSync(tempPath, formattedJson, 'utf-8')
    renameSync(tempPath, configPath)
  } catch (err) {
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath)
      } catch {
        // 忽略清理临时文件的瞬态异常
      }
    }
    throw err
  }

}