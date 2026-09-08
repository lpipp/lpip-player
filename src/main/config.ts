import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

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
 * 默认配置 (当配置文件不存在或缺省字段时使用)
 */
export const DEFAULT_CONFIG: AppConfig = {
  window: {
    immersive: false
  },
  mpd: {
    host: '127.0.0.1',
    port: 6600,
    streamPort: 8000
  }
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
    const parsed = JSON.parse(raw) as Partial<AppConfig>

    return {
      window: {
        immersive: typeof parsed.window?.immersive === 'boolean'
          ? parsed.window.immersive
          : DEFAULT_CONFIG.window.immersive
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
