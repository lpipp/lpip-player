import { memo, useMemo } from 'react'
import './MechanicalGear.css'

/**
 * 精密机械表齿轮组属性定义
 */
export interface MechanicalGearProps {
  /** 自定义外层类名 */
  className?: string
  /** 是否开启怠速微旋动效 (默认为 true) */
  animated?: boolean
}

/**
 * 生成精密机械渐开线梯形齿轮轮廓 SVG 路径 (纯线框)
 * @param cx 齿轮中心 X 坐标
 * @param cy 齿轮中心 Y 坐标
 * @param rIn 齿根圆半径
 * @param rOut 齿顶圆半径
 * @param teeth 齿数
 */
function generateGearPath(cx: number, cy: number, rIn: number, rOut: number, teeth: number): string {
  const points: string[] = []
  const step = (Math.PI * 2) / teeth
  const halfStep = step / 2
  const flankStep = halfStep * 0.35 // 齿侧渐开线过渡段宽度

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step
    const a1 = a0 + flankStep
    const a2 = a0 + halfStep - flankStep
    const a3 = a0 + halfStep
    const a4 = a0 + step

    // 齿根起点
    const x0 = cx + Math.cos(a0) * rIn
    const y0 = cy + Math.sin(a0) * rIn
    // 齿顶上升沿
    const x1 = cx + Math.cos(a1) * rOut
    const y1 = cy + Math.sin(a1) * rOut
    // 齿顶平台沿
    const x2 = cx + Math.cos(a2) * rOut
    const y2 = cy + Math.sin(a2) * rOut
    // 齿顶下降沿
    const x3 = cx + Math.cos(a3) * rIn
    const y3 = cy + Math.sin(a3) * rIn
    // 齿槽过渡
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
 * 生成阿基米德螺旋游丝路径 (Hairspring)
 * 经典机械钟表摆轮核心擒纵储能游丝
 */
function generateSpiralPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  turns: number,
  pointsCount = 180
): string {
  const points: string[] = []
  const totalAngle = turns * Math.PI * 2
  const angleStep = totalAngle / pointsCount
  const rStep = (rOuter - rInner) / pointsCount

  for (let i = 0; i <= pointsCount; i++) {
    const angle = i * angleStep
    const r = rInner + i * rStep
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) {
      points.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`)
    } else {
      points.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`)
    }
  }

  return points.join(' ')
}

/**
 * 精密机械表机芯齿轮组组件 (MechanicalGear)
 *
 * 包含:
 * 1. 【1号齿轮】:
 *    - 直径 500px (半径 250px)，定格在窗口最右侧；
 *    - 垂直居中于窗口顶部与 80px 磨砂状态栏之间 (上下严格对称，各留 70px)；
 *    - 圆心距离右边框 30px (right: 30px)，外露宽度严格为 250px + 30px = 280px；
 *    - 纯线条制表蓝图风格: 60 齿线框齿圈、双层刻度圈、12 组径向射线与十字微标轴心。
 *
 * 2. 【2号齿轮】:
 *    - 直径 180px (半径 90px)；
 *    - 圆心位于 1号齿轮圆心上方 200px (top: calc(50% - 200px))；
 *    - 圆心距离右边框 70px (right: 70px)，外露宽度为 90px + 70px = 160px；
 *    - 极简通透风格: 24 齿精密渐开线齿圈、12 组主分划刻度、6 根径向工程线与十字瞄准准线。
 *
 * 3. 【3号齿轮】:
 *    - 直径 200px (半径 100px)；
 *    - 圆心位于 1号齿轮圆心下方 280px (top: calc(50% + 280px))；
 *    - 圆心距离右边框 0px (right: 0px)，外露宽度严格为 100px + 0px = 100px；
 *    - 纯线条制表蓝图风格: 28 齿精密线框、16 组清爽刻度、8 根纤细工程辐线与中心十字轴套。
 *
 * 4. 【飞轮 (摆轮)】:
 *    - 直径 250px (半径 125px)；
 *    - 圆心与 3号齿轮水平对齐 (top: calc(50% + 280px))，向左累计偏移 70px (圆心距离右边框 170px)；
 *    - 纯线条高阶制表摆轮: 阿基米德螺旋储能游丝、16 颗配重微调螺钉、经典三臂轮辐与防震轴承；
 *    - 运动模式: 左右往复谐振摆动 (±65° 周期谐波振荡)。
 */
function MechanicalGear({
  className = '',
  animated = true
}: MechanicalGearProps) {
  // ----------------------------------------------------------
  // 1号齿轮几何数据预计算 (直径 500px, 中心 250, 250)
  // ----------------------------------------------------------
  const c1 = 250
  const gear1OuterPath = useMemo(() => generateGearPath(c1, c1, 236, 248, 60), [c1])
  const gear1HubPath = useMemo(() => generateGearPath(c1, c1, 64, 70, 18), [c1])
  const gear1MajorTicks = useMemo(() => generateTicks(c1, c1, 230, 221, 60), [c1])
  const gear1MinorTicks = useMemo(() => generateTicks(c1, c1, 230, 226, 120), [c1])
  const gear1LongTicks = useMemo(() => generateTicks(c1, c1, 230, 216, 12), [c1])
  const gear1RadialLines = useMemo(() => generateTicks(c1, c1, 194, 70, 12), [c1])
  const gear1SubRadialLines = useMemo(() => generateTicks(c1, c1, 194, 145, 24, Math.PI / 24), [c1])

  // ----------------------------------------------------------
  // 2号齿轮几何数据预计算 (直径 180px, 中心 90, 90) - 极简通透版
  // ----------------------------------------------------------
  const c2 = 90
  const gear2OuterPath = useMemo(() => generateGearPath(c2, c2, 82, 88, 24), [c2])
  // 仅保留 12 根清爽分度刻度与 4 根四方关键刻度线，消除视觉杂乱感
  const gear2Ticks = useMemo(() => generateTicks(c2, c2, 78, 71, 12), [c2])
  const gear2MajorTicks = useMemo(() => generateTicks(c2, c2, 78, 67, 4), [c2])
  // 6 根极简径向射线
  const gear2Spokes = useMemo(() => generateTicks(c2, c2, 60, 22, 6), [c2])

  // ----------------------------------------------------------
  // 3号齿轮几何数据预计算 (直径 200px, 中心 100, 100)
  // ----------------------------------------------------------
  const c3 = 100
  const gear3OuterPath = useMemo(() => generateGearPath(c3, c3, 91, 98, 28), [c3])
  // 16 根清爽分度刻度与 4 根四方关键刻度线
  const gear3Ticks = useMemo(() => generateTicks(c3, c3, 86, 79, 16), [c3])
  const gear3MajorTicks = useMemo(() => generateTicks(c3, c3, 86, 73, 4), [c3])
  // 8 根极简径向工程线
  const gear3Spokes = useMemo(() => generateTicks(c3, c3, 75, 26, 8), [c3])

  // ----------------------------------------------------------
  // 飞轮 (摆轮) 几何数据预计算 (直径 250px, 中心 125, 125)
  // ----------------------------------------------------------
  const cf = 125
  // 经典阿基米德游丝 (4.5 圈，由内桩 r=16 螺旋延展至外快慢针处 r=56)
  const flywheelHairspring = useMemo(() => generateSpiralPath(cf, cf, 16, 56, 4.5), [cf])
  // 16 颗外缘配重微调螺钉
  const flywheelScrews = useMemo(() => generateTicks(cf, cf, 123, 114, 16), [cf])
  // 三臂摆轮轮辐主干线 (角度间隔 120°)
  const flywheelArms = useMemo(() => generateTicks(cf, cf, 112, 26, 3, 0), [cf])
  // 轮圈内缘轻量化工程刻度 (12 组)
  const flywheelRimTicks = useMemo(() => generateTicks(cf, cf, 104, 98, 12), [cf])

  return (
    <div
      className={`mechanical-gears-wrapper ${className}`}
      aria-label="右侧精密机械表齿轮组"
      aria-hidden="true"
    >
      {/* ========================================================
          【1号齿轮】: 直径 500px，圆心距右边框 30px，垂直居中
          ======================================================== */}
      <div className="gear-1-container" title="1号齿轮">
        <div className={`gear-1-rotator ${animated ? 'is-animated' : ''}`}>
          <svg
            className="mechanical-gear-svg"
            viewBox="0 0 500 500"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 1号齿轮: 外圈 60 齿纯线框 (半径 236px ~ 248px) */}
            <path
              d={gear1OuterPath}
              fill="none"
              stroke="rgba(110, 231, 183, 0.75)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle
              cx={c1}
              cy={c1}
              r={236}
              fill="none"
              stroke="rgba(110, 231, 183, 0.3)"
              strokeWidth="0.8"
            />

            {/* 1号齿轮: 同心游标刻度圈 */}
            <circle
              cx={c1}
              cy={c1}
              r={230}
              fill="none"
              stroke="rgba(255, 255, 255, 0.6)"
              strokeWidth="1"
            />
            {gear1MinorTicks.map((t, i) => (
              <line
                key={`g1-minor-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="0.7"
              />
            ))}
            {gear1MajorTicks.map((t, i) => (
              <line
                key={`g1-major-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#6ee7b7"
                strokeWidth="1"
                strokeOpacity="0.8"
              />
            ))}
            {gear1LongTicks.map((t, i) => (
              <line
                key={`g1-long-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#ffffff"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            ))}
            <circle
              cx={c1}
              cy={c1}
              r={217}
              fill="none"
              stroke="rgba(110, 231, 183, 0.45)"
              strokeWidth="0.8"
            />
            <circle
              cx={c1}
              cy={c1}
              r={210}
              fill="none"
              stroke="rgba(110, 231, 183, 0.65)"
              strokeWidth="1.2"
              strokeDasharray="1.5 5"
              strokeLinecap="round"
            />
            <circle
              cx={c1}
              cy={c1}
              r={202}
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="0.8"
              strokeDasharray="6 3"
            />
            <circle
              cx={c1}
              cy={c1}
              r={194}
              fill="none"
              stroke="rgba(110, 231, 183, 0.55)"
              strokeWidth="1"
            />

            {/* 1号齿轮: 纤细工程制图射线轮辐 */}
            {gear1RadialLines.map((l, i) => (
              <g key={`g1-radial-${i}`}>
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
            {gear1SubRadialLines.map((l, i) => (
              <line
                key={`g1-subradial-${i}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="0.6"
                strokeDasharray="3 3"
              />
            ))}

            {/* 1号齿轮: 中继同心规线 (已移除36齿齿轮，保持纯净通透) */}
            <circle
              cx={c1}
              cy={c1}
              r={168}
              fill="none"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="0.8"
              strokeDasharray="8 6"
            />
            <circle
              cx={c1}
              cy={c1}
              r={152}
              fill="none"
              stroke="rgba(110, 231, 183, 0.22)"
              strokeWidth="0.8"
            />
            <circle
              cx={c1}
              cy={c1}
              r={96}
              fill="none"
              stroke="rgba(110, 231, 183, 0.25)"
              strokeWidth="0.8"
              strokeDasharray="5 5"
            />

            {/* 1号齿轮: 中心精密轴套与十字瞄准准线 */}
            <path
              d={gear1HubPath}
              fill="none"
              stroke="rgba(110, 231, 183, 0.65)"
              strokeWidth="1"
            />
            <circle
              cx={c1}
              cy={c1}
              r={54}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth="1"
            />
            <circle
              cx={c1}
              cy={c1}
              r={44}
              fill="none"
              stroke="rgba(110, 231, 183, 0.35)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <circle
              cx={c1}
              cy={c1}
              r={24}
              fill="none"
              stroke="rgba(110, 231, 183, 0.75)"
              strokeWidth="1"
            />
            <circle
              cx={c1}
              cy={c1}
              r={15}
              fill="none"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="0.8"
            />
            <circle
              cx={c1}
              cy={c1}
              r={6}
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="1"
            />
            <line x1={c1 - 32} y1={c1} x2={c1 - 8} y2={c1} stroke="#6ee7b7" strokeWidth="0.8" strokeOpacity="0.75" />
            <line x1={c1 + 8} y1={c1} x2={c1 + 32} y2={c1} stroke="#6ee7b7" strokeWidth="0.8" strokeOpacity="0.75" />
            <line x1={c1} y1={c1 - 32} x2={c1} y2={c1 - 8} stroke="#6ee7b7" strokeWidth="0.8" strokeOpacity="0.75" />
            <line x1={c1} y1={c1 + 8} x2={c1} y2={c1 + 32} stroke="#6ee7b7" strokeWidth="0.8" strokeOpacity="0.75" />
            <circle cx={c1} cy={c1} r={1.8} fill="#6ee7b7" />
          </svg>
        </div>
      </div>

      {/* ========================================================
          【2号齿轮】: 直径 180px，圆心距右边框 70px，位于1号齿轮上方 200px
          ======================================================== */}
      <div className="gear-2-container" title="2号齿轮">
        <div className={`gear-2-rotator ${animated ? 'is-animated' : ''}`}>
          <svg
            className="mechanical-gear-svg"
            viewBox="0 0 180 180"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 2号齿轮: 外圈 24 齿纯线框 (半径 82px ~ 88px) */}
            <path
              d={gear2OuterPath}
              fill="none"
              stroke="rgba(110, 231, 183, 0.75)"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <circle
              cx={c2}
              cy={c2}
              r={82}
              fill="none"
              stroke="rgba(110, 231, 183, 0.3)"
              strokeWidth="0.8"
            />

            {/* 2号齿轮: 极简刻度分划 (12 根清爽主分度 + 4 根四方关键长刻度) */}
            <circle
              cx={c2}
              cy={c2}
              r={78}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth="0.9"
            />
            {gear2Ticks.map((t, i) => (
              <line
                key={`g2-tick-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#6ee7b7"
                strokeWidth="0.9"
                strokeOpacity="0.8"
              />
            ))}
            {gear2MajorTicks.map((t, i) => (
              <line
                key={`g2-major-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#ffffff"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            ))}

            {/* 2号齿轮: 内侧单环 (留出通透呼吸空间) */}
            <circle
              cx={c2}
              cy={c2}
              r={60}
              fill="none"
              stroke="rgba(110, 231, 183, 0.4)"
              strokeWidth="0.8"
            />

            {/* 2号齿轮: 6 根纤细径向射线 (纯净单线，无繁杂端点) */}
            {gear2Spokes.map((l, i) => (
              <line
                key={`g2-spoke-${i}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="rgba(110, 231, 183, 0.3)"
                strokeWidth="0.8"
              />
            ))}

            {/* 2号齿轮: 极简中心双层轴心环与十字分划准线 */}
            <circle
              cx={c2}
              cy={c2}
              r={22}
              fill="none"
              stroke="rgba(110, 231, 183, 0.6)"
              strokeWidth="1"
            />
            <circle
              cx={c2}
              cy={c2}
              r={10}
              fill="none"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="0.8"
            />
            <circle
              cx={c2}
              cy={c2}
              r={4}
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="0.9"
            />
            <line x1={c2 - 16} y1={c2} x2={c2 - 5} y2={c2} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.75" />
            <line x1={c2 + 5} y1={c2} x2={c2 + 16} y2={c2} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.75" />
            <line x1={c2} y1={c2 - 16} x2={c2} y2={c2 - 5} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.75" />
            <line x1={c2} y1={c2 + 5} x2={c2} y2={c2 + 16} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.75" />
            <circle cx={c2} cy={c2} r={1.2} fill="#6ee7b7" />
          </svg>
        </div>
      </div>

      {/* ========================================================
          【3号齿轮】: 直径 200px，圆心距右边框 0px，位于1号齿轮下方 280px
          ======================================================== */}
      <div className="gear-3-container" title="3号齿轮">
        <div className={`gear-3-rotator ${animated ? 'is-animated' : ''}`}>
          <svg
            className="mechanical-gear-svg"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 3号齿轮: 外圈 28 齿纯线框 (半径 91px ~ 98px) */}
            <path
              d={gear3OuterPath}
              fill="none"
              stroke="rgba(110, 231, 183, 0.75)"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <circle
              cx={c3}
              cy={c3}
              r={91}
              fill="none"
              stroke="rgba(110, 231, 183, 0.3)"
              strokeWidth="0.8"
            />

            {/* 3号齿轮: 极简刻度分划 (16 根清爽主分度 + 4 根四方关键长刻度) */}
            <circle
              cx={c3}
              cy={c3}
              r={86}
              fill="none"
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth="0.9"
            />
            {gear3Ticks.map((t, i) => (
              <line
                key={`g3-tick-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#6ee7b7"
                strokeWidth="0.9"
                strokeOpacity="0.8"
              />
            ))}
            {gear3MajorTicks.map((t, i) => (
              <line
                key={`g3-major-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#ffffff"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            ))}
            <circle
              cx={c3}
              cy={c3}
              r={75}
              fill="none"
              stroke="rgba(110, 231, 183, 0.45)"
              strokeWidth="0.8"
              strokeDasharray="3 3"
            />

            {/* 3号齿轮: 内侧呼吸虚线圈 */}
            <circle
              cx={c3}
              cy={c3}
              r={56}
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="0.8"
              strokeDasharray="6 4"
            />
            <circle
              cx={c3}
              cy={c3}
              r={40}
              fill="none"
              stroke="rgba(110, 231, 183, 0.25)"
              strokeWidth="0.8"
              strokeDasharray="2 4"
            />

            {/* 3号齿轮: 8 根极简径向工程线 */}
            {gear3Spokes.map((l, i) => (
              <line
                key={`g3-spoke-${i}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="rgba(110, 231, 183, 0.3)"
                strokeWidth="0.8"
              />
            ))}

            {/* 3号齿轮: 极简中心轴心与十字分划准线 */}
            <circle
              cx={c3}
              cy={c3}
              r={26}
              fill="none"
              stroke="rgba(110, 231, 183, 0.65)"
              strokeWidth="1"
            />
            <circle
              cx={c3}
              cy={c3}
              r={13}
              fill="none"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="0.8"
            />
            <circle
              cx={c3}
              cy={c3}
              r={4.5}
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="0.9"
            />
            <line x1={c3 - 18} y1={c3} x2={c3 - 6} y2={c3} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.75" />
            <line x1={c3 + 6} y1={c3} x2={c3 + 18} y2={c3} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.75" />
            <line x1={c3} y1={c3 - 18} x2={c3} y2={c3 - 6} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.75" />
            <line x1={c3} y1={c3 + 6} x2={c3} y2={c3 + 18} stroke="#6ee7b7" strokeWidth="0.7" strokeOpacity="0.75" />
            <circle cx={c3} cy={c3} r={1.5} fill="#6ee7b7" />
          </svg>
        </div>
      </div>

      {/* ========================================================
          【飞轮 (摆轮)】: 直径 250px，圆心与3号齿轮水平 (top: calc(50% + 280px))，
          向左累计偏移 70px (圆心距右边框 170px)，往复谐波摆动模式
          ======================================================== */}
      <div className="flywheel-container" title="机械表摆轮飞轮">
        <div className={`flywheel-rotator ${animated ? 'is-animated' : ''}`}>
          <svg
            className="mechanical-gear-svg"
            viewBox="0 0 250 250"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 飞轮: 光滑高惯量外圈与内外平衡基圈 (半径 112px ~ 120px) */}
            <circle
              cx={cf}
              cy={cf}
              r={120}
              fill="none"
              stroke="rgba(110, 231, 183, 0.85)"
              strokeWidth="1.4"
            />
            <circle
              cx={cf}
              cy={cf}
              r={112}
              fill="none"
              stroke="rgba(110, 231, 183, 0.45)"
              strokeWidth="0.9"
            />

            {/* 飞轮: 16 颗微调配重金螺钉 (Gyromax/Microstella 砝码摆轮特征) */}
            {flywheelScrews.map((s, i) => (
              <g key={`fw-screw-${i}`}>
                <line
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke="#6ee7b7"
                  strokeWidth="1.2"
                />
                <circle
                  cx={s.x1}
                  cy={s.y1}
                  r={1.2}
                  fill="#6ee7b7"
                />
              </g>
            ))}

            {/* 飞轮: 轮圈内测工程分划与同心参考环 */}
            <circle
              cx={cf}
              cy={cf}
              r={104}
              fill="none"
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth="0.8"
              strokeDasharray="3 3"
            />
            {flywheelRimTicks.map((t, i) => (
              <line
                key={`fw-rimtick-${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="0.8"
              />
            ))}
            <circle
              cx={cf}
              cy={cf}
              r={96}
              fill="none"
              stroke="rgba(110, 231, 183, 0.25)"
              strokeWidth="0.7"
            />

            {/* 飞轮: 经典三臂轮辐结构 (每臂包含径向主骨干与双级平衡圈) */}
            {flywheelArms.map((a, i) => {
              const angle = i * ((Math.PI * 2) / 3)
              const cos = Math.cos(angle)
              const sin = Math.sin(angle)
              const rRing1 = 68
              const rRing2 = 92
              return (
                <g key={`fw-arm-${i}`}>
                  <line
                    x1={a.x1}
                    y1={a.y1}
                    x2={a.x2}
                    y2={a.y2}
                    stroke="rgba(110, 231, 183, 0.55)"
                    strokeWidth="1.1"
                  />
                  {/* 轮臂平衡减重规圈 */}
                  <circle
                    cx={cf + cos * rRing1}
                    cy={cf + sin * rRing1}
                    r={5.5}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.5)"
                    strokeWidth="0.8"
                  />
                  <circle
                    cx={cf + cos * rRing2}
                    cy={cf + sin * rRing2}
                    r={4}
                    fill="none"
                    stroke="rgba(110, 231, 183, 0.65)"
                    strokeWidth="0.8"
                  />
                </g>
              )
            })}

            {/* 飞轮: 阿基米德精密螺旋游丝 (Hairspring) - 机械表的心脏灵魂 */}
            <path
              d={flywheelHairspring}
              fill="none"
              stroke="rgba(110, 231, 183, 0.7)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            {/* 游丝外端快慢针与外桩固定销 */}
            <circle
              cx={cf + Math.cos(4.5 * Math.PI * 2) * 56}
              cy={cf + Math.sin(4.5 * Math.PI * 2) * 56}
              r={2}
              fill="#6ee7b7"
            />

            {/* 飞轮: 中心因加百录避震器宝石轴承与微调十字准星 */}
            <circle
              cx={cf}
              cy={cf}
              r={26}
              fill="none"
              stroke="rgba(110, 231, 183, 0.65)"
              strokeWidth="1.1"
            />
            <circle
              cx={cf}
              cy={cf}
              r={16}
              fill="none"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <circle
              cx={cf}
              cy={cf}
              r={10}
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="0.9"
            />
            <circle
              cx={cf}
              cy={cf}
              r={4}
              fill="none"
              stroke="rgba(255, 255, 255, 0.7)"
              strokeWidth="0.8"
            />
            <line x1={cf - 20} y1={cf} x2={cf - 6} y2={cf} stroke="#6ee7b7" strokeWidth="0.75" strokeOpacity="0.8" />
            <line x1={cf + 6} y1={cf} x2={cf + 20} y2={cf} stroke="#6ee7b7" strokeWidth="0.75" strokeOpacity="0.8" />
            <line x1={cf} y1={cf - 20} x2={cf} y2={cf - 6} stroke="#6ee7b7" strokeWidth="0.75" strokeOpacity="0.8" />
            <line x1={cf} y1={cf + 6} x2={cf} y2={cf + 20} stroke="#6ee7b7" strokeWidth="0.75" strokeOpacity="0.8" />
            <circle cx={cf} cy={cf} r={1.5} fill="#6ee7b7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default memo(MechanicalGear)
