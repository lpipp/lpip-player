import type { TypographyConfig } from '../../../types/config'
import { DEFAULT_TYPOGRAPHY_CONFIG, sanitizeFontFamily, clamp } from '../../../types/config'

export { sanitizeFontFamily }

export interface FontPreset {
  label: string
  value: string
}

export const UI_FONT_PRESETS: FontPreset[] = [
  {
    label: '系统默认',
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif'
  },
  {
    label: '现代黑体',
    value: "'Inter', -apple-system, 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
  },
  {
    label: '优雅圆体',
    value: "'Quicksand', 'Varela Round', 'PingFang SC', sans-serif"
  },
  {
    label: '精密等宽',
    value: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"
  }
]

export const HINT_FONT_PRESETS: FontPreset[] = [
  {
    label: '系统等宽',
    value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "JetBrains Mono", monospace'
  },
  {
    label: '现代无衬线',
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", sans-serif'
  },
  {
    label: '精密工程',
    value: "'DIN Alternate', 'Bahnschrift', 'Segoe UI', sans-serif"
  }
]

export const LYRICS_BODY_FONT_PRESETS: FontPreset[] = [
  {
    label: '史诗衬线',
    value: "'Playfair Display', 'DejaVu Serif', 'Liberation Serif', 'Noto Serif CJK SC', 'Noto Serif SC', 'Source Han Serif SC', Georgia, serif"
  },
  {
    label: '文艺楷体',
    value: "'Kaiti SC', 'STKaiti', 'FZKai-Z03', serif"
  },
  {
    label: '现代黑体',
    value: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif"
  },
  {
    label: '手写意趣',
    value: "'Caveat', 'Kaiti SC', 'STKaiti', cursive"
  }
]

export const LYRICS_TRANS_FONT_PRESETS: FontPreset[] = [
  {
    label: '默认黑体',
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
  },
  {
    label: '文艺楷体',
    value: "'Kaiti SC', 'STKaiti', 'FZKai-Z03', serif"
  },
  {
    label: '极简黑体',
    value: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif"
  },
  {
    label: '优雅衬线',
    value: "'Noto Serif CJK SC', 'Source Han Serif SC', Georgia, serif"
  }
]

/**
 * 将字体配置即时注入 DOM 根节点 CSS 变量，确保全局毫秒级热重载
 */
export function applyTypographyToDOM(typography?: TypographyConfig | null): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const s = root.style
  const t = typography || DEFAULT_TYPOGRAPHY_CONFIG

  const uiFont = sanitizeFontFamily(t.ui?.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.ui.fontFamily)
  const rawUiSize = typeof t.ui?.fontSize === 'number' && Number.isFinite(t.ui.fontSize) ? t.ui.fontSize : DEFAULT_TYPOGRAPHY_CONFIG.ui.fontSize
  const uiSize = Math.round(clamp(rawUiSize, 11, 20))

  const hintFont = sanitizeFontFamily(t.hint?.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.hint.fontFamily)
  const rawHintSize = typeof t.hint?.fontSize === 'number' && Number.isFinite(t.hint.fontSize) ? t.hint.fontSize : DEFAULT_TYPOGRAPHY_CONFIG.hint.fontSize
  const hintSize = Math.round(clamp(rawHintSize, 9, 16))

  const lyricsBodyFont = sanitizeFontFamily(t.lyrics?.body?.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.lyrics.body.fontFamily)
  const rawLyricsBodySize = typeof t.lyrics?.body?.fontSize === 'number' && Number.isFinite(t.lyrics.body.fontSize) ? t.lyrics.body.fontSize : DEFAULT_TYPOGRAPHY_CONFIG.lyrics.body.fontSize
  const lyricsBodySize = Math.round(clamp(rawLyricsBodySize, 14, 36))

  const lyricsTransFont = sanitizeFontFamily(t.lyrics?.translation?.fontFamily, DEFAULT_TYPOGRAPHY_CONFIG.lyrics.translation.fontFamily)
  const rawLyricsTransSize = typeof t.lyrics?.translation?.fontSize === 'number' && Number.isFinite(t.lyrics.translation.fontSize) ? t.lyrics.translation.fontSize : DEFAULT_TYPOGRAPHY_CONFIG.lyrics.translation.fontSize
  const lyricsTransSize = Math.round(clamp(rawLyricsTransSize, 10, 22))

  s.setProperty('--font-family-ui', uiFont)
  s.setProperty('--font-size-ui', `${uiSize}px`)

  s.setProperty('--font-family-hint', hintFont)
  s.setProperty('--font-size-hint', `${hintSize}px`)

  s.setProperty('--font-family-lyrics-body', lyricsBodyFont)
  s.setProperty('--font-family-lyrics', lyricsBodyFont)
  s.setProperty('--font-size-lyrics-body', `${lyricsBodySize}px`)
  s.setProperty('--font-size-lyrics', `${lyricsBodySize}px`)

  s.setProperty('--font-family-lyrics-translation', lyricsTransFont)
  s.setProperty('--font-size-lyrics-translation', `${lyricsTransSize}px`)
}
