import type { LyricLine } from '../types/music'

/**
 * 行内双语分隔符: 原文与译文写在同一 LRC 行、由 U+2009 THIN SPACE 隔开
 * (实测曲库分隔符: 原文 <U+2009> 译文, e.g. `[00:06.74]原文 译文`)
 */
const INLINE_BILINGUAL_SEP = '\u2009'

/**
 * 判断文本是否为 CJK (译文侧判定用): 含任一中日韩统一表意文字即视为 CJK
 */
function containsCjk(text: string): boolean {
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(text)
}

/**
 * 解析 LRC 纯文本歌词为带时间戳的结构化行
 *
 * 双语拆分规则 (原文与译文同行、由 U+2009 THIN SPACE 隔开):
 * - 时间戳解析、四舍五入到 0.01s、空行过滤、按时间稳定排序保持原语义
 * - 单行文本按 THIN SPACE 切分: 切分后首段作 primary,
 *   剩余段用 ' / ' 拼成 secondary (多段全保留, 信息零丢失)
 * - 切分必须满足双侧判定: 左侧含非 CJK 字符 (原文侧)、右侧含 CJK 字符 (译文侧),
 *   否则视为普通行内空格 (如纯中文行内空格、纯外文行内空格), 保持单行原样
 * - THIN SPACE 出现在行首/行尾 (首尾空白) 时不参与切分
 * - 单语行 (无分隔符或判定不通过) 不写 secondary 字段
 *   (渲染层 `line.secondary &&` 保持单语单行原样)
 * - 归并后按新行重编 id (0-based 连续)
 */
export function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n')
  const result: { time: number; text: string }[] = []
  const timeRegex = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const timestamps: number[] = []
    let match: RegExpExecArray | null
    timeRegex.lastIndex = 0

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const mins = Number.parseInt(match[1], 10)
      const secs = Number.parseFloat(match[2])
      timestamps.push(mins * 60 + secs)
    }

    const text = trimmed.replace(timeRegex, '').trim()
    if (timestamps.length > 0 && text) {
      for (const t of timestamps) {
        result.push({
          time: Math.round(t * 100) / 100,
          text
        })
      }
    }
  }

  // 稳定排序: 同时间戳组内保持文件先后, 后续归并直接取组内第 1 行为主
  result.sort((a, b) => a.time - b.time)

  // 行内双语拆分: 同行原文 <U+2009> 译文 → primary + secondary
  const splitInlineBilingual = (text: string): { primary: string; secondary?: string } => {
    const parts = text.split(INLINE_BILINGUAL_SEP)
    if (parts.length < 2) return { primary: text }
    // 首尾 THIN SPACE 属行首/行尾空白, 剔除空段后若不足两段则不拆分
    const segs = parts.map((p) => p.trim()).filter((p) => p.length > 0)
    if (segs.length < 2) return { primary: text }
    const head = segs[0]
    const tail = segs.slice(1).join(' / ')
    // 双侧判定: 左侧须含非 CJK 字符 (原文侧), 右侧须含 CJK 字符 (译文侧)
    const headHasNonCjk = /[^\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\s]/.test(head)
    if (!headHasNonCjk || !containsCjk(tail)) return { primary: text }
    return { primary: head, secondary: tail }
  }

  const merged: LyricLine[] = []
  let i = 0
  while (i < result.length) {
    let j = i + 1
    while (j < result.length && result[j].time === result[i].time) {
      j++
    }
    const group = result.slice(i, j)
    if (group.length === 1) {
      // 同时间戳仅一行: 尝试行内双语拆分 (同行原文 <U+2009> 译文)
      const split = splitInlineBilingual(group[0].text)
      merged.push({
        id: merged.length,
        primary: split.primary,
        ...(split.secondary !== undefined ? { secondary: split.secondary } : {}),
        time: group[0].time
      })
    } else {
      merged.push({
        id: merged.length,
        primary: group[0].text,
        secondary: group.slice(1).map((g) => g.text).join(' / '),
        time: group[0].time
      })
    }
    i = j
  }

  return merged
}
