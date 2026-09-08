import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import type { WallpaperConfig } from './config'

/**
 * 常见图片扩展名到 MIME 类型的映射字典
 */
const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml'
}

/**
 * 最大支持加载的壁纸单文件尺寸 (30MB), 避免超大非图片文件撑爆内存
 */
const MAX_WALLPAPER_BYTES = 30 * 1024 * 1024

/**
 * 壁纸解析与样式注入模型
 */
export interface WallpaperStylePayload {
  /** 图片安全 base64 Data URI */
  dataUri: string
  /** 高斯模糊半径 (单位 px) */
  blur: number
  /** 暗色遮罩不透明度 */
  overlayOpacity: number
  /** 缩放填充模式 */
  fit: string
}

/**
 * 读取本地壁纸文件并生成安全的渲染数据
 * 若文件不存在、无法读取或超过尺寸限制, 则返回 null 并回退
 * 
 * @param config 壁纸配置项
 */
export function resolveWallpaperPayload(config: WallpaperConfig): WallpaperStylePayload | null {
  const { path: filePath, blur, overlayOpacity, fit } = config

  if (!filePath) {
    return null
  }

  if (!existsSync(filePath)) {
    console.warn(`[lpip-player:wallpaper] 壁纸文件不存在, 已安全回退至深色基底: ${filePath}`)
    return null
  }

  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) {
      console.warn(`[lpip-player:wallpaper] 壁纸路径并非普通文件: ${filePath}`)
      return null
    }

    if (stat.size > MAX_WALLPAPER_BYTES) {
      console.warn(`[lpip-player:wallpaper] 壁纸文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB), 超过 30MB 限制`)
      return null
    }

    const ext = extname(filePath).toLowerCase()
    const mime = EXT_TO_MIME[ext] || 'image/png'
    const buffer = readFileSync(filePath)
    const base64 = buffer.toString('base64')
    const dataUri = `data:${mime};base64,${base64}`

    return {
      dataUri,
      blur,
      overlayOpacity,
      fit
    }
  } catch (error) {
    console.error(`[lpip-player:wallpaper] 读取壁纸文件失败: ${filePath}`, error)
    return null
  }
}
