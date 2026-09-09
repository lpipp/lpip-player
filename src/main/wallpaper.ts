import { existsSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import type { WallpaperConfig } from './config'

/**
 * 壁纸媒体类型
 */
export type WallpaperMediaType = 'image' | 'video'

/**
 * 支持的静态图片扩展名列表
 */
export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']

/**
 * 支持的动态视频扩展名列表
 */
export const VIDEO_EXTS = ['.mp4', '.webm', '.mkv', '.mov', '.avi']

/**
 * 常见图片与视频扩展名到 MIME 类型的映射字典
 */
export const EXT_TO_MIME: Record<string, string> = {
  // 图片类型
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  // 视频类型
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo'
}

/**
 * 最大支持加载的静态图片尺寸 (50MB) 与动态视频尺寸 (4GB)
 */
const MAX_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024

/**
 * 壁纸解析与样式注入模型
 */
export interface WallpaperStylePayload {
  /** 媒体类型: 'image' 为静态图片, 'video' 为动态视频 */
  mediaType: WallpaperMediaType
  /** 媒体安全 URL (基于 app-media:// 特权流协议) */
  mediaUrl: string
  /** 向下兼容字段 */
  imageUrl: string
  dataUri: string
  /** 高斯模糊半径 (单位 px) */
  blur: number
  /** 暗色遮罩不透明度 */
  overlayOpacity: number
  /** 缩放填充模式 ('cover' | 'contain' | 'fill') */
  fit: string
  /** 视频壁纸是否静音 */
  muted: boolean
  /** 视频壁纸是否循环播放 */
  loop: boolean
  /** 视频壁纸播放速率 (0.25 ~ 2.0) */
  playbackRate: number
}

/**
 * 读取本地壁纸文件并生成安全的渲染数据
 * 基于 app-media:// 特权流式协议直接将本地图片与视频交由 Chromium 与 GPU 解码，
 * 支持大尺寸 4K 视频、流式 Range 请求与零内存复制。
 * 
 * @param config 壁纸配置项
 */
export function resolveWallpaperPayload(config: WallpaperConfig): WallpaperStylePayload | null {
  const {
    path: filePath,
    blur,
    overlayOpacity,
    fit,
    muted = true,
    loop = true,
    playbackRate = 1.0
  } = config

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

    const ext = extname(filePath).toLowerCase()
    if (!EXT_TO_MIME[ext]) {
      console.warn(`[lpip-player:wallpaper] 不支持的壁纸文件扩展名: ${ext}`)
      return null
    }

    const isVideo = VIDEO_EXTS.includes(ext)
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES

    if (stat.size > maxBytes) {
      console.warn(`[lpip-player:wallpaper] 壁纸文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB), 超过限制`)
      return null
    }

    const mediaType: WallpaperMediaType = isVideo ? 'video' : 'image'
    const mediaUrl = `app-media://${encodeURI(filePath)}`

    return {
      mediaType,
      mediaUrl,
      imageUrl: mediaUrl,
      dataUri: mediaUrl,
      blur,
      overlayOpacity,
      fit,
      muted,
      loop,
      playbackRate
    }
  } catch (error) {
    console.error(`[lpip-player:wallpaper] 读取壁纸文件失败: ${filePath}`, error)
    return null
  }
}
