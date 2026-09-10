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
 * 默认频谱可视化配置
 */
export const DEFAULT_VISUALIZER_CONFIG: VisualizerConfig = {
  enabled: true,
  height: 160,
  opacity: 0.85,
  style: 'blueprint'
}

/**
 * 数值区间钳位辅助函数
 */
function clamp(val: number, min: number, max: number): number {
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
