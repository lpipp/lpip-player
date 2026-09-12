import { useEffect, useRef, useState } from 'react'
import type { MpdStatus, PlayStats } from '../../../types/music'
import './StatisticsDrawer.css'

/**
 * 优雅的黑胶唱片矢量占位图标
 */
function VinylDiscIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.45" />
      <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="2 2" />
      <circle cx="16" cy="16" r="6.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="16" cy="16" r="1.4" fill="#6ee7b7" />
    </svg>
  )
}

/**
 * 格式化累计播放秒数为紧凑中文时长: X 小时 Y 分 / Y 分 Z 秒 / Z 秒
 * (tabular-nums 铁律下数字等宽, 无前导零)
 */
export function formatTotalPlayTime(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return '0 秒'
  const sec = Math.floor(totalSec)
  if (sec < 60) return `${sec} 秒`
  const mins = Math.floor(sec / 60)
  if (mins < 60) {
    const rest = sec % 60
    return rest === 0 ? `${mins} 分` : `${mins} 分 ${rest} 秒`
  }
  const hours = Math.floor(mins / 60)
  const restMins = mins % 60
  return restMins === 0 ? `${hours} 小时` : `${hours} 小时 ${restMins} 分`
}

/**
 * 悬浮胶囊第五按键: 统计信息抽屉组件 (StatisticsDrawer)
 *
 * 核心架构:
 * 1. 单级展示 (无钻取): 顶部摘要卡 (累计播放时长 / 总播放次数 / 已统计曲目) + 降序排行
 * 2. 数据全量来自 MPD (sticker playCount + stats.playtime), 应用零本地状态
 * 3. 挂载拉取 + 切歌重拉 (onStatusChange 监听 currentSong.file 变化)
 * 4. 动静分离与 60fps 原生手势滚动; 整洁化: 副文本只留歌手, 计数保留为徽标
 */
export default function StatisticsDrawer() {
  const [stats, setStats] = useState<PlayStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})

  const isMountedRef = useRef(true)
  const fetchSeqRef = useRef(0)
  const lastSongFileRef = useRef<string | null>(null)

  // 拉取统计全量数据 (序列锁防乱序, 只收最新一次)
  const fetchStats = async (): Promise<void> => {
    const seq = ++fetchSeqRef.current
    try {
      if (window.electronAPI?.mpd?.getPlayStats) {
        const data = await window.electronAPI.mpd.getPlayStats()
        if (isMountedRef.current && seq === fetchSeqRef.current) {
          setStats(data)
          setLoading(false)
        }
      } else if (isMountedRef.current && seq === fetchSeqRef.current) {
        setLoading(false)
      }
    } catch (err) {
      console.error('[lpip-player:stats] 获取播放统计失败:', err)
      if (isMountedRef.current && seq === fetchSeqRef.current) setLoading(false)
    }
  }

  // 挂载拉取
  useEffect(() => {
    isMountedRef.current = true
    fetchStats()
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 切歌时重拉, 保持排行与摘要新鲜 (500ms 广播节拍内 file 变化即触发)
  useEffect(() => {
    const unsubscribe = window.electronAPI?.mpd.onStatusChange((status: MpdStatus) => {
      const file = status.currentSong?.file ?? null
      if (file !== lastSongFileRef.current) {
        lastSongFileRef.current = file
        fetchStats()
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [])

  // 封面加载失败键上限: 失败封面按文件键记忆以避免重复请求, 上限 200 键, 超限淘汰最早键
  const MAX_IMG_ERROR_KEYS = 200

  const handleImageError = (key: string): void => {
    setImgErrors((prev) => {
      if (prev[key]) return prev
      const keys = Object.keys(prev)
      if (keys.length < MAX_IMG_ERROR_KEYS) return { ...prev, [key]: true }
      // 超限时淘汰最早记录的一键, 保持内存有界
      const next: Record<string, boolean> = {}
      for (let i = 1; i < keys.length; i++) next[keys[i]] = true
      next[key] = true
      return next
    })
  }

  const entries = stats?.entries ?? []

  return (
    <div className="stats-drawer-wrapper">
      {/* 顶部摘要卡: 累计播放时长 / 总播放次数 / 已统计曲目 */}
      <div className="stats-summary-card">
        <div className="stats-summary-item">
          <span className="stats-summary-value stats-summary-time">
            {loading ? '…' : formatTotalPlayTime(stats?.totalPlayTimeSec ?? 0)}
          </span>
          <span className="stats-summary-label">累计播放时长</span>
        </div>
        <div className="stats-summary-divider" />
        <div className="stats-summary-item">
          <span className="stats-summary-value">{loading ? '…' : (stats?.totalPlayCount ?? 0)}</span>
          <span className="stats-summary-label">总播放次数</span>
        </div>
        <div className="stats-summary-divider" />
        <div className="stats-summary-item">
          <span className="stats-summary-value">{loading ? '…' : (stats?.trackedSongCount ?? 0)}</span>
          <span className="stats-summary-label">已统计曲目</span>
        </div>
      </div>

      {/* 排行滚动区 (液态玻璃微光滑动条) */}
      <div className="stats-drawer-scroll-area liquid-scrollbar">
        {loading ? (
          <div className="stats-empty-state">
            <span>播放统计整理中...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="stats-empty-state">
            <span>暂无播放记录</span>
          </div>
        ) : (
          <div className="stats-list">
            {entries.map((entry, index) => {
              const rank = index + 1
              const hasImgError = imgErrors[entry.file]
              const coverUrl = !hasImgError ? entry.coverUrl : null
              return (
                <div
                  key={entry.file}
                  className={`stats-item ${rank <= 3 ? 'stats-item-top' : ''}`}
                  title={`${entry.title} · 播放 ${entry.playCount} 次`}
                >
                  {/* 排名序号 */}
                  <span className="stats-rank">{rank}</span>

                  {/* 封面 (38px 圆角) */}
                  <div className="stats-cover-wrapper">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={entry.title}
                        className="stats-cover-img"
                        loading="lazy"
                        onError={() => handleImageError(entry.file)}
                      />
                    ) : (
                      <div className="stats-cover-placeholder">
                        <VinylDiscIcon />
                      </div>
                    )}
                  </div>

                  {/* 中段信息: 标题 > 歌手 (整洁化只留歌手) */}
                  <div className="stats-info">
                    <span className="stats-title">{entry.title}</span>
                    <span className="stats-artist">{entry.artist}</span>
                  </div>

                  {/* 右侧播放次数徽标 (整洁化计数保留, tabular-nums) */}
                  <span className="stats-count-badge">
                    {entry.playCount} 次
                  </span>
                  {/* e2e 降序断言探针 (不渲染, 仅 DOM 属性) */}
                  <span className="stats-count-probe" data-play-count={entry.playCount} aria-hidden="true" />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
