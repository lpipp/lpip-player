import { useEffect, useState, useRef, useCallback, type ReactNode, type ChangeEvent } from 'react'
import type { AppConfig, DeepPartial, BackgroundMode, MicaStyle, WallpaperFit, VisualizerStyle } from '../../../types/config'
import { DEFAULT_CONFIG } from '../../../types/config'
import { pcmPlayer } from '../services/pcmPlayer'
import './SettingsDrawer.css'

/**
 * 5 大设置模块标识符
 */
export type SettingsModuleId = 'window' | 'audio' | 'visualizer' | 'mpd' | 'about'

/**
 * 设置模块卡片元数据接口
 */
interface SettingsModuleMeta {
  id: SettingsModuleId
  title: string
  desc: string
  icon: ReactNode
}

/**
 * SVG 纯线条矢量图标库 (免第三方字体依赖)
 */
function WindowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function AudioWaveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="12" x2="4" y2="12.01" />
      <line x1="8" y1="8" x2="8" y2="16" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="16" y1="7" x2="16" y2="17" />
      <line x1="20" y1="11" x2="20" y2="13" />
    </svg>
  )
}

function SpectrumPulseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function ServerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  )
}

function AboutDiscIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeDasharray="3 3" />
    </svg>
  )
}

function BackChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function NextChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
    </svg>
  )
}

/**
 * 原生开关控件 (Toggle Switch)
 */
function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`liquid-toggle-btn ${checked ? 'checked' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          if (!disabled) onChange(!checked)
        }
      }}
    >
      <span className="liquid-toggle-thumb" />
    </button>
  )
}

/**
 * 原生滑轨控件 (Slider Control)
 */
function SliderControl({
  value,
  min,
  max,
  step = 1,
  displayValue,
  label,
  desc,
  onChange
}: {
  value: number
  min: number
  max: number
  step?: number
  displayValue: string
  label: string
  desc?: string
  onChange: (val: number) => void
}) {
  return (
    <div className="liquid-slider-block">
      <div className="liquid-slider-header">
        <div className="settings-control-info">
          <span className="settings-control-label">{label}</span>
          {desc && <span className="settings-control-desc">{desc}</span>}
        </div>
        <span className="liquid-slider-value">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number.parseFloat(e.target.value))}
        className="liquid-slider-input"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayValue}
      />
    </div>
  )
}

/**
 * 原生分段单选控件 (Segmented Control)
 */
function SegmentedControl<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { key: T; label: string }[]
  onChange: (val: T) => void
}) {
  return (
    <div className="liquid-segmented-group" role="radiogroup">
      {options.map((opt, idx) => {
        const isActive = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`liquid-segment-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(opt.key)}
            onKeyDown={(e) => {
              let nextIdx = -1
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                nextIdx = (idx + 1) % options.length
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                nextIdx = (idx - 1 + options.length) % options.length
              } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                onChange(opt.key)
              }
              if (nextIdx !== -1) {
                onChange(options[nextIdx].key)
                const parent = e.currentTarget.parentElement
                const buttons = parent?.querySelectorAll<HTMLButtonElement>('button')
                buttons?.[nextIdx]?.focus()
              }
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 偏好设置抽屉组件 (SettingsDrawer)
 *
 * 核心架构:
 * 1. 悬浮胶囊第 6 项入口专属渲染，适配 460px 展开宽度 (内容区域 404px，卡片定格 380px)
 * 2. 双级钻取画册流 (Two-Tier Drill-Down): 分类总览画册 ⟷ 设置详情微画卷
 * 3. 5 大设置模块精细化控件配置 (外观与窗口、音频与过渡、蓝图频谱、MPD 服务、关于播放器)
 * 4. 原生液态玻璃控制组 (ToggleSwitch, SliderControl, SegmentedControl) 零第三方 UI 依赖
 * 5. 数字防抖与等宽显示 (tabular-nums)
 * 6. 配置原子持久化 (~/.config/lpip-player/config.json 带 .bak) 与秒级即时热生效
 */
export default function SettingsDrawer() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [selectedModuleId, setSelectedModuleId] = useState<SettingsModuleId | null>(null)
  const [mpdConnected, setMpdConnected] = useState<boolean>(true)
  const [isTestingMpd, setIsTestingMpd] = useState<boolean>(false)
  const [hardwareSampleRate, setHardwareSampleRate] = useState<number>(44100)

  // 临时编辑状态缓存 (用于 MPD 连接参数等需手动确认保存的字段)
  const [mpdHostInput, setMpdHostInput] = useState('127.0.0.1')
  const [mpdPortInput, setMpdPortInput] = useState<string>('6600')
  const [mpdStreamPortInput, setMpdStreamPortInput] = useState<string>('8000')
  const [wallpaperPathInput, setWallpaperPathInput] = useState('')
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)

  const isMountedRef = useRef(true)
  const pendingUpdateRef = useRef<Record<string, unknown>>({})
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mpdTestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateSeqRef = useRef(0)
  const isFlushingRef = useRef(false)

  // 集中安全展示异常信息并清理既有定时器 (防内存泄漏)
  const showErrorMessage = useCallback((msg: string): void => {
    if (!isMountedRef.current) return
    setSaveErrorMessage(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setSaveErrorMessage(null)
    }, 3500)
  }, [])

  // 测试 MPD 服务端连接 (带并发防护)
  const testMpdConnection = useCallback(async (): Promise<void> => {
    if (isTestingMpd) return
    setIsTestingMpd(true)
    try {
      if (window.electronAPI?.mpd) {
        const status = await window.electronAPI.mpd.getStatus()
        if (isMountedRef.current) {
          setMpdConnected(Boolean(status && status.connected !== false && (status.playlistVersion !== undefined || status.connected === true)))
        }
      } else {
        if (isMountedRef.current) setMpdConnected(false)
      }
    } catch {
      if (isMountedRef.current) setMpdConnected(false)
    } finally {
      if (isMountedRef.current) setIsTestingMpd(false)
    }
  }, [isTestingMpd])

  // 挂载时拉取全量运行时配置并订阅热更新
  useEffect(() => {
    isMountedRef.current = true

    // 检测硬件自适应采样率
    try {
      const ctx = pcmPlayer.initAudioContext()
      if (ctx && ctx.sampleRate) {
        setHardwareSampleRate(ctx.sampleRate)
      }
    } catch {
      if (typeof window !== 'undefined' && window.AudioContext) {
        try {
          const tempCtx = new window.AudioContext()
          setHardwareSampleRate(tempCtx.sampleRate)
          tempCtx.close().catch(() => {})
        } catch {}
      }
    }

    if (window.electronAPI?.config) {
      window.electronAPI.config.get().then((cfg) => {
        if (!isMountedRef.current || !cfg) return
        setConfig(cfg)
        setMpdHostInput(cfg.mpd?.host ?? '127.0.0.1')
        setMpdPortInput(String(cfg.mpd?.port ?? 6600))
        setMpdStreamPortInput(String(cfg.mpd?.streamPort ?? 8000))
        setWallpaperPathInput(cfg.window?.background?.wallpaper?.path ?? '')
      })

      const unsub = window.electronAPI.config.onChange((cfg) => {
        if (!isMountedRef.current || !cfg) return
        // 若当前有正在进行中的滑动或未提交的防抖编辑，暂缓被外部广播覆盖以防数值跳动
        if (Object.keys(pendingUpdateRef.current).length > 0) return
        setConfig(cfg)
      })

      testMpdConnection()

      return () => {
        isMountedRef.current = false
        unsub()
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        if (errorTimerRef.current) {
          clearTimeout(errorTimerRef.current)
          errorTimerRef.current = null
        }
        if (mpdTestTimerRef.current) {
          clearTimeout(mpdTestTimerRef.current)
          mpdTestTimerRef.current = null
        }
        // 关键防护: 卸载时若存在未完成防抖落盘的变更，执行立即冲刷，杜绝用户滑块调整后快速关闭抽屉导致配置丢失
        if (Object.keys(pendingUpdateRef.current).length > 0 && window.electronAPI?.config?.update) {
          const emergencyPayload = structuredClone(pendingUpdateRef.current) as DeepPartial<AppConfig>
          pendingUpdateRef.current = {}
          window.electronAPI.config.update(emergencyPayload).catch((err) => {
            console.error('[SettingsDrawer:unmount] 卸载紧急落盘异常:', err)
          })
        }
      }
    }

    testMpdConnection()
    return () => {
      isMountedRef.current = false
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
        errorTimerRef.current = null
      }
      if (mpdTestTimerRef.current) {
        clearTimeout(mpdTestTimerRef.current)
        mpdTestTimerRef.current = null
      }
    }
  }, [testMpdConnection])

  // 外部配置同步更新输入框
  useEffect(() => {
    if (config.window?.background?.wallpaper?.path !== undefined) {
      setWallpaperPathInput(config.window.background.wallpaper.path)
    }
  }, [config.window?.background?.wallpaper?.path])

  useEffect(() => {
    if (config.mpd) {
      setMpdHostInput(config.mpd.host ?? '127.0.0.1')
      setMpdPortInput(String(config.mpd.port ?? 6600))
      setMpdStreamPortInput(String(config.mpd.streamPort ?? 8000))
    }
  }, [config.mpd])

  // 键盘无障碍导航: 在二级详情层时拦截 Escape 与 Backspace 优先平滑返回一级总览
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (selectedModuleId !== null) {
          e.stopImmediatePropagation()
          e.preventDefault()
          if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            ;(document.activeElement as HTMLElement).blur()
          } else {
            setSelectedModuleId(null)
          }
        }
      } else if (e.key === 'Backspace') {
        if (selectedModuleId !== null && document.activeElement && document.activeElement.tagName !== 'INPUT') {
          e.stopImmediatePropagation()
          e.preventDefault()
          setSelectedModuleId(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [selectedModuleId])

  // 安全防抖同步并持久化配置 (立即更新本地 React 状态，防抖写入磁盘与通知 IPC)
  const updateConfigDebounced = useCallback((partial: DeepPartial<AppConfig>, delayMs = 60): void => {
    // 1. 本地状态即时响应, 达到 60fps 零延迟视觉反馈
    setConfig((prev) => {
      const clone = structuredClone(prev) as unknown as Record<string, unknown>
      const mergeHelper = (target: Record<string, unknown>, src: Record<string, unknown>) => {
        for (const k of Object.keys(src)) {
          if (src[k] !== null && typeof src[k] === 'object' && !Array.isArray(src[k])) {
            if (!target[k] || typeof target[k] !== 'object') target[k] = {}
            mergeHelper(target[k] as Record<string, unknown>, src[k] as Record<string, unknown>)
          } else {
            target[k] = src[k]
          }
        }
      }
      mergeHelper(clone, partial as Record<string, unknown>)
      return clone as unknown as AppConfig
    })

    // 2. 将本次变更合并进 pendingUpdateRef 批次中
    const mergePending = (target: Record<string, unknown>, src: Record<string, unknown>) => {
      for (const k of Object.keys(src)) {
        if (src[k] !== null && typeof src[k] === 'object' && !Array.isArray(src[k])) {
          if (!target[k] || typeof target[k] !== 'object') target[k] = {}
          mergePending(target[k] as Record<string, unknown>, src[k] as Record<string, unknown>)
        } else {
          target[k] = src[k]
        }
      }
    }
    mergePending(pendingUpdateRef.current, partial as Record<string, unknown>)

    // 3. 防抖通知主进程持久化保存
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    const flush = async () => {
      if (isFlushingRef.current) return
      if (Object.keys(pendingUpdateRef.current).length === 0) return

      isFlushingRef.current = true
      const currentSeq = ++updateSeqRef.current
      const payload = structuredClone(pendingUpdateRef.current) as DeepPartial<AppConfig>
      pendingUpdateRef.current = {}

      try {
        if (window.electronAPI?.config?.update) {
          const res = await window.electronAPI.config.update(payload)
          if (!isMountedRef.current) return
          if (res?.success === false) {
            showErrorMessage(res.error ? `配置保存失败: ${res.error}` : '配置保存失败: 文件只读或无写权限')
            if (res.config) setConfig(res.config)
          } else if (res?.config && currentSeq === updateSeqRef.current && Object.keys(pendingUpdateRef.current).length === 0) {
            setConfig(res.config)
            setSaveErrorMessage(null)
          }
        }
      } catch (err) {
        console.error('[SettingsDrawer] 持久化配置异常:', err)
        if (isMountedRef.current) {
          showErrorMessage('配置持久化通信异常')
        }
      } finally {
        isFlushingRef.current = false
        // 若在异步写入期间累积了新的变更，调度下一轮刷新以确保最终状态一致
        if (Object.keys(pendingUpdateRef.current).length > 0) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = setTimeout(flush, 50)
        }
      }
    }

    if (delayMs === 0) {
      flush()
    } else {
      debounceTimerRef.current = setTimeout(flush, delayMs)
    }
  }, [showErrorMessage])

  // 立即同步无需防抖 (适用于开关、单选等离散项)
  const updateConfigImmediate = useCallback((partial: DeepPartial<AppConfig>): void => {
    updateConfigDebounced(partial, 0)
  }, [updateConfigDebounced])

  // 应用壁纸路径
  const handleApplyWallpaper = useCallback(() => {
    updateConfigImmediate({
      window: {
        background: {
          wallpaper: { path: wallpaperPathInput.trim() }
        }
      }
    })
  }, [wallpaperPathInput, updateConfigImmediate])

  // 保存并应用 MPD 配置
  const handleSaveMpd = useCallback(() => {
    const rawPort = Number.parseInt(mpdPortInput, 10)
    const validPort = !Number.isNaN(rawPort) && rawPort > 0 ? Math.min(65535, Math.max(1, rawPort)) : 6600
    const rawStream = Number.parseInt(mpdStreamPortInput, 10)
    const validStream = !Number.isNaN(rawStream) && rawStream > 0 ? Math.min(65535, Math.max(1, rawStream)) : 8000
    const validHost = mpdHostInput.trim() || '127.0.0.1'

    setMpdPortInput(String(validPort))
    setMpdStreamPortInput(String(validStream))
    setMpdHostInput(validHost)

    updateConfigImmediate({
      mpd: {
        host: validHost,
        port: validPort,
        streamPort: validStream
      }
    })
    if (mpdTestTimerRef.current) clearTimeout(mpdTestTimerRef.current)
    mpdTestTimerRef.current = setTimeout(testMpdConnection, 300)
  }, [mpdHostInput, mpdPortInput, mpdStreamPortInput, updateConfigImmediate, testMpdConnection])

  // 动态构建 5 大模块概览卡片信息
  const modulesMeta: SettingsModuleMeta[] = [
    {
      id: 'window',
      title: '外观与窗口',
      desc:
        config.window.background.mode === 'wallpaper'
          ? `自定义壁纸 · 模糊 ${config.window.background.wallpaper.blur}px · ${config.window.immersive ? '沉浸式' : '标准边框'}`
          : config.window.background.mode === 'mica'
            ? `云母材质 · ${config.window.background.mica.style} 微光 · ${config.window.immersive ? '沉浸式' : '标准边框'}`
            : `经典黑曜石 · ${config.window.immersive ? '沉浸式无边框' : '标准边框'}`,
      icon: <WindowIcon />
    },
    {
      id: 'audio',
      title: '音频与过渡',
      desc: config.audio.fade.enabled
        ? `淡入淡出 ${config.audio.fade.duration}ms · ${(hardwareSampleRate / 1000).toFixed(1)} kHz 自适应直通`
        : `硬切无过渡 · ${(hardwareSampleRate / 1000).toFixed(1)} kHz 硬件直通`,
      icon: <AudioWaveIcon />
    },
    {
      id: 'visualizer',
      title: '蓝图频谱',
      desc: config.visualizer.enabled
        ? `${
            config.visualizer.style === 'blueprint'
              ? '蓝图工程风'
              : config.visualizer.style === 'wave'
                ? '高频正弦波'
                : '制表柱状图'
          } · 高度 ${config.visualizer.height}px`
        : '频谱律动已关闭',
      icon: <SpectrumPulseIcon />
    },
    {
      id: 'mpd',
      title: 'MPD 服务',
      desc: `${config.mpd.host}:${config.mpd.port} · ${mpdConnected ? '已连接 (活跃)' : '离线 (未就绪)'}`,
      icon: <ServerIcon />
    },
    {
      id: 'about',
      title: '关于播放器',
      desc: 'lpip-player v0.1.0 · Model B 架构 · Electron + React',
      icon: <AboutDiscIcon />
    }
  ]

  const activeModuleMeta = modulesMeta.find((m) => m.id === selectedModuleId)

  return (
    <div className="settings-drawer-wrapper">
      {/* 视图 1: 5 大分类总览画册流 (Overview Tier) */}
      {!selectedModuleId && (
        <div className="settings-overview-container">
          {/* 顶部状态提示栏 */}
          <div className="settings-overview-toolbar">
            <div className="settings-toolbar-title-area">
              <span className="settings-toolbar-dot" />
              <span className="settings-toolbar-title">播放器偏好设置</span>
            </div>
            <span className="settings-toolbar-badge">实时热重载</span>
          </div>

          {saveErrorMessage && (
            <div className="settings-error-banner" role="alert">
              <span className="settings-error-dot" />
              <span className="settings-error-text">{saveErrorMessage}</span>
            </div>
          )}

          {/* 5 大分类画册卡片列表 (固定 380px 宽度) */}
          <div className="settings-scroll-area liquid-scrollbar">
            {modulesMeta.map((item) => (
              <button
                key={item.id}
                type="button"
                className="settings-category-card"
                onClick={() => setSelectedModuleId(item.id)}
                title={`点击进入【${item.title}】设置`}
              >
                <div className="settings-card-icon-box">{item.icon}</div>
                <div className="settings-card-content">
                  <span className="settings-card-title">{item.title}</span>
                  <span className="settings-card-desc">{item.desc}</span>
                </div>
                <span className="settings-card-arrow">
                  <NextChevronIcon />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 视图 2: 设置详情层 (Detail Tier) */}
      {selectedModuleId && activeModuleMeta && (
        <div className="settings-detail-container">
          {/* 顶部微画卷 Hero 头部 */}
          <header className="settings-detail-hero">
            <div className="settings-hero-nav">
              <button
                type="button"
                className="settings-back-btn"
                onClick={() => setSelectedModuleId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedModuleId(null)
                  }
                }}
                title="返回全部设置总览"
                aria-label="返回全部设置"
              >
                <BackChevronIcon />
                <span>全部设置</span>
              </button>
              <span className="settings-toolbar-badge">{activeModuleMeta.title}</span>
            </div>

            <div className="settings-hero-header">
              <div className="settings-hero-icon-box">{activeModuleMeta.icon}</div>
              <div className="settings-hero-info">
                <span className="settings-hero-title">{activeModuleMeta.title}</span>
                <span className="settings-hero-desc">{activeModuleMeta.desc}</span>
              </div>
            </div>
          </header>

          {saveErrorMessage && (
            <div className="settings-error-banner" role="alert">
              <span className="settings-error-dot" />
              <span className="settings-error-text">{saveErrorMessage}</span>
            </div>
          )}

          {/* 下方该模块的具体交互控件卡片流 (宽度定格 380px) */}
          <div className="settings-scroll-area liquid-scrollbar">
            {/* 模块 1: 外观与窗口 */}
            {selectedModuleId === 'window' && (
              <>
                {/* 窗口形态 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">窗口形态与标题栏</span>
                    <span className="settings-group-badge">{config.window.immersive ? '无边框' : '原生边框'}</span>
                  </div>
                  <div className="settings-control-row">
                    <div className="settings-control-info">
                      <span className="settings-control-label">沉浸式无边框模式</span>
                      <span className="settings-control-desc">隐藏系统原生标题栏与边缘边框，尽享极简全面屏视效 (切换时将即时无缝重构窗口)</span>
                    </div>
                    <ToggleSwitch
                      checked={config.window.immersive}
                      onChange={(checked) =>
                        updateConfigImmediate({
                          window: { immersive: checked }
                        })
                      }
                      label="沉浸式无边框模式"
                    />
                  </div>
                </div>

                {/* 背景材质渲染模式 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">窗口背景渲染模式</span>
                    <span className="settings-group-badge">{config.window.background.mode}</span>
                  </div>
                  <SegmentedControl<BackgroundMode>
                    value={config.window.background.mode}
                    options={[
                      { key: 'default', label: '经典黑曜石' },
                      { key: 'mica', label: '深色云母' },
                      { key: 'wallpaper', label: '自定义壁纸' }
                    ]}
                    onChange={(mode) =>
                      updateConfigImmediate({
                        window: {
                          background: { mode }
                        }
                      })
                    }
                  />
                </div>

                {/* 云母材质微调 (若当前激活或可供微调) */}
                {config.window.background.mode === 'mica' && (
                  <div className="settings-group-card">
                    <div className="settings-group-header">
                      <span className="settings-group-title">云母效果精细微调</span>
                      <span className="settings-group-badge">Mica Effect</span>
                    </div>

                    <div className="settings-control-row">
                      <div className="settings-control-info">
                        <span className="settings-control-label">色调微光预设风格</span>
                      </div>
                    </div>
                    <SegmentedControl<MicaStyle>
                      value={config.window.background.mica.style}
                      options={[
                        { key: 'default', label: '默认翡翠' },
                        { key: 'cool', label: '冷夜蓝' },
                        { key: 'neutral', label: '素雅黑' },
                        { key: 'warm', label: '暖木炭' }
                      ]}
                      onChange={(style) =>
                        updateConfigImmediate({
                          window: {
                            background: {
                              mica: { style }
                            }
                          }
                        })
                      }
                    />

                    <SliderControl
                      label="矿物晶体颗粒度"
                      desc="哑光细砂微弱噪点质感"
                      value={config.window.background.mica.grainOpacity}
                      min={0}
                      max={0.1}
                      step={0.005}
                      displayValue={`${(config.window.background.mica.grainOpacity * 100).toFixed(1)}%`}
                      onChange={(val) =>
                        updateConfigDebounced({
                          window: {
                            background: {
                              mica: { grainOpacity: val }
                            }
                          }
                        })
                      }
                    />

                    <SliderControl
                      label="环境微光漫射强度"
                      desc="边缘弥散光晕通透感"
                      value={config.window.background.mica.tintOpacity}
                      min={0}
                      max={0.2}
                      step={0.01}
                      displayValue={`${(config.window.background.mica.tintOpacity * 100).toFixed(0)}%`}
                      onChange={(val) =>
                        updateConfigDebounced({
                          window: {
                            background: {
                              mica: { tintOpacity: val }
                            }
                          }
                        })
                      }
                    />

                    <SliderControl
                      label="顶部内高光棱线"
                      desc="内嵌微棱镜极细光带"
                      value={config.window.background.mica.edgeHighlight}
                      min={0}
                      max={0.2}
                      step={0.01}
                      displayValue={`${(config.window.background.mica.edgeHighlight * 100).toFixed(0)}%`}
                      onChange={(val) =>
                        updateConfigDebounced({
                          window: {
                            background: {
                              mica: { edgeHighlight: val }
                            }
                          }
                        })
                      }
                    />

                    <div className="settings-control-row">
                      <div className="settings-control-info">
                        <span className="settings-control-label">全周边框微弱冷光轮廓</span>
                        <span className="settings-control-desc">在窗口最外边缘添加 1px 细微光轮廓</span>
                      </div>
                      <ToggleSwitch
                        checked={config.window.background.mica.border}
                        onChange={(checked) =>
                          updateConfigImmediate({
                            window: {
                              background: {
                                mica: { border: checked }
                              }
                            }
                          })
                        }
                        label="全周边框微弱冷光轮廓"
                      />
                    </div>
                  </div>
                )}

                {/* 自定义壁纸微调 */}
                {config.window.background.mode === 'wallpaper' && (
                  <div className="settings-group-card">
                    <div className="settings-group-header">
                      <span className="settings-group-title">自定义壁纸微调 (图片/视频)</span>
                      <span className="settings-group-badge">Wallpaper</span>
                    </div>

                    <div className="liquid-slider-block">
                      <span className="settings-control-label">壁纸本地绝对路径</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="liquid-text-input"
                          value={wallpaperPathInput}
                          placeholder="/path/to/wallpaper.jpg 或 .mp4"
                          onChange={(e) => setWallpaperPathInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyWallpaper()
                          }}
                        />
                        <button
                          type="button"
                          className="liquid-action-btn"
                          onClick={handleApplyWallpaper}
                        >
                          应用
                        </button>
                      </div>
                    </div>

                    <SliderControl
                      label="高斯模糊半径"
                      desc="降低背景杂乱度以凸显前景液态玻璃"
                      value={config.window.background.wallpaper.blur}
                      min={0}
                      max={50}
                      step={1}
                      displayValue={`${config.window.background.wallpaper.blur}px`}
                      onChange={(val) =>
                        updateConfigDebounced({
                          window: {
                            background: {
                              wallpaper: { blur: val }
                            }
                          }
                        })
                      }
                    />

                    <SliderControl
                      label="暗色遮罩不透明度"
                      desc="压暗背景提高歌词文字对比度"
                      value={config.window.background.wallpaper.overlayOpacity}
                      min={0}
                      max={1.0}
                      step={0.05}
                      displayValue={`${(config.window.background.wallpaper.overlayOpacity * 100).toFixed(0)}%`}
                      onChange={(val) =>
                        updateConfigDebounced({
                          window: {
                            background: {
                              wallpaper: { overlayOpacity: val }
                            }
                          }
                        })
                      }
                    />

                    <div className="liquid-slider-block">
                      <span className="settings-control-label">缩放填充方式</span>
                      <SegmentedControl<WallpaperFit>
                        value={config.window.background.wallpaper.fit}
                        options={[
                          { key: 'cover', label: '裁剪居中' },
                          { key: 'contain', label: '完整呈现' },
                          { key: 'fill', label: '强制拉伸' }
                        ]}
                        onChange={(fit) =>
                          updateConfigImmediate({
                            window: {
                              background: {
                                wallpaper: { fit }
                              }
                            }
                          })
                        }
                      />
                    </div>

                    <div className="settings-control-row">
                      <div className="settings-control-info">
                        <span className="settings-control-label">视频壁纸静音播放</span>
                        <span className="settings-control-desc">避免动态壁纸自带音频与音乐播放冲突</span>
                      </div>
                      <ToggleSwitch
                        checked={config.window.background.wallpaper.muted ?? true}
                        onChange={(checked) =>
                          updateConfigImmediate({
                            window: {
                              background: {
                                wallpaper: { muted: checked }
                              }
                            }
                          })
                        }
                        label="视频壁纸静音播放"
                      />
                    </div>

                    <div className="settings-control-row">
                      <div className="settings-control-info">
                        <span className="settings-control-label">视频壁纸循环播放</span>
                      </div>
                      <ToggleSwitch
                        checked={config.window.background.wallpaper.loop ?? true}
                        onChange={(checked) =>
                          updateConfigImmediate({
                            window: {
                              background: {
                                wallpaper: { loop: checked }
                              }
                            }
                          })
                        }
                        label="视频壁纸循环播放"
                      />
                    </div>
                  </div>
                )}

                {/* 悬浮胶囊与抽屉 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">悬浮胶囊与抽屉</span>
                    <span className="settings-group-badge">Sidebar</span>
                  </div>

                  <SliderControl
                    label="胶囊与抽屉底色通透度"
                    desc="调节黑曜石毛玻璃不透明度 (0.10 ~ 1.00)"
                    value={config.window.sidebar.opacity}
                    min={0.1}
                    max={1.0}
                    step={0.02}
                    displayValue={`${(config.window.sidebar.opacity * 100).toFixed(0)}%`}
                    onChange={(val) =>
                      updateConfigDebounced({
                        window: {
                          sidebar: { opacity: val }
                        }
                      })
                    }
                  />
                </div>
              </>
            )}

            {/* 模块 2: 音频与过渡 */}
            {selectedModuleId === 'audio' && (
              <>
                {/* 平滑淡入淡出过渡 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">切歌与歌词跳转过渡</span>
                    <span className="settings-group-badge">{config.audio.fade.enabled ? '已开启' : '硬切'}</span>
                  </div>

                  <div className="settings-control-row">
                    <div className="settings-control-info">
                      <span className="settings-control-label">平滑淡入淡出总开关</span>
                      <span className="settings-control-desc">切歌与寻道时毫秒级音量包络过渡，杜绝硬切爆音</span>
                    </div>
                    <ToggleSwitch
                      checked={config.audio.fade.enabled}
                      onChange={(checked) =>
                        updateConfigImmediate({
                          audio: {
                            fade: { enabled: checked }
                          }
                        })
                      }
                      label="平滑淡入淡出总开关"
                    />
                  </div>

                  {config.audio.fade.enabled && (
                    <SliderControl
                      label="淡入淡出过渡时长"
                      desc="推荐 80 ~ 200ms，毫秒级自适应音频世代切换"
                      value={config.audio.fade.duration}
                      min={20}
                      max={500}
                      step={10}
                      displayValue={`${config.audio.fade.duration}ms`}
                      onChange={(val) =>
                        updateConfigDebounced({
                          audio: {
                            fade: { duration: val }
                          }
                        })
                      }
                    />
                  )}
                </div>

                {/* 硬件音频管道自适应信息徽标 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">硬件音频直通管道</span>
                    <span className="liquid-status-badge connected">
                      <span className="liquid-status-dot-pulse" />
                      直通就绪
                    </span>
                  </div>

                  <div className="liquid-spec-list">
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">处理拓扑模型</span>
                      <span className="liquid-spec-val highlight">Model B / WebAudio PCM 直送</span>
                    </div>
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">自适应硬件采样率</span>
                      <span className="liquid-spec-val highlight">
                        {(hardwareSampleRate / 1000).toFixed(1)} kHz (硬件声卡直通)
                      </span>
                    </div>
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">音频流解码规格</span>
                      <span className="liquid-spec-val">
                        {(pcmPlayer.getSampleRate() / 1000).toFixed(1)} kHz · 16-bit 双声道 PCM
                      </span>
                    </div>
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">硬件时钟调度</span>
                      <span className="liquid-spec-val">AudioBufferSourceNode 自适应调度</span>
                    </div>
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">缓冲响应抖动</span>
                      <span className="liquid-spec-val">~35ms 零延迟极速启播</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 模块 3: 蓝图频谱 */}
            {selectedModuleId === 'visualizer' && (
              <>
                {/* 频谱律动总开关与风格 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">音频频谱律动引擎</span>
                    <span className="settings-group-badge">{config.visualizer.enabled ? '运行中' : '已关闭'}</span>
                  </div>

                  <div className="settings-control-row">
                    <div className="settings-control-info">
                      <span className="settings-control-label">频谱律动总开关</span>
                      <span className="settings-control-desc">在状态栏上方渲染 60fps 硬件加速音频频谱图层</span>
                    </div>
                    <ToggleSwitch
                      checked={config.visualizer.enabled}
                      onChange={(checked) =>
                        updateConfigImmediate({
                          visualizer: { enabled: checked }
                        })
                      }
                      label="频谱律动总开关"
                    />
                  </div>

                  {config.visualizer.enabled && (
                    <>
                      <div className="liquid-slider-block">
                        <span className="settings-control-label">视觉渲染风格</span>
                        <SegmentedControl<VisualizerStyle>
                          value={config.visualizer.style}
                          options={[
                            { key: 'blueprint', label: '蓝图工程' },
                            { key: 'wave', label: '正弦波形' },
                            { key: 'bars', label: '刻度柱状' }
                          ]}
                          onChange={(style) =>
                            updateConfigImmediate({
                              visualizer: { style }
                            })
                          }
                        />
                      </div>

                      <SliderControl
                        label="频谱画布高度"
                        desc="范围 60 ~ 300px，步长 10px"
                        value={config.visualizer.height}
                        min={60}
                        max={300}
                        step={10}
                        displayValue={`${config.visualizer.height}px`}
                        onChange={(val) =>
                          updateConfigDebounced({
                            visualizer: { height: val }
                          })
                        }
                      />

                      <SliderControl
                        label="整体不透明度"
                        desc="薄荷翡翠与微光散点粒子明暗通透度"
                        value={config.visualizer.opacity}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        displayValue={`${(config.visualizer.opacity * 100).toFixed(0)}%`}
                        onChange={(val) =>
                          updateConfigDebounced({
                            visualizer: { opacity: val }
                          })
                        }
                      />
                    </>
                  )}
                </div>
              </>
            )}

            {/* 模块 4: MPD 服务 */}
            {selectedModuleId === 'mpd' && (
              <>
                {/* 实时连接状态检测 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">实时连接状态检测</span>
                    <span className={`liquid-status-badge ${mpdConnected ? 'connected' : 'disconnected'}`}>
                      <span className="liquid-status-dot-pulse" />
                      {mpdConnected ? '已连接' : '离线'}
                    </span>
                  </div>

                  <div className="settings-control-row">
                    <div className="settings-control-info">
                      <span className="settings-control-label">
                        {mpdConnected ? 'TCP 控制信道与 PCM 直流正常' : '无法连接至 MPD 服务端'}
                      </span>
                      <span className="settings-control-desc">
                        {mpdConnected
                          ? `${config.mpd.host}:${config.mpd.port} & :${config.mpd.streamPort} 活跃流通`
                          : '连接失败或超时，请检查服务状态与端口配置'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="liquid-action-btn secondary"
                      onClick={testMpdConnection}
                      disabled={isTestingMpd}
                      title="重新检测连接"
                    >
                      <RefreshIcon />
                      <span>{isTestingMpd ? '检测中' : '测试连接'}</span>
                    </button>
                  </div>
                </div>

                {/* 服务端主机与端口配置 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">服务端地址与端口</span>
                    <span className="settings-group-badge">TCP / HTTP</span>
                  </div>

                  <div className="liquid-slider-block">
                    <span className="settings-control-label">服务端主机 Host</span>
                    <input
                      type="text"
                      className="liquid-text-input"
                      value={mpdHostInput}
                      placeholder="127.0.0.1"
                      onChange={(e) => setMpdHostInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveMpd()
                      }}
                    />
                  </div>

                  <div className="liquid-slider-block">
                    <span className="settings-control-label">控制命令端口 (Control Port)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="liquid-text-input"
                      value={mpdPortInput}
                      placeholder="6600"
                      onChange={(e) => setMpdPortInput(e.target.value.replace(/[^0-9]/g, ''))}
                      onBlur={() => {
                        const p = Number.parseInt(mpdPortInput, 10)
                        setMpdPortInput(String(!Number.isNaN(p) && p > 0 ? Math.min(65535, Math.max(1, p)) : 6600))
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveMpd()
                      }}
                    />
                  </div>

                  <div className="liquid-slider-block">
                    <span className="settings-control-label">音频流端口 (PCM Stream Port)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="liquid-text-input"
                      value={mpdStreamPortInput}
                      placeholder="8000"
                      onChange={(e) => setMpdStreamPortInput(e.target.value.replace(/[^0-9]/g, ''))}
                      onBlur={() => {
                        const p = Number.parseInt(mpdStreamPortInput, 10)
                        setMpdStreamPortInput(String(!Number.isNaN(p) && p > 0 ? Math.min(65535, Math.max(1, p)) : 8000))
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveMpd()
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="liquid-action-btn"
                      onClick={handleSaveMpd}
                    >
                      保存并应用
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 模块 5: 关于播放器 */}
            {selectedModuleId === 'about' && (
              <>
                {/* 核心规格 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">播放器核心信息</span>
                    <span className="settings-group-badge">v0.1.0</span>
                  </div>

                  <div className="liquid-spec-list">
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">软件版本</span>
                      <span className="liquid-spec-val highlight">lpip-player v0.1.0</span>
                    </div>
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">图形与框架</span>
                      <span className="liquid-spec-val">Electron 44 · React 19 · Vite</span>
                    </div>
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">声学解码引擎</span>
                      <span className="liquid-spec-val">MPD (Music Player Daemon)</span>
                    </div>
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">音频输出管道</span>
                      <span className="liquid-spec-val">WebAudio PCM 流式管道 (Model B)</span>
                    </div>
                    <div className="liquid-spec-item">
                      <span className="liquid-spec-key">界面设计哲学</span>
                      <span className="liquid-spec-val highlight">液态玻璃 (Liquid Glass)</span>
                    </div>
                  </div>
                </div>

                {/* 快捷键指引 */}
                <div className="settings-group-card">
                  <div className="settings-group-header">
                    <span className="settings-group-title">全局操作与快捷键</span>
                    <span className="settings-group-badge">Shortcuts</span>
                  </div>

                  <div className="liquid-shortcut-grid">
                    <div className="liquid-shortcut-item">
                      <span className="liquid-kbd">Space</span>
                      <span className="liquid-shortcut-desc">播放 / 暂停切换</span>
                    </div>
                    <div className="liquid-shortcut-item">
                      <span className="liquid-kbd">‹ / ›</span>
                      <span className="liquid-shortcut-desc">快退 / 快进 5 秒</span>
                    </div>
                    <div className="liquid-shortcut-item">
                      <span className="liquid-kbd">↑ / ↓</span>
                      <span className="liquid-shortcut-desc">音量微调 (+5% / -5%)</span>
                    </div>
                    <div className="liquid-shortcut-item">
                      <span className="liquid-kbd">Esc</span>
                      <span className="liquid-shortcut-desc">收起或关闭悬浮抽屉</span>
                    </div>
                    <div className="liquid-shortcut-item">
                      <span className="liquid-kbd">Mouse Out</span>
                      <span className="liquid-shortcut-desc">移出 40px 后 300ms 自动平滑收起</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
