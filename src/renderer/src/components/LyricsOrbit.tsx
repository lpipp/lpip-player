import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import './LyricsOrbit.css'

/**
 * 歌词条目数据结构
 */
export interface LyricLine {
  /** 唯一标识或索引 */
  id: number
  /** 主歌词文本 (原文/外文，大号高亮衬线字体) */
  primary: string
  /** 辅歌词文本 (中文翻译，次级高亮无衬线字体) */
  secondary?: string
  /** 对应歌曲时间秒数 (可选，用于后续与 MPD / 播放进度条同步) */
  time?: number
}

/**
 * 星盘歌词轨道组件属性
 */
export interface LyricsOrbitProps {
  /** 自定义外层样式类名 */
  className?: string
  /** 外部传入的歌词列表 (可选，缺省时使用《Luna domina》参考测试曲) */
  lyrics?: LyricLine[]
  /** 外部控制的当前高亮行索引 (可选，受控模式) */
  activeIndex?: number
  /** 当前音频播放进度秒数 (联动进度条) */
  currentTime?: number
  /** 音频总时长 (秒) */
  duration?: number
  /** 当前行变更回调 (用于联动播放器进度) */
  onLineChange?: (index: number) => void
  /** 进度寻道跳转回调 */
  onSeek?: (timeSeconds: number) => void
  /** 是否启用自动演播/微旋动效 (默认为 true) */
  animated?: boolean
  /** 是否正在播放 (暂停时滚轮预览常驻不倒计时, 默认 true) */
  isPlaying?: boolean
  /** 是否显示歌词翻译行 (默认 true; 关闭则隐藏全部 .lyric-secondary) */
  showTranslation?: boolean
  /** 滚轮预览确认超时时长毫秒 (范围 500 ~ 5000, 默认 1500) */
  previewTimeoutMs?: number
  /** 星盘齿轮与歌词模块位置微调 (x: 距左边框 px, y: 距垂直中线 px) */
  astrolabePosition?: { x: number; y: number }
}

/**
 * 内置《Luna domina》史诗参考曲目歌词测试集
 * 逐字还原设计参考图中"时计星盘"歌词内容
 */
export const DEFAULT_LYRICS: LyricLine[] = [
  {
    id: 0,
    primary: 'Ubique, benigna lux spargitur',
    secondary: '愿仁慈的光芒普照世间每一寸角落',
    time: 12
  },
  {
    id: 1,
    primary: 'Cur non mittis lucem almam tuam?',
    secondary: '为何迟迟不肯降下你那滋养万物的辉光？',
    time: 25
  },
  {
    id: 2,
    primary: 'Ecce, terra infelix atra',
    secondary: '看呀，这片不幸的大地漆黑如死',
    time: 38
  },
  {
    id: 3,
    primary: 'Veritas contra falsa nequit',
    secondary: '真理无力与漆黑恶毒的谎言对抗',
    time: 51
  },
  {
    id: 4,
    primary: 'Luna domina, quo adduces?',
    secondary: '月的女主人呀，你要引我们往何方？',
    time: 64
  },
  {
    id: 5,
    primary: 'Pergemus quocumque adduces',
    secondary: '无论何方，我们都愿追随你的柔光',
    time: 77
  },
  {
    id: 6,
    primary: 'Potius nox tegat lumina',
    secondary: '我们宁愿让免刺的寒夜将双目遮挡',
    time: 90
  },
  {
    id: 7,
    primary: 'Quam in falsa luce esse',
    secondary: '也不愿沉沦在虚伪刺眼的谎言之光',
    time: 103
  },
  {
    id: 8,
    primary: 'O stella maris, audi nos',
    secondary: '啊，深海的引路晨星，请倾听我们的祈祷',
    time: 116
  },
  {
    id: 9,
    primary: 'Duc nos per umbram ad astra',
    secondary: '引我们穿过重重晦暗幽影，直达浩瀚星芒',
    time: 129
  },
  {
    id: 10,
    primary: 'In aeternum manet fides',
    secondary: '矢志不渝的信念将在此永世传颂',
    time: 142
  },
  {
    id: 11,
    primary: 'Lux in tenebris lucet',
    secondary: '即便黑暗重重，微光亦将刺破苍穹',
    time: 155
  }
]

/**
 * 生成渐开线齿轮轮廓 SVG 路径 (全 fill:none 蓝图风格)
 */
function generateGearPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  teeth: number
): string {
  const points: string[] = []
  const step = (Math.PI * 2) / teeth
  const halfStep = step / 2
  const flankStep = halfStep * 0.36

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step
    const a1 = a0 + flankStep
    const a2 = a0 + halfStep - flankStep
    const a3 = a0 + halfStep
    const a4 = a0 + step

    const x0 = cx + Math.cos(a0) * rIn
    const y0 = cy + Math.sin(a0) * rIn
    const x1 = cx + Math.cos(a1) * rOut
    const y1 = cy + Math.sin(a1) * rOut
    const x2 = cx + Math.cos(a2) * rOut
    const y2 = cy + Math.sin(a2) * rOut
    const x3 = cx + Math.cos(a3) * rIn
    const y3 = cy + Math.sin(a3) * rIn
    const x4 = cx + Math.cos(a4) * rIn
    const y4 = cy + Math.sin(a4) * rIn

    if (i === 0) {
      points.push(`M ${x0.toFixed(2)} ${y0.toFixed(2)}`)
    }
    points.push(`L ${x1.toFixed(2)} ${y1.toFixed(2)}`)
    points.push(`L ${x2.toFixed(2)} ${y2.toFixed(2)}`)
    points.push(`L ${x3.toFixed(2)} ${y3.toFixed(2)}`)
    points.push(`L ${x4.toFixed(2)} ${y4.toFixed(2)}`)
  }

  return points.join(' ') + ' Z'
}

/**
 * 极坐标转换笛卡尔坐标
 */
function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad)
  }
}

/**
 * 生成 SVG 顺时针圆弧路径
 */
function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle)
  const end = polarToCartesian(cx, cy, radius, endAngle)
  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${arcSweep} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

/**
 * 格式化时间为 mm:ss 或 hh:mm:ss 纯文字格式
 */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00'
  }
  const totalSecs = Math.floor(seconds)
  const hrs = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60

  const paddedMins = String(mins).padStart(2, '0')
  const paddedSecs = String(secs).padStart(2, '0')

  if (hrs > 0) {
    const paddedHrs = String(hrs).padStart(2, '0')
    return `${paddedHrs}:${paddedMins}:${paddedSecs}`
  }
  return `${paddedMins}:${paddedSecs}`
}

/**
 * 生成同心游标刻度线段
 */
function generateTicks(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  count: number,
  angleOffset = 0
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const ticks: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  const step = (Math.PI * 2) / count

  for (let i = 0; i < count; i++) {
    const angle = i * step + angleOffset
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    ticks.push({
      x1: cx + cos * rOuter,
      y1: cy + sin * rOuter,
      x2: cx + cos * rInner,
      y2: cy + sin * rInner
    })
  }

  return ticks
}

/**
 * 星盘歌词轨道组件 (LyricsOrbit)
 *
 * 核心设计:
 * 1. 极坐标同心圆弧轨道: 圆心定位于左边缘 (cx=0, cy=320)，歌词向右辐射展开；
 * 2. 机械擒纵回弹 (Escapement Bounce): 切行瞬间模拟高级钟表擒纵轮跳齿冲程超调与阻尼回弹；
 * 3. 瑞士天文钟机芯蓝图: 60 齿精密主齿圈、中心 18 齿微型分轮、双级轮辐与三级同心游标刻度；
 * 4. 动力学传动绑定: 歌词切行时齿轮以 2 齿/行 (-12.0°) 逆时针跳进；
 * 5. 550px+ 超大歌词视口: 拓展横向空间，从容排布双语长歌词。
 */
export default function LyricsOrbit({
  className = '',
  lyrics = DEFAULT_LYRICS,
  activeIndex: controlledIndex,
  currentTime,
  duration,
  onLineChange,
  onSeek,
  animated = true,
  isPlaying = true,
  showTranslation = true,
  previewTimeoutMs = 1500,
  astrolabePosition
}: LyricsOrbitProps) {
  // 圆弧进度条拖拽寻道态与 SVG 引用
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekRatio, setSeekRatio] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  // 当前活跃行索引 (支持非受控与受控双模式)
  const [internalIndex, setInternalIndex] = useState(4) // 默认定格在第4行《Luna domina》
  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex

  // 滚轮预览态: 预览行索引 (null 表示无预览, 显示播放行)
  // 展示索引: 预览存在时轨道跟随预览行, 预览行让位套用高亮
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const displayIndex = previewIndex ?? activeIndex

  // 预览超时计时器与最新状态引用 (供回调内读取, 避免闭包陈旧)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewStateRef = useRef<{ preview: number | null; playing: boolean; timeoutMs: number }>({
    preview: null,
    playing: isPlaying,
    timeoutMs: previewTimeoutMs
  })
  previewStateRef.current.preview = previewIndex
  previewStateRef.current.playing = isPlaying
  previewStateRef.current.timeoutMs = previewTimeoutMs

  // 滚轮残量累加 (用于触控板微小行程平滑累积)
  const wheelRemainderRef = useRef(0)
  // 滚轮静止自动复位计时器 (停止滑动后自动清零残量, 杜绝历史动量积压)
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 清除预览态与超时计时 (确认跳转/超时回弹/取消事件共用)
  const clearPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current)
      previewTimerRef.current = null
    }
    if (wheelResetTimerRef.current) {
      clearTimeout(wheelResetTimerRef.current)
      wheelResetTimerRef.current = null
    }
    wheelRemainderRef.current = 0
    setPreviewIndex(null)
  }, [])

  // 启动/重置预览超时计时: 仅播放态生效, 暂停态预览常驻
  // 关键: 超时回调必须走 previewStateRef 读取播放态, 不能闭包捕获旧 isPlaying
  const armPreviewTimer = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current)
      previewTimerRef.current = null
    }
    // 暂停态不启动计时, 预览常驻直到单击跳转或取消事件
    if (!previewStateRef.current.playing) return
    const timeoutMs = Math.max(500, Math.min(5000, Math.round(previewStateRef.current.timeoutMs) || 1500))
    previewTimerRef.current = setTimeout(() => {
      previewTimerRef.current = null
      // 超时回弹: 清预览转回播放行, 不触发 seek
      // 仅播放态回弹; 若期间已暂停则保持常驻 (与暂停不倒计时语义一致)
      if (!previewStateRef.current.playing) return
      setPreviewIndex(null)
    }, timeoutMs)
  }, [])

  // 播放/暂停切换时重整预览态: 切到暂停则停表常驻; 切回播放则按当前配置重启动计时
  useEffect(() => {
    if (isPlaying) {
      if (previewIndex !== null) armPreviewTimer()
    } else if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current)
      previewTimerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // 组件卸载时清理计时器
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current)
    }
  }, [])

  // 切歌时取消预览 (歌词列表引用变化即视为新曲)
  useEffect(() => {
    clearPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyrics])

  // 星盘机芯与歌词模块位置同步 (若外部传入则应用到 :root 保证 60fps 响应)
  useEffect(() => {
    if (astrolabePosition) {
      document.documentElement.style.setProperty('--astrolabe-x', `${astrolabePosition.x}px`)
      document.documentElement.style.setProperty('--astrolabe-y', `${astrolabePosition.y}px`)
    }
  }, [astrolabePosition])

  // 轨道几何参数配置 (左侧齿轮半径增加 100px: rIn 295, rOut 308，对齐右侧 60 齿制表风格)
  const cx = 0 // 星盘圆心 X 坐标定格在左边缘，半圆优雅凸出
  const cy = 320 // 垂直居中于视窗可用区域中轴线
  const orbitRadius = 360 // 歌词轨道圆周基准半径 (px) - 维持 52px 优雅安全间距
  const stepAngle = 12.5 // 每行歌词间的角度步长 (deg)

  // 1. 主精密表盘 60 齿渐开线齿轮轮廓 (半径 295 ~ 308px，对齐右侧 1号主齿轮模数与微密齿形)
  const gearOuterPath = useMemo(
    () => generateGearPath(cx, cy, 295, 308, 60),
    [cx, cy]
  )

  // 2. 中心 18 齿微型分轮小齿轮轮廓 (半径 70 ~ 78px，与右侧中心小齿轮同款)
  const gearHubPath = useMemo(
    () => generateGearPath(cx, cy, 70, 78, 18),
    [cx, cy]
  )

  // 3. 三级同心游标刻度群 (120/60/12 分度分划体系，与右侧高级制表工艺完全一致)
  const gearMinorTicks = useMemo(() => generateTicks(cx, cy, 288, 283, 120), [cx, cy])
  const gearMajorTicks = useMemo(() => generateTicks(cx, cy, 288, 277, 60), [cx, cy])
  const gearLongTicks = useMemo(() => generateTicks(cx, cy, 288, 270, 12), [cx, cy])
  // 4. 双级轻量化工程轮辐系统: 12 组主工程射线 + 24 根外缘错位半虚线子射线
  const gearRadialLines = useMemo(() => generateTicks(cx, cy, 243, 78, 12), [cx, cy])
  const gearSubRadialLines = useMemo(
    () => generateTicks(cx, cy, 243, 175, 24, Math.PI / 24),
    [cx, cy]
  )

  // 5. 圆弧进度条几何参数配置 (半径 350px，跨度 -52° ~ +52°，总行程 104°)
  const progressRadius = 350
  const startDeg = -52
  const endDeg = 52
  const spanDeg = endDeg - startDeg

  // 进度计算 (未拖拽时取实际播放进度，拖拽寻道时取实时滑动手感比例)
  const effectiveDuration = duration !== undefined ? Math.max(0, duration) : 0
  const currentSeconds = isSeeking
    ? seekRatio * effectiveDuration
    : (currentTime !== undefined ? Math.max(0, currentTime) : 0)

  const progressRatio = effectiveDuration > 0
    ? Math.min(1, Math.max(0, currentSeconds / effectiveDuration))
    : 0

  const currentProgressAngle = startDeg + progressRatio * spanDeg
  const thumbPos = polarToCartesian(cx, cy, progressRadius, currentProgressAngle)
  const railPath = describeArc(cx, cy, progressRadius, startDeg, endDeg)
  const fillPath = progressRatio > 0.002
    ? describeArc(cx, cy, progressRadius, startDeg, currentProgressAngle)
    : ''

  // 顶部当前时间与底部结束时间坐标 (切线对齐 x=215.5)
  const timeLabelX = 215.5
  const topTimeY = 28
  const bottomTimeY = 620

  // 根据鼠标位置计算圆弧极坐标进度比例 (0 ~ 1)
  const calcRatioFromMouseEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!svgRef.current) return 0
      const rect = svgRef.current.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return 0
      const scaleX = rect.width / 720
      const scaleY = rect.height / 640
      const svgX = (e.clientX - rect.left) / scaleX
      const svgY = (e.clientY - rect.top) / scaleY
      const dx = svgX - cx
      const dy = svgY - cy
      const angleRad = Math.atan2(dy, dx)
      const angleDeg = (angleRad * 180) / Math.PI
      const clampedAngle = Math.max(startDeg, Math.min(endDeg, angleDeg))
      const ratio = (clampedAngle - startDeg) / spanDeg
      return Math.max(0, Math.min(1, ratio))
    },
    [cx, cy, startDeg, endDeg, spanDeg]
  )

  // 圆弧进度条按压与拖拽寻道
  const handleArcMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || effectiveDuration <= 0) return
    e.preventDefault()
    e.stopPropagation()

    const initialRatio = calcRatioFromMouseEvent(e)
    setIsSeeking(true)
    setSeekRatio(initialRatio)

    const onMouseMove = (moveEvt: MouseEvent) => {
      const r = calcRatioFromMouseEvent(moveEvt)
      setSeekRatio(r)
    }

    const onMouseUp = (upEvt: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      setIsSeeking(false)
      const finalRatio = calcRatioFromMouseEvent(upEvt)
      const targetTime = finalRatio * effectiveDuration
      seekLockUntilRef.current = Date.now() + 1200
      onSeek?.(targetTime)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // 根据外部传入的 currentTime 自动同步歌词行
  useEffect(() => {
    if (currentTime === undefined || lyrics.length === 0) return
    // 寻道锁定期间保持用户手动选中的歌词行, 等待 MPD 位置落点稳定后再恢复自动跟随
    if (Date.now() < seekLockUntilRef.current) return
    let matchedIdx = 0
    for (let i = 0; i < lyrics.length; i++) {
      if ((lyrics[i].time ?? 0) <= currentTime) {
        matchedIdx = i
      } else {
        break
      }
    }
    if (matchedIdx !== activeIndex) {
      // 自然切行属于播放位置大变化: 取消滚轮预览, 高亮归还播放行
      clearPreview()
      if (controlledIndex === undefined) {
        setInternalIndex(matchedIdx)
      }
      onLineChange?.(matchedIdx)
    }
  }, [currentTime, lyrics, activeIndex, controlledIndex, onLineChange, clearPreview])

  // 寻道锁定到期时间戳: 手动选行跳转后短暂屏蔽 currentTime 自动跟随, 防止轮询回灌把高亮拉回上一句
  const seekLockUntilRef = useRef(0)

  // 直接跳转 (单击确认/方向键): 点哪行即跳哪行, 清预览并触发 seek;
  // 点当前播放行则仅取消预览 (无需求重复 seek)
  const handleDirectJump = useCallback(
    (index: number) => {
      if (index === activeIndex) {
        clearPreview()
        return
      }
      clearPreview()
      if (controlledIndex === undefined) {
        setInternalIndex(index)
      }
      onLineChange?.(index)
      if (lyrics[index]?.time !== undefined) {
        // 启动寻道锁定 (1.2s): 等待 MPD 位置落点稳定后再恢复自动跟随
        seekLockUntilRef.current = Date.now() + 1200
        onSeek?.(lyrics[index].time!)
      }
    },
    [activeIndex, controlledIndex, onLineChange, lyrics, onSeek, clearPreview]
  )

  // 滚轮交互: 只进入预览态 (轨道跟随预览行), 不触发 seek; 每次 tick 重置超时计时
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation()
      if (lyrics.length === 0 || e.deltaY === 0) return

      // 1. 明确当前物理滚轮事件的方向: deltaY > 0 为向下滚 (后一行), deltaY < 0 为向上滚 (前一行)
      const eventDir = e.deltaY > 0 ? 1 : -1

      // 2. 转向保护: 当滚轮反向时, 立即清空相反方向积压的残量, 彻底杜绝“反向仍沿旧方向走”或“债务偿还”Bug
      if ((eventDir > 0 && wheelRemainderRef.current < 0) || (eventDir < 0 && wheelRemainderRef.current > 0)) {
        wheelRemainderRef.current = 0
      }

      // 3. 节拍重置定时器: 停止滚动 150ms 后自动将累积残量归零
      if (wheelResetTimerRef.current) {
        clearTimeout(wheelResetTimerRef.current)
      }
      wheelResetTimerRef.current = setTimeout(() => {
        wheelRemainderRef.current = 0
        wheelResetTimerRef.current = null
      }, 150)

      // 4. 单位换算: 行模式 (deltaMode=1) 折算 24px, 页模式折算 240px, 像素模式 1:1
      const STEP_THRESHOLD = 24
      const unit = e.deltaMode === 1 ? STEP_THRESHOLD : e.deltaMode === 2 ? 240 : 1
      const rawDelta = e.deltaY * unit

      wheelRemainderRef.current += rawDelta

      // 5. 判定是否达到步进预算
      if (Math.abs(wheelRemainderRef.current) < STEP_THRESHOLD) return

      // 6. 确定最终步进方向与残量处理
      // 物理鼠标滚轮单刻度 (通常 |rawDelta| >= STEP_THRESHOLD, 如 100/120px): 一刻度走一行, 残量直接归零
      // 触控板连续平滑微滑动: 扣减已消耗预算, 并钳位防止无限超额累加
      if (Math.abs(rawDelta) >= STEP_THRESHOLD) {
        wheelRemainderRef.current = 0
      } else {
        wheelRemainderRef.current -= eventDir * STEP_THRESHOLD
        wheelRemainderRef.current = Math.max(-STEP_THRESHOLD, Math.min(STEP_THRESHOLD, wheelRemainderRef.current))
      }

      // 7. 基准钳位计算目标行
      const rawBase = previewStateRef.current.preview ?? activeIndex
      const base = Math.max(0, Math.min(rawBase, lyrics.length - 1))
      const next = eventDir > 0
        ? Math.min(base + 1, lyrics.length - 1)
        : Math.max(base - 1, 0)

      // 8. 边界阻断与防穿透: 已到达最前或最后一行时, 立即清空残量并退出, 杜绝“撞墙积压动量”
      if (next === base) {
        wheelRemainderRef.current = 0
        return
      }

      // 9. 同步更新 previewStateRef 与状态
      previewStateRef.current.preview = next
      setPreviewIndex(next)
      armPreviewTimer()
    },
    [activeIndex, lyrics.length, armPreviewTimer]
  )

  // 键盘方向键监听 (从预览行起步, 保持直跳不进预览; 同时清预览与计时)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const base = previewIndex ?? activeIndex
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        if (base < lyrics.length - 1) {
          handleDirectJump(base + 1)
        } else {
          clearPreview()
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        if (base > 0) {
          handleDirectJump(base - 1)
        } else {
          clearPreview()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, previewIndex, lyrics.length, handleDirectJump, clearPreview])

  // 展示索引钳位 (空歌词时归 -1, 旋转归零避免齿轮空转)
  const safeDisplayIndex = lyrics.length === 0 ? -1 : Math.max(0, Math.min(displayIndex, lyrics.length - 1))

  // 滑动窗口: 以展示索引为中心前后 5 行, 预览时轨道跟随预览行
  const visibleWindow = useMemo(() => {
    if (lyrics.length === 0) return [] as Array<{ line: LyricLine; index: number; distance: number }>
    const start = Math.max(0, safeDisplayIndex - 5)
    const end = Math.min(lyrics.length - 1, safeDisplayIndex + 5)
    const items: Array<{ line: LyricLine; index: number; distance: number }> = []
    for (let i = start; i <= end; i++) {
      items.push({
        line: lyrics[i],
        index: i,
        distance: Math.abs(i - safeDisplayIndex)
      })
    }
    return items
  }, [lyrics, safeDisplayIndex])

  // 当前轨道旋转角度 (以展示索引归位到 0° 水平线, 预览时跟随预览行; 空歌词归零)
  const currentRotation = safeDisplayIndex < 0 ? 0 : -safeDisplayIndex * stepAngle

  // 齿轮步进角: 60 齿高密度精密机芯齿轮，单个齿距为 360° / 60 = 6.0°
  // 方案 1A: 每切一行歌词，齿轮逆时针跳进刚好 2 齿 (-12.0°)，与歌词轨道步长 12.5° 形成近乎完美的等角联动
  const gearStepAngle = 12.0
  const gearRotation = safeDisplayIndex < 0 ? 0 : -safeDisplayIndex * gearStepAngle

  // 切歌作用域 key (歌词文本指纹, 切歌即换 key 避免 id 复用导致节点复用错位)
  const songKey = useMemo(() => {
    const head = lyrics.slice(0, 3).map((l) => l.primary).join('|')
    return `${lyrics.length}:${head.length}:${head.slice(0, 48)}`
  }, [lyrics])

  return (
    <div
      className={`lyrics-orbit-wrapper ${className} ${animated ? 'is-animated' : ''}`}
      onWheel={handleWheel}
      aria-label="星盘歌词轨道播放区"
      data-active-index={activeIndex}
      data-preview-index={previewIndex ?? ''}
      data-show-translation={showTranslation ? 'true' : 'false'}
    >
      {/* ------------------------------------------------------------
          背景层: 空间中漂浮的空灵几何多面体晶体 (全屏背景装饰)
          ------------------------------------------------------------ */}
      <svg
        className="astrolabe-ambient-svg"
        viewBox="0 0 1100 640"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <g className="astrolabe-floating-crystals" opacity="0.25">
          {/* 右上方透视菱形 */}
          <polygon points="780,110 820,90 840,130 800,150" fill="none" stroke="#6ee7b7" strokeWidth="0.8" strokeDasharray="3 3" />
          {/* 右中侧立体三角面 */}
          <polygon points="860,380 920,350 890,440" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          {/* 右下方轴测微立方体 */}
          <polygon points="630,490 655,475 680,490 655,505" fill="none" stroke="#6ee7b7" strokeWidth="0.8" />
          <line x1="630" y1="490" x2="630" y2="515" stroke="#6ee7b7" strokeWidth="0.8" />
          <line x1="655" y1="505" x2="655" y2="530" stroke="#6ee7b7" strokeWidth="0.8" />
          <line x1="680" y1="490" x2="680" y2="515" stroke="#6ee7b7" strokeWidth="0.8" />
          <polygon points="630,515 655,530 680,515 655,500" fill="none" stroke="#6ee7b7" strokeWidth="0.8" />
        </g>
      </svg>

      {/* ------------------------------------------------------------
          左侧星盘机芯齿轮与歌词轨道统一模块容器 (Unified Astrolabe Module)
          - 左侧边框为基准 (left: var(--astrolabe-x, 0px))
          - 垂直中线为基准 (top: calc(50% + var(--astrolabe-y, 0px)); transform: translateY(-50%))
          - 齿轮与歌词 100% 同轴共心锁定于容器 (cx=0px, cy=320px)
          ------------------------------------------------------------ */}
      <div className="astrolabe-module-container">
        <svg
          ref={svgRef}
          className="astrolabe-gear-svg"
          viewBox="0 0 720 640"
          width="720"
          height="640"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* 1. 星盘同心参考规线群 (静态外层蓝图工程基准) */}
          <g className="astrolabe-rings">
            <circle cx={cx} cy={cy} r={330} fill="none" stroke="rgba(110, 231, 183, 0.18)" strokeWidth="0.8" strokeDasharray="3 5" />
            <circle cx={cx} cy={cy} r={318} fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" />
          </g>

          {/* 2. 主表盘 60 齿精密机械表机芯总成 (与右侧 1号主齿轮完全同模数、同制表工艺体系) */}
          <g
            className="astrolabe-main-gear"
            style={{
              '--gear-rotation': `${gearRotation}deg`
            } as React.CSSProperties}
          >
            {/* 2.1 外圈 60 齿纯线框齿圈 (半径 295px ~ 308px) 与齿根基圆 */}
            <path
              d={gearOuterPath}
              fill="none"
              stroke="rgba(110, 231, 183, 0.75)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle
              cx={cx}
              cy={cy}
              r={295}
              fill="none"
              stroke="rgba(110, 231, 183, 0.3)"
              strokeWidth="0.8"
            />

            {/* 2.2 三级同心游标刻度圈 (120/60/12 分度体系，完全对齐右侧 1号齿轮) */}
            <circle
              cx={cx}
              cy={cy}
              r={288}
              fill="none"
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth="1"
            />
            {gearMinorTicks.map((t, i) => (
              <line
                key={`g-minor-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="0.7"
              />
            ))}
            {gearMajorTicks.map((t, i) => (
              <line
                key={`g-major-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#6ee7b7"
                strokeWidth="1"
                strokeOpacity="0.8"
              />
            ))}
            {gearLongTicks.map((t, i) => (
              <line
                key={`g-long-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#ffffff"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            ))}

            {/* 2.3 多层精密工程规线圈 (点状微环、虚线环与内基准圈) */}
            <circle
              cx={cx}
              cy={cy}
              r={272}
              fill="none"
              stroke="rgba(110, 231, 183, 0.45)"
              strokeWidth="0.8"
            />
            <circle
              cx={cx}
              cy={cy}
              r={263}
              fill="none"
              stroke="rgba(110, 231, 183, 0.65)"
              strokeWidth="1.2"
              strokeDasharray="1.5 5"
              strokeLinecap="round"
            />
            <circle
              cx={cx}
              cy={cy}
              r={253}
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="0.8"
              strokeDasharray="6 3"
            />
            <circle
              cx={cx}
              cy={cy}
              r={243}
              fill="none"
              stroke="rgba(110, 231, 183, 0.55)"
              strokeWidth="1"
            />

            {/* 2.4 双级轻量化工程射线轮辐 */}
            {gearRadialLines.map((l, i) => (
              <g key={`g-radial-${i}`}>
                <line
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="rgba(110, 231, 183, 0.35)"
                  strokeWidth="0.9"
                />
                <circle
                  cx={l.x1}
                  cy={l.y1}
                  r={1.5}
                  fill="none"
                  stroke="#6ee7b7"
                  strokeWidth="0.8"
                />
              </g>
            ))}
            {gearSubRadialLines.map((l, i) => (
              <line
                key={`g-subradial-${i}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="0.6"
                strokeDasharray="3 3"
              />
            ))}

            {/* 2.5 中继同心规线 */}
            <circle
              cx={cx}
              cy={cy}
              r={210}
              fill="none"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="0.8"
              strokeDasharray="8 6"
            />
            <circle
              cx={cx}
              cy={cy}
              r={190}
              fill="none"
              stroke="rgba(110, 231, 183, 0.22)"
              strokeWidth="0.8"
            />
            <circle
              cx={cx}
              cy={cy}
              r={120}
              fill="none"
              stroke="rgba(110, 231, 183, 0.25)"
              strokeWidth="0.8"
              strokeDasharray="5 5"
            />

            {/* 2.6 中心 18 齿微型分轮小齿轮与轴套系统 */}
            <path
              d={gearHubPath}
              fill="none"
              stroke="rgba(110, 231, 183, 0.65)"
              strokeWidth="1"
            />
            <circle
              cx={cx}
              cy={cy}
              r={66}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth="1"
            />
            <circle
              cx={cx}
              cy={cy}
              r={54}
              fill="none"
              stroke="rgba(110, 231, 183, 0.35)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <circle
              cx={cx}
              cy={cy}
              r={30}
              fill="none"
              stroke="rgba(110, 231, 183, 0.75)"
              strokeWidth="1"
            />
            <circle
              cx={cx}
              cy={cy}
              r={18}
              fill="none"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="0.8"
            />
            <circle
              cx={cx}
              cy={cy}
              r={7}
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="1"
            />
            {/* 中心十字瞄准准线与红宝石轴心 */}
            <line x1={cx - 40} y1={cy} x2={cx - 10} y2={cy} stroke="#6ee7b7" strokeWidth="0.8" strokeOpacity="0.75" />
            <line x1={cx + 10} y1={cy} x2={cx + 40} y2={cy} stroke="#6ee7b7" strokeWidth="0.8" strokeOpacity="0.75" />
            <line x1={cx} y1={cy - 40} x2={cx} y2={cy - 10} stroke="#6ee7b7" strokeWidth="0.8" strokeOpacity="0.75" />
            <line x1={cx} y1={cy + 10} x2={cx} y2={cy + 40} stroke="#6ee7b7" strokeWidth="0.8" strokeOpacity="0.75" />
            <circle cx={cx} cy={cy} r={2} fill="#6ee7b7" />
          </g>

          {/* 3. 极坐标同心圆弧型音频播放进度条 (Concentric Arc Progress Bar) */}
          <g
            className={`astrolabe-progress-group ${isSeeking ? 'is-seeking' : ''}`}
            aria-label="圆弧播放进度条"
          >
            {/* 上方当前播放时间 (mm:ss, 薄荷绿纯文本) */}
            <text
              x={timeLabelX}
              y={topTimeY}
              textAnchor="middle"
              className="astrolabe-progress-time-current"
            >
              {formatTime(currentSeconds)}
            </text>

            {/* 进度底轨 (半透明白色质感圆弧) */}
            <path
              d={railPath}
              className="astrolabe-progress-rail"
            />

            {/* 已播放进度填充弧 (薄荷绿发光高亮圆弧) */}
            {fillPath ? (
              <path
                d={fillPath}
                className="astrolabe-progress-fill"
              />
            ) : null}

            {/* 进度游标滑珠 (微晶圆珠) */}
            <circle
              cx={thumbPos.x}
              cy={thumbPos.y}
              r={isSeeking ? 6.5 : 5}
              className="astrolabe-progress-thumb"
            />

            {/* 隐形高触感交互热区 (26px 宽透明轨迹，提供宽容的点击与拖拽手感) */}
            <path
              d={railPath}
              className="astrolabe-progress-hitarea"
              onMouseDown={handleArcMouseDown}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={effectiveDuration}
              aria-valuenow={Math.round(currentSeconds)}
              aria-valuetext={`${formatTime(currentSeconds)} / ${formatTime(effectiveDuration)}`}
              tabIndex={0}
            />

            {/* 下方结束时间 / 总时长 (mm:ss, 次级半透明白纯文本) */}
            <text
              x={timeLabelX}
              y={bottomTimeY}
              textAnchor="middle"
              className="astrolabe-progress-time-duration"
            >
              {formatTime(effectiveDuration)}
            </text>
          </g>
        </svg>

        {/* ------------------------------------------------------------
            歌词轨道渲染层: 极坐标旋转流转架构
            外层容器以 (cx, cy) 为旋转原点，随 activeIndex 发生整体平滑旋转归位
            ------------------------------------------------------------ */}
        <div
          className="lyrics-orbit-wheel"
          style={{
            '--astrolabe-cx': `${cx}px`,
            '--astrolabe-cy': `${cy}px`,
            '--wheel-rotation': `${currentRotation}deg`,
            '--orbit-radius': `${orbitRadius}px`,
            '--step-angle': `${stepAngle}deg`
          } as React.CSSProperties}
        >
          {visibleWindow.map(({ line, index, distance }) => {
            const isCurrent = distance === 0
            const itemAngle = index * stepAngle

            return (
              <div
                key={`${songKey}-line-${index}`}
                className={`lyric-node ${isCurrent ? 'is-active' : ''}`}
                data-distance={distance}
                data-lyric-index={index}
                style={{
                  '--item-angle': `${itemAngle}deg`,
                  '--item-distance': distance
                } as React.CSSProperties}
                onClick={() => handleDirectJump(index)}
              >
                {/* 主歌词行 (大号衬线字体，优雅古典) */}
                <div className="lyric-primary">{line.primary}</div>

                {/* 辅歌词行 (中文译文，次级高亮无衬线; showTranslation 关闭时整站隐藏, 见 CSS 宿主规则) */}
                {showTranslation && line.secondary && (
                  <div className="lyric-secondary">{line.secondary}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
