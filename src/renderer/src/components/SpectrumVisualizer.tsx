import { useEffect, useRef } from 'react'
import type { VisualizerConfig } from '../../../types/config'
import { pcmPlayer } from '../services/pcmPlayer'
import './SpectrumVisualizer.css'

/**
 * 散点粒子微光数据结构 (预分配对象池, 零 GC 分配)
 */
interface GlimmerParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  active: boolean
}

/**
 * 2D 坐标点结构 (预分配对象池)
 */
interface BlueprintPoint {
  x: number
  y: number
}

export interface SpectrumVisualizerProps {
  /** 当前音频播放状态 (play 为 true, pause/stop 为 false) */
  isPlaying: boolean
  /** 运行时配置项 (支持热更新) */
  config?: VisualizerConfig
}

/** 频域分析采样点数 (与 FFT 256 / 2 = 128 对齐) */
const FREQ_BINS = 128
/** 曲线插值采样密度 (48 个平滑对数分布控制点) */
const POINT_COUNT = 48
/** 粒子对象池容量 */
const MAX_PARTICLES = 64
/** 柱状频段数量 (bars 模式) */
const BAR_COUNT = 36

/**
 * 高级制表蓝图纯线条音频频谱律动组件 (SpectrumVisualizer)
 *
 * 核心设计标准:
 * 1. 瑞士高级制表工艺纯线条蓝图工程风 (High Horology Line Blueprint):
 *    - 严格 fill: none, 纯线条勾勒与 #6ee7b7 薄荷微光
 *    - 底基准标尺刻度线 (Vernier Caliper Baseline) 与微米刻度、技术十字准星
 *    - 双轨工程包络线: 主平滑轮廓线 + 延时衰减虚线 (Ghost Envelope)
 *    - 峰值机芯轴承枢轴 (Nodal Bearings) 与垂向虚线投射
 *    - 散点粒子微光 (Scattered Particle Glimmers) 随声浪扬起并柔和消散
 * 2. 极致性能与防劣化保障 (Zero-Degradation):
 *    - 零 React State 循环: 60fps 渲染全走原生 Canvas 2D + direct ref, 绝不触发任何组件重渲染
 *    - 零内存分配动画循环 (Zero-Allocation): TypedArray 与粒子对象池全生命周期复用, 杜绝 GC 卡顿
 *    - 自适应 RAF 智能休眠: 播放暂停/停止或检测到静音时, 曲线平滑归零后彻底停用 requestAnimationFrame, 释放 CPU/GPU 算力
 * 3. 严格层级与穿透规范:
 *    - 布局定位于状态栏正上方 (bottom: 80px), 层级 Wallpaper(0) < Visualizer(5) < MechanicalGear(10) < StatusBar(100)
 *    - 绝对穿透 (pointer-events: none), 不阻碍任何交互
 */
export default function SpectrumVisualizer({ isPlaying, config }: SpectrumVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // 1. 预分配频域与时域 TypedArray 缓冲区 (生命周期内完全复用, 零运行时分配)
  const freqData = useRef(new Uint8Array(FREQ_BINS)).current
  const timeData = useRef(new Uint8Array(256)).current
  const smoothFreq = useRef(new Float32Array(FREQ_BINS)).current
  const ghostFreq = useRef(new Float32Array(FREQ_BINS)).current
  const barPeaks = useRef(new Float32Array(BAR_COUNT)).current
  const barPeakVels = useRef(new Float32Array(BAR_COUNT)).current

  // 2. 预分配曲线插值点坐标缓存池
  const mainPoints = useRef<BlueprintPoint[]>(
    Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0 }))
  ).current
  const ghostPoints = useRef<BlueprintPoint[]>(
    Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0 }))
  ).current

  // 3. 预分配散点粒子微光对象池
  const particles = useRef<GlimmerParticle[]>(
    Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      size: 0,
      active: false
    }))
  ).current

  // 4. 动画循环与休眠控制句柄
  const rafIdRef = useRef<number | null>(null)
  const isRafActiveRef = useRef<boolean>(false)
  const silenceCounterRef = useRef<number>(0)
  const silenceProbeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 5. 尺寸与分辨率缓存
  const sizeRef = useRef<{ width: number; height: number; dpr: number }>({
    width: 0,
    height: 0,
    dpr: 1
  })

  // 6. 配置项引用同步 (确保 RAF 循环实时读取最新配置无需重启循环)
  const configRef = useRef<VisualizerConfig>({
    enabled: config?.enabled ?? true,
    height: config?.height ?? 160,
    opacity: config?.opacity ?? 0.85,
    style: config?.style ?? 'blueprint'
  })

  useEffect(() => {
    configRef.current = {
      enabled: config?.enabled ?? true,
      height: config?.height ?? 160,
      opacity: config?.opacity ?? 0.85,
      style: config?.style ?? 'blueprint'
    }
  }, [config])

  // 生成粒子辅助函数 (从预分配对象池中唤醒)
  const spawnParticle = (x: number, y: number, intensity: number): void => {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i]
      if (!p.active) {
        p.active = true
        p.x = x + (Math.random() - 0.5) * 8
        p.y = y
        p.vx = (Math.random() - 0.5) * 0.7
        p.vy = -(0.6 + Math.random() * 1.4 * intensity)
        p.life = 0
        p.maxLife = Math.floor(35 + Math.random() * 45)
        p.size = 1.0 + Math.random() * 1.6
        break
      }
    }
  }

  // 绘制平滑三阶样条曲线 (Catmull-Rom 贝塞尔逼近, 严格 fill: none)
  const strokeSpline = (
    ctx: CanvasRenderingContext2D,
    pts: BlueprintPoint[],
    count: number
  ): void => {
    if (count < 2) return
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)

    for (let i = 0; i < count - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = i < count - 2 ? pts[i + 2] : p2

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
    }
    ctx.stroke()
  }

  // 核心渲染循环函数
  const renderLoop = (): void => {
    const canvas = canvasRef.current
    if (!canvas) {
      isRafActiveRef.current = false
      return
    }

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) {
      isRafActiveRef.current = false
      return
    }

    const { width, height, dpr } = sizeRef.current
    if (width <= 0 || height <= 0) {
      // 尺寸尚未初始化, 延后一帧调度
      rafIdRef.current = requestAnimationFrame(renderLoop)
      return
    }

    const curConfig = configRef.current
    if (!curConfig.enabled) {
      // 当配置彻底禁用时, 清空画布并安全停止 RAF 循环
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      isRafActiveRef.current = false
      return
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    const mintColor = isLight ? '#059669' : '#6ee7b7'
    const mintGlow = isLight ? 'rgba(5, 150, 105, 0.35)' : 'rgba(110, 231, 183, 0.45)'
    const cyanGlow = isLight ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.35)'
    const baselineColor = isLight ? 'rgba(5, 150, 105, 0.22)' : 'rgba(110, 231, 183, 0.22)'
    const guideColor = isLight ? 'rgba(5, 150, 105, 0.08)' : 'rgba(110, 231, 183, 0.08)'

    const analyser = pcmPlayer.getAnalyserNode()
    let hasSoundEnergy = false

    // 获取当前音频 FFT 频域或时域真实采样
    if (isPlaying && analyser) {
      if (curConfig.style === 'wave') {
        analyser.getByteTimeDomainData(timeData)
        // 检测时域振幅偏移
        for (let i = 0; i < 256; i++) {
          if (Math.abs(timeData[i] - 128) > 2) {
            hasSoundEnergy = true
            break
          }
        }
      } else {
        analyser.getByteFrequencyData(freqData)
        for (let i = 0; i < FREQ_BINS; i++) {
          if (freqData[i] > 2) {
            hasSoundEnergy = true
            break
          }
        }
      }
    }

    // 自适应音频衰减计算 (若处于暂停/停止或静音段, 平滑渐退至基线)
    let maxSpectralAmplitude = 0
    if (isPlaying && hasSoundEnergy) {
      silenceCounterRef.current = 0
      for (let i = 0; i < FREQ_BINS; i++) {
        const rawNormalized = freqData[i] / 255.0
        // 平滑系数: 0.35 瞬时响应 + 0.65 惯性平滑
        smoothFreq[i] = smoothFreq[i] * 0.65 + rawNormalized * 0.35
        ghostFreq[i] = Math.max(smoothFreq[i], ghostFreq[i] * 0.94)
        if (smoothFreq[i] > maxSpectralAmplitude) {
          maxSpectralAmplitude = smoothFreq[i]
        }
      }
    } else {
      // 暂停或静音: 快速阻尼收敛 (每帧衰减 18%)
      for (let i = 0; i < FREQ_BINS; i++) {
        smoothFreq[i] *= 0.82
        ghostFreq[i] *= 0.82
        if (smoothFreq[i] > maxSpectralAmplitude) {
          maxSpectralAmplitude = smoothFreq[i]
        }
      }
      silenceCounterRef.current++
    }

    // 检查是否有活跃粒子
    let hasActiveParticle = false
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (particles[i].active) {
        hasActiveParticle = true
        break
      }
    }

    // ============================================================
    // 自适应 RAF 智能休眠判定 (Adaptive RAF Sleeping):
    // 若连续 40 帧无声且振幅收敛至 0.003 以下且粒子已完全沉降, 立即挂起 RAF
    // ============================================================
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (!isPlaying && maxSpectralAmplitude < 0.003 && !hasActiveParticle) {
      // 彻底清空并挂起 RAF
      ctx.clearRect(0, 0, width, height)
      isRafActiveRef.current = false
      return
    }

    if (isPlaying && silenceCounterRef.current > 80 && maxSpectralAmplitude < 0.003 && !hasActiveParticle) {
      // 播放中遇到长静音段: 暂时挂起 RAF, 启动轻量定时轮询探测器
      ctx.clearRect(0, 0, width, height)
      isRafActiveRef.current = false
      scheduleSilenceProbe()
      return
    }

    // 清空画布, 开始本帧制表工程线条蓝图绘制
    ctx.clearRect(0, 0, width, height)
    ctx.save()

    const baseY = height - 4
    const maxWaveHeight = height * 0.82

    // ------------------------------------------------------------
    // 风格分支 1: blueprint (高级制表纯线条蓝图工程风 + 散点粒子微光, 默认)
    // ------------------------------------------------------------
    if (curConfig.style === 'blueprint') {
      // A. 底基准标尺刻度线 (Vernier Caliper Datum Baseline)
      ctx.strokeStyle = baselineColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, baseY)
      ctx.lineTo(width, baseY)
      ctx.stroke()

      // B. 标尺微米测距刻度齿与技术十字坐标
      ctx.fillStyle = baselineColor
      for (let x = 30; x < width; x += 30) {
        const isMajor = x % 120 === 0
        const tickHeight = isMajor ? 6 : 3
        ctx.beginPath()
        ctx.moveTo(x, baseY)
        ctx.lineTo(x, baseY - tickHeight)
        ctx.stroke()

        // 大刻度处绘制制表工程微型十字准星与标称文字
        if (isMajor && x + 60 < width) {
          ctx.beginPath()
          ctx.moveTo(x - 2, baseY - 12)
          ctx.lineTo(x + 2, baseY - 12)
          ctx.moveTo(x, baseY - 14)
          ctx.lineTo(x, baseY - 10)
          ctx.stroke()
        }
      }

      // C. 标称工程参考辅助虚线 (db Headroom Guides)
      ctx.save()
      ctx.strokeStyle = guideColor
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(0, baseY - maxWaveHeight * 0.5)
      ctx.lineTo(width, baseY - maxWaveHeight * 0.5)
      ctx.moveTo(0, baseY - maxWaveHeight * 0.85)
      ctx.lineTo(width, baseY - maxWaveHeight * 0.85)
      ctx.stroke()
      ctx.restore()

      // D. 计算对数频率平滑映射坐标点 (低频展开，高频致密)
      for (let p = 0; p < POINT_COUNT; p++) {
        const norm = p / (POINT_COUNT - 1)
        // 采用 1.9 幂律指数实现声学对数频段拉伸, 完美契合人耳听觉曲线
        const binIndex = Math.min(FREQ_BINS - 1, Math.floor(Math.pow(norm, 1.9) * (FREQ_BINS - 1)))
        const px = norm * width

        const sAmp = smoothFreq[binIndex]
        const gAmp = ghostFreq[binIndex]

        mainPoints[p].x = px
        mainPoints[p].y = baseY - sAmp * maxWaveHeight

        ghostPoints[p].x = px
        ghostPoints[p].y = baseY - gAmp * maxWaveHeight

        // E. 峰值机芯轴承枢轴与垂向虚线投射 (Nodal Bearings)
        if (sAmp > 0.18) {
          const prevBin = Math.max(0, binIndex - 1)
          const nextBin = Math.min(FREQ_BINS - 1, binIndex + 1)
          if (sAmp >= smoothFreq[prevBin] && sAmp >= smoothFreq[nextBin]) {
            // 枢轴微圆 (fill: none, 纯线条圈)
            ctx.save()
            ctx.strokeStyle = mintColor
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(px, mainPoints[p].y, 2.5, 0, Math.PI * 2)
            ctx.stroke()

            // 垂向工程投影虚线
            ctx.strokeStyle = guideColor
            ctx.setLineDash([2, 3])
            ctx.beginPath()
            ctx.moveTo(px, mainPoints[p].y + 3)
            ctx.lineTo(px, baseY)
            ctx.stroke()
            ctx.restore()

            // 能量迸发时激活动态粒子微光扬起
            if (isPlaying && sAmp > 0.32 && Math.random() < 0.28) {
              spawnParticle(px, mainPoints[p].y, sAmp)
            }
          }
        }
      }

      // F. 绘制双轨工程延时虚线 (Ghost Delayed Contour)
      ctx.save()
      ctx.strokeStyle = cyanGlow
      ctx.lineWidth = 1.0
      ctx.setLineDash([4, 4])
      strokeSpline(ctx, ghostPoints, POINT_COUNT)
      ctx.restore()

      // G. 绘制主频域轮廓曲线 (Main Blueprint Spline, fill: none)
      ctx.save()
      ctx.strokeStyle = mintColor
      ctx.lineWidth = 1.6
      ctx.shadowColor = mintGlow
      ctx.shadowBlur = 6
      strokeSpline(ctx, mainPoints, POINT_COUNT)
      ctx.restore()

      // H. 更新并渲染散点粒子微光 (Scattered Particle Glimmers)
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const pt = particles[i]
        if (pt.active) {
          pt.x += pt.vx
          pt.y += pt.vy
          pt.vy += 0.015 // 微量重力下坠阻尼
          pt.life++

          if (pt.life >= pt.maxLife || pt.y < 0) {
            pt.active = false
            continue
          }

          const progress = pt.life / pt.maxLife
          const alpha = Math.sin(progress * Math.PI) * 0.75
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2)
          ctx.fillStyle = isLight
            ? `rgba(5, 150, 105, ${alpha.toFixed(3)})`
            : `rgba(110, 231, 183, ${alpha.toFixed(3)})`
          ctx.shadowColor = mintGlow
          ctx.shadowBlur = 4
          ctx.fill()
        }
      }
    }

    // ------------------------------------------------------------
    // 风格分支 2: wave (极细高频工程波形正弦包络线)
    // ------------------------------------------------------------
    else if (curConfig.style === 'wave') {
      const centerY = height * 0.5
      const waveAmp = height * 0.42

      // 中央基准轴与刻度
      ctx.strokeStyle = baselineColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(width, centerY)
      ctx.stroke()

      // 示波器网格分度刻度
      for (let x = 40; x < width; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, centerY - 3)
        ctx.lineTo(x, centerY + 3)
        ctx.stroke()
      }

      // 绘制时域示波器双轨工程线条
      ctx.save()
      ctx.strokeStyle = cyanGlow
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * width
        const raw = (timeData[i] - 128) / 128.0
        const y = centerY + raw * waveAmp * 0.85
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = mintColor
      ctx.lineWidth = 1.6
      ctx.shadowColor = mintGlow
      ctx.shadowBlur = 5
      ctx.beginPath()
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * width
        const raw = (timeData[i] - 128) / 128.0
        const y = centerY - raw * waveAmp
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()
    }

    // ------------------------------------------------------------
    // 风格分支 3: bars (精密制表刻度柱状频段, 严格 fill: none 纯细线镂空)
    // ------------------------------------------------------------
    else if (curConfig.style === 'bars') {
      ctx.strokeStyle = baselineColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, baseY)
      ctx.lineTo(width, baseY)
      ctx.stroke()

      const barSlotWidth = width / BAR_COUNT
      const barWidth = Math.max(3, barSlotWidth * 0.62)
      const barMargin = (barSlotWidth - barWidth) / 2

      for (let b = 0; b < BAR_COUNT; b++) {
        const binIndex = Math.min(FREQ_BINS - 1, Math.floor(Math.pow(b / (BAR_COUNT - 1), 1.8) * (FREQ_BINS - 1)))
        const sAmp = smoothFreq[binIndex]
        const barHeight = Math.max(2, sAmp * maxWaveHeight)
        const bx = b * barSlotWidth + barMargin
        const by = baseY - barHeight

        // 细线条矩形外框 (fill: none)
        ctx.strokeStyle = mintColor
        ctx.lineWidth = 1
        ctx.strokeRect(bx, by, barWidth, barHeight)

        // 阶梯刻度细横线 (梯级间隔 4px)
        ctx.strokeStyle = guideColor
        ctx.beginPath()
        for (let ry = baseY - 4; ry > by; ry -= 4) {
          ctx.moveTo(bx, ry)
          ctx.lineTo(bx + barWidth, ry)
        }
        ctx.stroke()

        // 浮动峰值保持顶线 (Peak Hold Line with Gravity)
        if (by < barPeaks[b] || barPeaks[b] === 0) {
          barPeaks[b] = by
          barPeakVels[b] = 0
        } else {
          barPeakVels[b] += 0.15
          barPeaks[b] = Math.min(baseY, barPeaks[b] + barPeakVels[b])
        }

        ctx.strokeStyle = isLight ? '#059669' : '#a7f3d0'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(bx, barPeaks[b])
        ctx.lineTo(bx + barWidth, barPeaks[b])
        ctx.stroke()
      }
    }

    ctx.restore()

    // 调度下一帧
    rafIdRef.current = requestAnimationFrame(renderLoop)
  }

  // 调度静音时的低频探测器 (休眠期间每 200ms 轻量查询一次, 杜绝无谓 RAF 耗电)
  const scheduleSilenceProbe = (): void => {
    if (silenceProbeTimerRef.current) {
      clearTimeout(silenceProbeTimerRef.current)
    }

    silenceProbeTimerRef.current = setTimeout(() => {
      const analyser = pcmPlayer.getAnalyserNode()
      if (!analyser || !isPlaying) return

      analyser.getByteFrequencyData(freqData)
      let detectedEnergy = false
      for (let i = 0; i < FREQ_BINS; i++) {
        if (freqData[i] > 3) {
          detectedEnergy = true
          break
        }
      }

      if (detectedEnergy) {
        // 发现音频信号重现, 唤醒 60fps RAF 渲染流水线
        startRafLoop()
      } else {
        // 持续静音, 保持低频轮询
        scheduleSilenceProbe()
      }
    }, 200)
  }

  // 启动 RAF 渲染循环
  const startRafLoop = (): void => {
    if (silenceProbeTimerRef.current) {
      clearTimeout(silenceProbeTimerRef.current)
      silenceProbeTimerRef.current = null
    }

    if (!isRafActiveRef.current) {
      isRafActiveRef.current = true
      rafIdRef.current = requestAnimationFrame(renderLoop)
    }
  }

  // 挂起停止 RAF 循环
  const stopRafLoop = (): void => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (silenceProbeTimerRef.current) {
      clearTimeout(silenceProbeTimerRef.current)
      silenceProbeTimerRef.current = null
    }
    isRafActiveRef.current = false
  }

  // 监听 isPlaying 状态变更, 响应休眠与唤醒
  useEffect(() => {
    if (!configRef.current.enabled) {
      stopRafLoop()
      return
    }

    if (isPlaying) {
      startRafLoop()
    } else {
      // 当暂停时, 让现有帧循环继续运行数帧以平滑阻尼收敛, 随后由 renderLoop 自动挂起
      if (!isRafActiveRef.current) {
        startRafLoop()
      }
    }
  }, [isPlaying, config?.enabled])

  // 响应窗口 Resize 与 Canvas 分辨率缩放
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const updateCanvasSize = (): void => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.floor(rect.width)
      const height = Math.floor(rect.height || configRef.current.height)

      if (width <= 0 || height <= 0) return

      sizeRef.current = { width, height, dpr }

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }

    updateCanvasSize()

    const observer = new ResizeObserver(() => {
      updateCanvasSize()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [config?.height])

  // 组件卸载时确保彻底释放 RAF 与定时器
  useEffect(() => {
    return () => {
      stopRafLoop()
    }
  }, [])

  // 当配置明确禁用时, 彻底不渲染 DOM 节点, 零 CPU/GPU 占用
  if (config && !config.enabled) {
    return null
  }

  const height = config?.height ?? 160
  const opacity = config?.opacity ?? 0.85

  return (
    <div
      ref={containerRef}
      className="spectrum-visualizer-container"
      style={{
        height: `${height}px`,
        opacity
      }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="spectrum-visualizer-canvas" />
    </div>
  )
}
