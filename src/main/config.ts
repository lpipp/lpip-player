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
   * 主窗口云母效果配置
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
 * 默认配置 (当配置文件不存在或缺省字段时使用)
 */
export const DEFAULT_CONFIG: AppConfig = {
  window: {
    immersive: false,
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

    return {
      window: {
        immersive: typeof parsed.window?.immersive === 'boolean'
          ? parsed.window.immersive
          : DEFAULT_CONFIG.window.immersive,
        mica: parseMicaConfig(parsed.window?.mica)
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
