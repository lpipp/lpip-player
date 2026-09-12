import type { LyricLine } from '../types/music'

/**
 * 解析 LRC 纯文本歌词为带时间戳的结构化行
 *
 * 双语归并规则 (相同时间戳两行: 原文 + 译文):
 * - 时间戳解析、四舍五入到 0.01s、空行过滤、按时间稳定排序保持原语义
 * - 排序后把时间戳完全相等的连续行编为一组: 组内第 1 行作 primary,
 *   第 2 行起用 ' / ' 拼成一个 secondary (3 行以上同理拼入同一辅行, 信息零丢失)
 * - 主辅顺序严格按文件先后 (Array.sort 稳定, 同时间戳组内保持原文件顺序), 不看内容
 * - 时间戳不同 (哪怕只差 0.01s) 的相邻行保持独立成行, 不合并
 * - 单行成组时不写 secondary 字段 (渲染层 `line.secondary &&` 保持单语单行原样)
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

  const merged: LyricLine[] = []
  let i = 0
  while (i < result.length) {
    let j = i + 1
    while (j < result.length && result[j].time === result[i].time) {
      j++
    }
    const group = result.slice(i, j)
    if (group.length === 1) {
      merged.push({
        id: merged.length,
        primary: group[0].text,
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
