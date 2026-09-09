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
  /** 当前行变更回调 (用于联动播放器进度) */
  onLineChange?: (index: number) => void
  /** 进度寻道跳转回调 */
  onSeek?: (timeSeconds: number) => void
  /** 是否启用自动演播/微旋动效 (默认为 true) */
  animated?: boolean
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
 * 生成圆弧刻度线
 */
function generateArcTicks(
  cx: number,
  cy: number,
  radius: number,
  tickLength: number,
  startDeg: number,
  endDeg: number,
  stepDeg: number
): Array<{ x1: number; y1: number; x2: number; y2: number; isMajor: boolean }> {
  const ticks: Array<{ x1: number; y1: number; x2: number; y2: number; isMajor: boolean }> = []
  for (let deg = startDeg; deg <= endDeg; deg += stepDeg) {
    const rad = (deg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const isMajor = Math.abs(deg % (stepDeg * 4)) < 0.01

    const len = isMajor ? tickLength * 1.8 : tickLength
    ticks.push({
      x1: cx + cos * (radius - len / 2),
      y1: cy + sin * (radius - len / 2),
      x2: cx + cos * (radius + len / 2),
      y2: cy + sin * (radius + len / 2),
      isMajor
    })
  }
  return ticks
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
  onLineChange,
  onSeek,
  animated = true
}: LyricsOrbitProps) {
  // 当前活跃行索引 (支持非受控与受控双模式)
  const [internalIndex, setInternalIndex] = useState(4) // 默认定格在第4行《Luna domina》
  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex

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

  // 5. 歌词轨道圆弧上的精密刻度线 (沿 radius 360，跨度 -58° ~ +58°，每 1.8° 一格)
  const orbitTicks = useMemo(
    () => generateArcTicks(cx, cy, orbitRadius, 6, -58, 58, 1.8),
    [cx, cy, orbitRadius]
  )

  // 根据外部传入的 currentTime 自动同步歌词行
  useEffect(() => {
    if (currentTime === undefined || lyrics.length === 0) return
    let matchedIdx = 0
    for (let i = 0; i < lyrics.length; i++) {
      if ((lyrics[i].time ?? 0) <= currentTime) {
        matchedIdx = i
      } else {
        break
      }
    }
    if (matchedIdx !== activeIndex) {
      if (controlledIndex === undefined) {
        setInternalIndex(matchedIdx)
      }
      onLineChange?.(matchedIdx)
    }
  }, [currentTime, lyrics, activeIndex, controlledIndex, onLineChange])

  // 切换歌词行
  const handleSelectLine = useCallback(
    (index: number) => {
      if (index === activeIndex) return
      if (controlledIndex === undefined) {
        setInternalIndex(index)
      }
      onLineChange?.(index)
      if (lyrics[index]?.time !== undefined) {
        onSeek?.(lyrics[index].time!)
      }
    },
    [activeIndex, controlledIndex, onLineChange, lyrics, onSeek]
  )

  // 滚轮交互: 向上滚动上一行，向下滚动下一行 (防抖与边界保护)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation()
      if (Math.abs(e.deltaY) < 18) return
      if (e.deltaY > 0) {
        if (activeIndex < lyrics.length - 1) {
          handleSelectLine(activeIndex + 1)
        }
      } else {
        if (activeIndex > 0) {
          handleSelectLine(activeIndex - 1)
        }
      }
    },
    [activeIndex, lyrics.length, handleSelectLine]
  )

  // 键盘方向键监听 (上下键切换歌词)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        if (activeIndex < lyrics.length - 1) {
          handleSelectLine(activeIndex + 1)
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        if (activeIndex > 0) {
          handleSelectLine(activeIndex - 1)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, lyrics.length, handleSelectLine])

  // 滑动窗口: 仅渲染当前行前后 5 行，彻底杜绝超大歌词集的 DOM 冗余与重叠
  const visibleWindow = useMemo(() => {
    const start = Math.max(0, activeIndex - 5)
    const end = Math.min(lyrics.length - 1, activeIndex + 5)
    const items: Array<{ line: LyricLine; index: number; distance: number }> = []
    for (let i = start; i <= end; i++) {
      items.push({
        line: lyrics[i],
        index: i,
        distance: Math.abs(i - activeIndex)
      })
    }
    return items
  }, [lyrics, activeIndex])

  // 当前轨道旋转角度 (以 stepAngle 为单位抵消当前索引，使当前行归位到 0° 水平线)
  const currentRotation = -activeIndex * stepAngle

  // 齿轮步进角: 60 齿高密度精密机芯齿轮，单个齿距为 360° / 60 = 6.0°
  // 方案 1A: 每切一行歌词，齿轮逆时针跳进刚好 2 齿 (-12.0°)，与歌词轨道步长 12.5° 形成近乎完美的等角联动
  const gearStepAngle = 12.0
  const gearRotation = -activeIndex * gearStepAngle

  return (
    <div
      className={`lyrics-orbit-wrapper ${className}`}
      onWheel={handleWheel}
      aria-label="星盘歌词轨道播放区"
    >
      {/* ------------------------------------------------------------
          背景层: 宇宙星盘几何蓝图 SVG (齿轮、同心轨道、刻度、月相与指示器)
          ------------------------------------------------------------ */}
      <svg
        className="astrolabe-svg-bg"
        viewBox="0 0 1100 640"
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
          {/* 12 根纤细主工程射线 (自中心分轮外缘 r=78 延展至内基圆 r=243，端点缀以翡翠微圈) */}
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
          {/* 24 根外缘错位半虚线子射线 (从 r=175 至 r=243，偏转 7.5° 呈现精湛镂空层次) */}
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

        {/* 4. 歌词圆弧同心导轨线 (半径 260px，虚线引导线) */}
        <path
          d={`M ${cx + Math.cos((-58 * Math.PI) / 180) * orbitRadius} ${cy + Math.sin((-58 * Math.PI) / 180) * orbitRadius}
              A ${orbitRadius} ${orbitRadius} 0 0 1 ${cx + Math.cos((58 * Math.PI) / 180) * orbitRadius} ${cy + Math.sin((58 * Math.PI) / 180) * orbitRadius}`}
          fill="none"
          stroke="rgba(110, 231, 183, 0.45)"
          strokeWidth="1.1"
          strokeDasharray="3 4"
        />

        {/* 5. 轨道精密微细刻度线 (沿歌词轨道分布) */}
        <g className="orbit-ticks-group">
          {orbitTicks.map((t, idx) => (
            <line
              key={`otick-${idx}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isMajor ? '#6ee7b7' : 'rgba(255, 255, 255, 0.35)'}
              strokeWidth={t.isMajor ? '1.2' : '0.8'}
              strokeOpacity={t.isMajor ? 0.85 : 0.4}
            />
          ))}
        </g>

        {/* 6. 空间中漂浮的空灵几何多面体晶体 (Blueprint Floating Polyhedra) */}
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
              key={`line-${line.id}`}
              className={`lyric-node ${isCurrent ? 'is-active' : ''}`}
              data-distance={distance}
              style={{
                '--item-angle': `${itemAngle}deg`,
                '--item-distance': distance
              } as React.CSSProperties}
              onClick={() => handleSelectLine(index)}
              title={`点击跳转至第 ${index + 1} 行歌词`}
            >
              {/* 主歌词行 (大号衬线字体，优雅古典) */}
              <div className="lyric-primary">{line.primary}</div>

              {/* 辅歌词行 (中文译文，次级高亮无衬线) */}
              {line.secondary && (
                <div className="lyric-secondary">{line.secondary}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
