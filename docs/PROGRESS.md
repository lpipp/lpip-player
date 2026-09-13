# lpip-player 开发进度记录 (Progress Log)

> 更新时间: 2026-09-13
> 当前阶段: M2-2（界面整洁化持续推进：移除偏好设置一级总览副顶栏 settings-overview-toolbar 与二级导航分类徽标 settings-toolbar-badge；移除卡片顶栏冗余徽标 settings-group-badge；清除无意义 HTML title 悬浮框；性能优化 P1 阶段完成）
> 最新进展: 移除偏好设置一级总览副顶栏与二级导航分类徽标（提交 04ef167）：彻底移除偏好设置一级总览顶部的 settings-overview-toolbar（包含“• 播放器偏好设置”与“实时热重载”），消除与抽屉原生大标题的冗余重复；彻底移除二级详情页导航栏右侧的 settings-toolbar-badge（与下方 Hero 大标题重复的分类徽标）；CDP 9222 实机自动化验收全量通过，详见 §2.28 与 §4.34

---

## 1. 架构与环境核心快照

- **架构方案**: Model B / 方案 C（MPD 仅负责本地音频解码并推流至 `:8000` httpd；Electron 前端通过 fetch + WebAudio 原生 PCM 管道直送 (pcmPlayer.ts) 驱动扬声器与 AnalyserNode 频谱分析，彻底废除 `<audio>` 标签；播放控制走 MPD 6600 纯文本 TCP 协议，手写原生 Client）。
- **流编码 (2026-09-09/10 升级)**: httpd `encoder` 已由 `vorbis` 320k 改为 **`wave`（未压缩 PCM，*:16:2 原生自适应采样率透传，约 1.41~1.54 Mbps）**，MPD 配置 `resampler { plugin "soxr" quality "very high" }`，备份见 `~/.config/mpd/mpd.conf.modelB.bak`。原因见 §4.8 与 §4.12。
- **运行平台**: Arch Linux (Linux 6.x) + KDE Plasma 6 (Wayland) + AMD GPU。
- **技术栈**: Electron 44.2.0 + React 19.2.8 + TypeScript 7.0.2 + electron-vite 5.0.0 + Vite 7.3.6。
- **用户配置文件**: `~/.config/lpip-player/config.json`（支持全量 JSONC 单行/块级中文注释）。
- **当前常驻运行**: Electron 实例在桌面上持续运行中（主进程 PID 59313），实时响应配置、动态壁纸与控制交互。

---

## 2. 已完成的功能与里程碑记录

### 2.1 窗口与背景架构 (M0-1 & 扩展)
- **沉浸式窗口 (`window.immersive`)**:
  - `true`: 无边框、无原生标题栏，不绘制冗余最小化/最大化控件，纯净舞台。
  - `false`: 保留系统原生标题栏与窗口控制。
- **统一背景模式架构 (`window.background`)**:
  - `mode: "default"`: 纯净渐变黑曜石舞台 (`radial-gradient`)。
  - `mode: "mica"`: 黑曜石深色云母晶体效果，支持 `style`（4 种预设色调）、`grainOpacity`（磨砂颗粒度）、`tintOpacity`（漫射辉光）、`edgeHighlight`（边缘内棱线）及 `border`（外发光边框）。
  - `mode: "wallpaper"`: 动静态双模自定义壁纸，支持静态图片与动态视频，支持波浪式向下兼容。
- **动态视频壁纸图层 (`WallpaperLayer`)**:
  - 支持 `.mp4`, `.webm`, `.mkv`, `.mov` 等主流视频格式；
  - 主进程通过 `app-media://` 安全特权协议零拷贝流式读取本地超大视频，无内存爆破风险；
  - 渲染层基于 HTML5 硬件加速 `<video>` 标签，全屏流式播放；
  - 支持配置项：`path`（支持 `~` 展开）、`blur`（高斯模糊）、`overlayOpacity`（暗色遮罩不透明度）、`fit`（cover/contain/fill）、`muted`（静音）、`loop`（循环）、`playbackRate`（0.25~2.0 播放倍速）；
  - 实测已接入卡通小可爱动态水波视频壁纸（`/home/lpipwei/Movies/【哲风壁纸】HH-卡通-小xx.mp4`），表现清澈流畅。

### 2.2 悬浮长条胶囊伸缩抽屉 (`SidebarCapsule`)
- **双态自适应形态**:
  - **收起态**: `56px × 400px` 垂直长条精致悬浮胶囊，容纳 6 大模块占位图标，纯净居中图标高亮与底部 `M-B` 架构标识；
  - **展开态**: 点击任意图标向右展开为 `360px` 抽屉，上下各延展 `50px`（支持 `verticalExtension` 自定义），直接呈现当前模块子菜单列表。
- **防文本折行与高度跳动抖动的视窗裁剪展开机制 (Clip Reveal)**:
  - 采用固定内部宽度 `calc(var(--sidebar-width) - 56px)` + 外层胶囊视窗裁剪展开，文本布局恒定不变，展开动画平滑顺畅。
- **胶囊垂直对齐优化**:
  - 在引入底部状态栏后，胶囊重新调整垂直定位：`top: calc((100% - var(--statusbar-height, 80px)) / 2)`，上下边距各 120px 严格对称居中于窗口顶部与状态栏顶部之间。
- **左侧导轨宽度绝对锚定 (Rail Width Pinning 56px)**:
  - 将 `.capsule-rail` 宽度恒定锁定为 `56px`（`min-width: 56px; max-width: 56px; flex-shrink: 0;`），确保展开与收起全生命周期中图标绝对静止锁定在左侧 56px 区域内，抽屉外层仅从右侧平滑收缩，彻底消除横向跳动与晃动。

### 2.3 底部磨砂状态栏与播放控制组 (`StatusBar`) - 最新完成
- **布局骨架与质感定位**:
  - 位于窗口最底部，高度严格锁定为 80px（`--statusbar-height: 80px`）；
  - 物理材质：液态磨砂玻璃（`background: rgba(14, 16, 24, 0.4)` + `backdrop-filter: blur(20px) saturate(180%)`），通透映衬后方动态水波；
  - 顶部使用 `box-shadow: inset 0 1px 0 0 ...` 替代物理 `border-top: 1px`，确保内部为精确 80px 偶数物理网格，彻底阻断半像素（0.5px）对齐偏差。
- **专辑封面框与黑胶唱片占位符**:
  - 位于悬浮胶囊正下方，尺寸 56px × 56px（`border-radius: 12px`），水平区间 `[16px, 72px]` 与左侧胶囊（`left: 16px; width: 56px`）在同一垂直轴线上严格重合对齐；
  - 未读取到封面时显示精心设计的黑胶唱片 SVG 矢量占位符（外圈黑胶、同心音轨微纹、中心标签盘与 `#6ee7b7` 品牌薄荷绿主轴孔点缀，hover 时旋转 20 度微放大）。
- **播放控制组与视觉对齐**:
  - 位于封面框右侧 30px 处（`margin-left: 30px`）；
  - **上一曲 / 下一曲**: 34px × 34px 圆角方块（`border-radius: 10px`），内部矢量图标放大至 20px；
  - **播放/暂停主按键**: 尺寸 50px × 50px，图标放大至 25px × 25px。三角形经 `-1px` 光学重心微补偿，落于绝对中心。
- **动静分离架构 (Dynamic-Static Decoupling) 与跳动 Bug 根除**:
  - **痛点诊断**: 原实现直接在宿主按钮上应用 `scale(1.06)` 与 `liquidMorph`，导致子元素三角形连带缩放，移开鼠标时由于动画剥离与亚像素栅格化，三角形产生明显的向上弹跳；此外原生 `<button>` 带有浏览器 UA 的 `buttonface` 灰色方块底色。
  - **彻底修复**:
    1. 宿主 `.status-bar-btn-play` 保持 50px 静态网格绝对锁定，不设任何 transform 与直接动画，并显式声明 `background: transparent; border: none; outline: none; box-shadow: none;`，彻底根除方块底色；
    2. 底层伪元素 `::before` 承载暂停态正圆形；
    3. 顶层伪元素 `::after` 承载 `liquidMorph 6s ease-in-out infinite` 液态流动，悬停时通过 `opacity: 1` 平滑淡入，移开时通过 `opacity: 0` 平滑淡出（0.35s 过渡），并在 hover 时承载 `scale(1.06)`；
    4. 内部图标放在 `position: relative; z-index: 2` 上，实测 CDP 采样轨迹位移为 `dY = 0px, dX = 0px`（绝对零抖动）。
- **深浅主题无缝适配**:
  - 支持深色黑曜石（薄荷绿点缀）与浅色白玉霜雪（翠绿色高光）双主题实时切换。
- **液态玻璃进度条与时间指示器**:
  - 位于控制组右侧，采用弹性自适应伸展布局（`flex: 1; max-width: 540px;`）；
  - **左右时间指示器**: 左侧当前播放时间（`01:14`），右侧总时长（`04:08`），强制启用 `font-variant-numeric: tabular-nums` 锁定等宽数字，彻底阻断数字跳动导致的进度条抖动；
  - **液态微光滑轨**: 4px 纤细基底滑轨（半透明黑曜石），内部填充薄荷绿微光进度条与 10px 悬停发光滑块手柄；
  - **交互与寻道**: 支持鼠标悬停高亮、拖拽与点击即时定位寻道，内置播放时间模拟计时器。

### 2.4 窗口右侧精密机械表机芯齿轮与摆轮系统 (`MechanicalGear`) - 最新完成
- **设计哲学**: 高级制表工艺纯线条蓝图工程风 (High Horology Line Blueprint)
  - 彻底摒弃华丽繁杂的厚重填充骨架与渐变宝石，全矢量纯线条（`fill: none; stroke: ...`），呈现瑞士高级镂空机芯的通透感与呼吸留白；
  - 边缘微光漫射：采用双层 `drop-shadow(0 0 6px rgba(110,231,183,0.22))` 烘托精密仪表感。
- **1号主齿轮 (Gear 1)**:
  - 尺寸：直径 500px (半径 250px)；
  - 位置：圆心距离右边框 30px（`right: calc(30px - 250px) = -220px`），外露宽度严格为 $250 + 30 = 280\text{px}$；垂直严格居中于可用区域（窗口顶部至 80px 状态栏顶部之间，上下各留 70px 空间）；
  - 结构：外圈 60 齿渐开线梯形齿圈、双层游标刻度圈、12 组纤细工程射线轮辐、十字瞄准中心精密轴套；
  - 优化：彻底移除第二级 36 齿内圈，保留 $r=168, 152, 96$ 纤细辅助同心虚线规线，大幅提升通透度与现代感；
  - 动效：顺时针匀速旋转（180s/圈）。
- **2号次级齿轮 (Gear 2)**:
  - 尺寸：直径 180px (半径 90px)；
  - 位置：圆心位于 1号齿轮圆心上方 200px（`top: calc(50% - 200px)`），圆心距离右边框 70px（`right: calc(70px - 90px) = -20px`，外露 160px）；
  - 结构：24 齿精密渐开线齿圈、12 根清爽分度刻度 + 4 根四方关键刻度、6 根极简径向射线、极简双层轴套与十字分划；
  - 动效：逆时针咬合旋转（72s/圈，齿数比 60:24 = 2.5 倍速）。
- **3号下级齿轮 (Gear 3)**:
  - 尺寸：直径 200px (半径 100px)；
  - 位置：圆心位于 1号齿轮圆心下方 280px（`top: calc(50% + 280px)`），圆心距离右边框 0px（`right: calc(0px - 100px) = -100px`，圆心正切右边界，外露半圆 100px）；
  - 结构：28 齿精密渐开线梯形齿、16 组清爽分度刻度、8 根纤细径向工程线与中心精密十字轴套；
  - 动效：逆时针咬合旋转（84s/圈，齿数比 60:28）。
- **飞轮 (摆轮游丝系统 / Flywheel / Balance Wheel)**:
  - 尺寸：直径 250px (半径 125px)；
  - 位置：圆心与 3号齿轮严格水平对齐（`top: calc(50% + 280px)`），向左累计偏移 70px，圆心距离右边框 170px（`right: calc(170px - 125px) = 45px`，全外圈完整显露在视窗内，右缘与 3号齿轮外齿形成 53px 的优雅边缘咬合交叠）；
  - 结构：
    1. **外摆轮圈与配重砝码**: 光滑高惯量外圈（$r=120$）与内圈（$r=112$），沿周镶嵌 16 颗微调配重金螺钉（Gyromax/Microstella 砝码摆轮特征）；
    2. **三臂轻量化轮辐**: 经典三臂（120°）轻量化轮辐，每臂配置 $r=68$（半径 5.5px）与 $r=92$（半径 4px）双级同心平衡减重圈；
    3. **阿基米德精密螺旋储能游丝 (Hairspring)**: 4.5 圈精密阿基米德螺旋线（$r=16 \to 56$），外端配有快慢针与外桩固定销，随摆轮同频往复呼吸收放，堪称机械机芯的心脏灵魂；
    4. **中轴避震**: 多层精密防震宝石轴承、微调十字瞄准准星。
  - 动效：**左右往复谐波摆动**，采用高拟真物理正弦曲线 `cubic-bezier(0.45, 0.05, 0.55, 0.95)` 往复摆动 $\pm 65^\circ$（周期 2.4s）。
  - 图层深度：`z-index: 12` 浮于齿轮上方。
- **纵深透光层级与磨砂折射 (Optical Layering)**:
  - `.mechanical-gears-wrapper` 设为 `overflow: visible`，3号齿轮与飞轮下半部分自然延伸进入 80px 磨砂状态栏（`z-index: 100`）；
  - 透过状态栏的高斯模糊与通透黑曜石玻璃，底部的轮系与摆轮呈现出柔和朦胧的透射景深，杜绝了生硬平切的线条切口，模拟出机芯上方覆盖透明蓝宝石水晶夹板的高级制表质感。

### 2.5 极坐标星盘歌词轨道 (`LyricsOrbit`) - 最新完成
- **设计哲学**: 仿照经典《时计》星盘机芯歌词系统 (方案 A: 中央主工作区独立星盘歌词面板)
  - 摒弃传统纵向垂直平滚歌词列表，以中左侧精密天文钟星盘机芯为圆心（$cx = 0\text{px}, cy = 320\text{px}$ 定格左边缘），向右辐射展开一条半径 **$R = 360\text{px}$** 的优雅同心极坐标圆弧轨道；
  - 纯线条蓝图制表风格（全 `fill: none` 矢量，薄荷绿 `#6ee7b7` 与半透明微光），与右侧机械齿轮机芯组形成东西呼应的"双重精密时计"美学；
  - 为歌词区预留了 **450px+** 的宽阔横向安全空间（右侧机芯左边缘位于 $x = 820\text{px}$），无论多长的外文与中文双语歌词均可从容舒展展示。
- **纯净化机芯视觉 (Unobstructed Skeleton Dial)**:
  - 去除横向指向歌词的水平准星指示箭头（`astrolabe-pointer-group`），消除横穿齿轮的突兀线条；
  - 依靠当前行歌词自身 **26px 特大字阶**、水平居中对齐、高对比度纯白光芒与 `#6ee7b7` 翡翠背光微影自显焦点，使左侧星盘机芯齿圈、轮辐与刻度呈现浑然一体、纯净通透的高级制表镂空蓝图。
- **左侧齿轮升级为右侧同款瑞士机械表风格 (Swiss Horology Skeleton Blueprint)**:
  - **60 齿同模数精密线框齿圈**:
    - 齿轮外径 $r_{\text{out}} = 308\text{px}$（直径 `616px`），齿根圆 $r_{\text{in}} = 295\text{px}$，齿数由 36 齿升级为 **60 齿**（单齿齿距角 $\Delta\theta_{\text{tooth}} = 6.0^\circ$）；
    - 齿形微密、精致锐利，与右侧 1号主齿轮（60 齿）完全统一模数与制表视觉语言；
  - **三级同心游标刻度分划圈 (Triple-Tier Dial Ticks)**:
    - 基准分度圈 $r = 288\text{px}$；
    - 120 组微刻度线（Minor Ticks, 长 5px, 透明度 0.25）；
    - 60 组翡翠刻度线（Major Ticks, 长 11px, `#6ee7b7`）；
    - 12 组纯白高亮圆头长刻度线（Long Ticks, 长 18px, 粗度 1.4px, `strokeLinecap: round`）；
  - **多层微距工程规线圈**:
    - 点状微环圈（$r = 263\text{px}$, `strokeDasharray: 1.5 5`）；
    - 虚线分段环（$r = 253\text{px}$, `strokeDasharray: 6 3`）；
    - 内基准实线圈（$r = 243\text{px}$）与多层中继规线（$r = 210, 190, 120\text{px}$）；
  - **双级轻量化工程射线轮辐系统**:
    - 12 根主工程射线（自中心分轮 $r = 78\text{px}$ 延展至内基圆 $r = 243\text{px}$，外端点缀翡翠定位微圈）；
    - 24 根外缘错位半虚线子射线（从 $r = 175\text{px}$ 延伸至 $r = 243\text{px}$，`strokeDasharray: 3 3`，角偏转 $7.5^\circ$），呈现极高精密度的镂空机械腕表层次感；
  - **中心 18 齿微型分轮小齿轮与十字瞄准准星**:
    - 中心搭载 18 齿微型分轮（$r = 70 \sim 78\text{px}$）；
    - 配备同心轴承圈群（$r = 66, 54, 30, 18, 7\text{px}$）与微距防震虚线圈（`2 2`）；
    - 居中十字瞄准准线与翡翠红宝石轴心（Ruby Pivot, $r = 2\text{px}$）；
  - **动力学传动步长 (2 齿/行等角跳齿)**:
    - 歌词每换一行，齿轮逆时针跳进 **2 齿（$-12.0^\circ$）**，与歌词轨道步长（$12.5^\circ$）形成近乎完美的等角刚体联动；
    - 配合 `cubic-bezier(0.18, 1.35, 0.32, 1)` 冲程超调（冲出约 $-16.2^\circ$）与阻尼回弹，每次跳齿均精准落入下一齿槽相位并坚固锁死。
- **极坐标同心圆弧轨道与字阶景深衰减 (Curved Orbit & Typography)**:
  - **主歌词**: 严选高质量古典衬线字体（Playfair Display / DejaVu Serif / Liberation Serif / Noto Serif CJK SC），当前活跃行放大至 26px 纯白高对比度，配备 `#6ee7b7` 薄荷绿背光微影；
  - **副歌词 (译文)**: 选用清晰无衬线字体（14px / 12px），呈现柔和翡翠青透光泽；
  - **角度步长与切线排布**: 每行歌词以 $\Delta\theta = 12.5^\circ$ 沿圆周切线排布，向上历史歌词与向下未来歌词依角距离平滑缩放与阶梯式透明度衰减（$1.0 \to 0.65 \to 0.38 \to 0.20 \to 0.08 \to 0.03$）；
  - **视野窗口与防 DOM 堆叠**: 采用滑动窗口算法（仅挂载焦点前后各 5 行），彻底阻断海量歌词长曲的 DOM 冗余与周角重合。
- **旋转动效与双向联动 (Orbital Rotation & Two-way Sync)**:
  - **极坐标平滑旋转**: 外层歌词轮以 `(cx, cy)` 为旋转轴心，切换歌词时通过 `transform: rotate(-index * 12.5deg)` 配合擒纵超调缓动归位至水平中轴线；
  - **与状态栏播放器深度联动**:
    1. 点击任意歌词行即刻旋转归位，齿轮对应跳齿，并同步触发 `onSeek` 使底栏进度条跳转至对应歌曲时间；
    2. 底栏点击/拖拽进度条时，歌词轨道与左侧齿轮同步自动匹配当前秒数对应行并平滑跳齿旋转；
    3. 支持鼠标滚轮向上/向下滚动切换行，支持键盘 Up/Down 方向键翻页寻道。

### 2.6 悬浮胶囊曲库中心与 MPD 真实音源集成 (`MusicLibraryList`) - 最新完成
- **功能概述与交互闭环**:
  - 点击左侧悬浮胶囊第一个按键（曲库中心 `🎵`）展开抽屉，无缝展现 MPD 后端扫描到的全部本地音源（实测 436 首全量加载）；
  - 单击曲目即刻触发播放（原子化指令向 MPD 发送 `clear` + `add` + `play`），并联动 `StatusBar` 封面、时长与播放态；
  - 点击右侧微圆环加号 `+` 按键将曲目追加至当前播放队列，并呈现翡翠绿打勾 `✓` 1.5s 瞬态视觉反馈；
  - 集成顶部工具栏：实时模糊搜索（支持标题、艺术家、专辑综合极速检索）、总曲数与匹配数统计、MPD 重新扫描刷新按键。
- **高保真视觉排版 (Strict Reference Fidelity)**:
  - 严格对齐用户提供的视觉参考图 (`1874` / `SQ` / `陈奕迅 - The Line-Up` / 右侧 `+` 按键)：
    1. **左侧专辑封面**: 44px × 44px 正方形圆角（8px），支持 `loading="lazy"` 惰性加载；主进程通过 `app-media://cover/...` 动态利用 `ffmpeg` 零拷贝剥离内嵌图片并持久化缓存在 `~/.cache/lpip-player/covers/`（毫秒级命中），内嵌封面缺失时优雅降级为带翡翠绿轴心的精致黑胶唱片矢量占位符；
    2. **中上标题**: 14.5px 粗体白色高清晰文本，单行溢出省略；正在播放时高亮为翡翠薄荷绿 `#6ee7b7`；
    3. **中下音质徽标与元数据**:
       - `SQ` 徽标: 13px 高度圆角矩形，天蓝色微光边框与半透明底色（`#38bdf8`），与参考图一致；
       - `Hi-Res` 徽标: 24bit / 88.2kHz+ 顶级音源自动呈现琥珀金标签（`#fbbf24`）；
       - `HQ` 徽标: 320k MP3 自动呈现薄荷绿标签（`#6ee7b7`）；
       - 歌手与专辑副文本: 11.5px 柔和白灰文本（`${artist} - ${album}`）；
    4. **右侧微圆环加号**: 24px × 24px 极简毛玻璃圆环，hover 时等比放大微亮，点击即时转为绿勾反馈。
- **动静分离铁律与性能保障**:
  - `.music-track-item` 宿主容器锁定整像素绝对网格，文字坐标恒定静止；
  - `::before` 独立伪元素承载卡片磨砂背景、边框高光与 `scale(1.015)` 悬停微缩放与投影；
  - 启用现代 Chromium `content-visibility: auto; contain-intrinsic-size: 0 58px;` 硬件加速视窗裁剪，400+ 巨量曲库流畅 60fps 原生手势/滚轮滚动；
  - 滚动容器彻底隐藏横纵滚动条，保持精致浑然一体的高级感。
- **IPC 通信与安全桥架构**:
  - 主进程 `src/main/mpd.ts`: 原生 Node `net.Socket` TCP 纯文本控制，零第三方包依赖；
  - 常量集 `src/main/ipc-channels.ts`: 杜绝魔术字符串；
  - 安全桥 `src/preload/index.ts`: 遵循最小暴露原则，通过 `contextBridge` 注入安全只读 API，杜绝直接暴露 `ipcRenderer`。

### 2.7 Model B 播放控制与流式音频系统 (`Model B Audio & Full Playback Controls`) - 最新完成
- **前端出声与流式架构 (Model B Stream)**:
  - MPD 服务端作为本地解码推流源（`http://127.0.0.1:8000`，原 vorbis 320k，**2026-09-09 起改为 wave/PCM 无损**，见 §1 与 §4.8），不配置任何本地 alsa/pulse 直接输出，从根源杜绝双声重音；
  - 前端基于 HTML5 `<audio>` 标签拉取流，寻道或切歌时通过 `STREAM_URL + '/?t=' + Date.now()` 瞬间清空 Chromium 预缓冲，精准跟手；
  - 预留 `crossOrigin="anonymous"`，为后续 WebAudio AnalyserNode 频域频谱分析奠定坚实底座。
- **纯文本 TCP 客户端与全链路指令集**:
  - 原生 Node `net.Socket` 连接 MPD `127.0.0.1:6600`；
  - 实现全套指令：`play`、`pause`、`resume`、`togglePlay`、`next`、`prev`、`seek`、`setVolume`、`setPlaybackMode`、`getStatus`、`getSongLyrics`；
  - 500ms 主进程状态广播轮询，双向响应曲目、播放态、秒数、音量与模式变更。
- **底部状态栏全控制功能闭环 (`StatusBar`)**:
  - **曲目封面与黑胶占位符**: 严格对齐左侧悬浮胶囊垂直中轴线（56px × 56px），动态加载 `app-media://cover/`；
  - **主按键控制组**: 上一曲、播放/暂停（正圆与 liquidMorph 动静分离零抖动架构）、下一曲；
  - **液态玻璃进度条**: 左侧当前时间、中间液态微光滑轨与微晶手柄（点击/拖拽即时寻道）、右侧总时长，全量锁定 `tabular-nums` 杜绝文字挤压；
  - **右侧曲目元数据卡片**: 居中两行排版，第一行高对比度加粗标题（超出单行省略），第二行 `SQ`（浅蓝）/ `Hi-Res`（琥珀金）/ `HQ`（薄荷绿）矢量圆角徽标 + 歌手名（悬停提示完整曲名、歌手与专辑）；
  - **播放模式切换 (3 态循环)**:
    - 列表循环 (Sequence / Loop All): `repeat 1, random 0, single 0`
    - 随机播放 (Shuffle / Random): `repeat 1, random 1, single 0`
    - 单曲循环 (Single / Repeat One): `repeat 1, random 0, single 1`
    - 配备独立 34px × 34px 圆角按键与专属矢量图标（双向循环箭头、交叉箭头、带 `1` 循环箭头）；
  - **音量调节系统**: 34px × 34px 扬声器按键（静音 / 低音量 / 中高音量动态图标，点击即时静音/恢复）+ 72px 紧凑型液态微光滑轨，本地 `<audio>.volume` 零延迟瞬时响应并同步推入 MPD `setvol`。
- **内嵌与外置歌词自动提取与星盘联动 (`LyricsOrbit`)**:
  - 主进程通过 `metaflac` 零拷贝极速提取本地 FLAC 内嵌 `LYRICS` 标签（10ms 命中），缺失时自动回退扫描同级 `.lrc` 文件；
  - 极坐标星盘歌词轨道与齿轮擒纵机构实时精准跟进音频秒数；
  - 纯音乐或暂无歌词曲目优雅降级为当前曲目高雅元数据展示，杜绝错配拉丁测试曲。
- **实机运行与桌面常驻**:
  - KDE Plasma 6 Wayland 桌面常驻运行中，CDP 与实机核验均 100% 达成预期；
  - `pnpm typecheck` 与 `pnpm build` 持续保持 0 错误通过。

### 2.8 高级制表纯线条蓝图音频频谱律动图层 (`SpectrumVisualizer`) - M2-1 完成
- **设计风格**: 瑞士高级制表工艺纯线条蓝图工程风 (High Horology Line Blueprint)
  - 严格遵守 `fill: none` 纯线条与 `#6ee7b7` 薄荷绿微光漫射；
  - 底部基准标尺刻度线 (Vernier Caliper Datum Baseline) + 30px 微米分度刻度齿 + 120px 大刻度工程微型十字瞄准准星；
  - 双轨工程包络线：主频域轮廓三阶样条曲线 (`Catmull-Rom` 贝塞尔平滑) + 延时衰减冷青虚线 (`ghostPoints`，4px 4px 点划)；
  - 峰值机芯轴承枢轴 (Nodal Bearings)：局部频域峰值点绘制微圆轴承与垂向投影辅助虚线；
  - 散点粒子微光 (Scattered Particle Glimmers)：声浪迸发时激活动态微光粒子升起并柔和消散。
- **布局定位与严格图层层级 (Layer Hierarchy)**:
  - 物理位置定格于状态栏正上方 (`bottom: 80px; width: 100%`)；
  - 严格图层层级：壁纸图层 `WallpaperLayer` (0) < 频谱图层 `SpectrumVisualizer` (5) < 机械齿轮 `MechanicalGear` (10~12) < 底部状态栏 `StatusBar` (100)；
  - 全局声明 `pointer-events: none`，完全透传鼠标交互，不遮挡星盘歌词、齿轮与胶囊抽屉。
- **极致性能与防劣化保障 (Zero-Degradation)**:
  - **零 React State 循环**: 60fps 渲染全走原生 Canvas 2D + direct ref，绝不触发任何组件重渲染；
  - **零内存分配 (Zero-Allocation)**: `Uint8Array`, `Float32Array`, `BlueprintPoint[]`, `GlimmerParticle[]` 全生命周期复用预分配对象池，杜绝 GC 内存抖动；
  - **自适应 RAF 智能休眠 (Adaptive RAF Sleeping)**: 播放暂停、停止或检测到持续静音时，曲线平滑归零后彻底清空画布并停用 `requestAnimationFrame`，释放 CPU/GPU 算力。
- **配置体系与热重载 (`visualizer`)**:
  - 在 `config.json` 与 `config.example.json` 中扩展 `visualizer` 配置块；
  - 支持 `enabled`（总开关）、`height`（画布高度 40~600px）、`opacity`（不透明度 0.0~1.0）、`style`（'blueprint' | 'wave' | 'bars'）；
  - 主进程与渲染端通过 IPC `CONFIG_CHANGED` 实时热更，修改配置文件秒级生效。

### 2.9 悬浮胶囊播放队列管理抽屉 (`QueueDrawer`) - M2-2 完成
- **功能定位与交互闭环**:
  - 点击左侧悬浮胶囊第 2 个图标（播放队列 `📑`）向右平滑展开 360px 抽屉，再次点击或移出安全距离（默认 80px / 650ms）平滑自动收回；
  - 展开与收起全生命周期中，左侧 56px 固定导轨及 6 大图标绝对坐标恒定（位移 $\Delta X = 0\text{px}$），彻底消除抖动或拉伸变形；
  - 完整呈现 MPD 当前实时播放队列（支持从单曲至 441+ 首巨量队列），展示序号、封面缩略图、标题、SQ/Hi-Res 音质徽标、歌手/专辑与等宽时长；
  - **翡翠绿高亮与正在播放动态指示**: 当前曲目带有 `#6ee7b7` 翡翠绿发光与封面微型跳动频谱条（`EqualizerMiniBars`）；
  - **一键精准定位 (`Locate`)**: 顶部操作栏提供定位按键，点击触发 `activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })`，视口平滑归位至正在播放曲目；
  - **即时点播切歌**: 点击队列项触发播放，通过 `playQueueItem` 发送 MPD `playid` / `play` 指令，联动 WebAudio PCM 管道即时冲刷（`flushAndReconnect`）与双级增益平滑过渡出声；
  - **单曲移除 (`Remove`)**: 每行悬停显现极简叉号按键，乐观剔除并调用 MPD `deleteid` 实时移出队列；
  - **一键清空 (`Clear`)**: 顶部提供清空队列按键，调用 MPD `clear`，无缝呈现极简空队列插画与提示状态；
  - **原生 HTML5 拖拽排序 (Drag & Drop)**:
    - 采用原生 HTML5 `draggable` 机制，悬停于序号列时无缝显现 6 点拖拽手柄（`DragGripIcon`）；
    - 支持双向（向下/向上）拖动，计算上中下半区吸附，翡翠绿激光标线动态指示插入位点；
    - 前端即时乐观重排，底层通过 MPD `move <from> <to>` 指令原子化对齐，实测位点与 MPD 状态 100% 吻合，零第三方重型依赖；
  - **红心收藏标记 (`Favorites`)**: （已于 §2.11 移除收敛，队列右侧仅保留单曲移除叉号按键）。
- **动静分离铁律与视窗裁剪性能**:
  - `.queue-track-item` 宿主容器锁定整像素绝对网格，文字坐标恒定静止；
  - `::before` 独立伪元素承载卡片磨砂背景、边框高光与 `scale(1.012)` 悬停微缩放与投影；
  - 启用 Chromium 现代 GPU 视窗裁剪 `content-visibility: auto; contain-intrinsic-size: 0 58px;`，441+ 巨量队列原生手势/滚轮滚动稳定 60fps；
  - 滚动容器彻底隐藏横纵滚动条，保持精致浑然一体的高级感。

### 2.10 曲库中心队列操作按键二态开关与防重重构 (`MusicLibraryList Toggle Switch`)
- **交互逻辑重构 (从单向打勾升级为双向二态开关)**:
  - 彻底移除原有的“该歌曲已在队列” Toast 浮层与行内 duplicate 徽标，恢复界面纯净与通透；
  - 每首曲目右侧按键根据当前歌曲是否在 MPD 播放队列中呈现两种自适应状态：
    - **未在队列态**: 呈现纤细 `+` 号图标，提示“添加至播放队列”，点击将歌曲追加至 MPD 队列并平滑变为 `-` 号；
    - **已在队列态**: 呈现 `-` 号图标，附带 `#6ee7b7` 薄荷绿微光高亮与半透明液态底色，提示“从播放队列移出”，点击将该曲目从 MPD 队列中剔除并平滑变回 `+` 号；
- **底层 MPD 防重复与存量清理**:
  - `addToQueue` 底层增加队列唯一性检查，若已有相同文件路径，严禁向 MPD 重复发送 `add` 指令，根绝重复曲目；
  - 新增 `deduplicateQueue` 启动自动去重清理，若历史队列存在相同曲目则从后向前安全修剪；
- **全局双向响应式同步**:
  - 监听 MPD `onStatusChange` 与队列版本；当在 `QueueDrawer` 中清空队列或移除单曲时，曲库中心对应曲目的 `+`/`-` 状态毫秒级实时自动联动更新；
  - 引入 `syncSeqRef` 防乱序序列号与 `clickLockRef` 快速点击互斥锁，彻底杜绝 500ms 轮询覆盖乐观 UI 导致的瞬间闪烁；
  - 按钮添加 `onKeyDown` 事件冒泡阻断，彻底根除键盘 Tab 聚焦后回车激活误触发整行切歌的边界缺陷。

### 2.11 播放队列精简收敛与红心收藏功能移除 (`QueueDrawer Simplification`)
- **精简收敛背景与设计哲学**:
  - 播放队列的核心使命在于精准呈现当前播放序列、极速切歌、单曲移除与拖拽排序；
  - 移除队列行内冗余的红心收藏按钮，消除界面右侧的视觉杂质，使等宽时长与单曲移除叉号拥有更加空灵通透的呼吸空间；
- **彻底清理的代码链路**:
  1. 移除 `QueueDrawer.tsx` 中的 `HeartIcon` 矢量图标组件；
  2. 移除 `FAVORITES_STORAGE_KEY` 及 `loadFavorites` / `saveFavorites` 本地存储逻辑；
  3. 移除 `favorites` 状态及 `lpip:favorites-changed` 自定义事件广播与订阅；
  4. 移除曲目行右侧的 `<button className="queue-track-fav-btn">` 元素，仅保留单曲移除按键（`queue-track-remove-btn`）；
  5. 移除 `QueueDrawer.css` 中的 `.queue-track-fav-btn` 样式规则集及 `@keyframes heartBounce` 动画；
- **实测验证结果**:
  - `pnpm typecheck` 0 错误通过；
  - CDP 实机探测 `.queue-track-fav-btn` 数量恒为 0，`.queue-track-actions` 容器严格仅含 1 个移除子按键；
  - 拖拽重排、单曲移除、一键清空与切歌功能完好无损，桌面常驻窗口运行平稳。

### 2.12 悬浮胶囊展开抽屉宽度扩增 (460px) 与视窗空间舒展优化 (`Sidebar Drawer Width Expansion`)
- **变更背景与体验提升**:
  - 用户反馈曲库列表与播放队列抽屉展开时，360px 宽度对于长歌名与双行专辑信息的展示稍显局促；
  - 将悬浮胶囊展开宽度向右侧扩展 100px（由 `360px` 升级至 `460px`）；
  - 得益于既有的 Clip Reveal 视窗裁剪机制与固定宽度计算 `width: calc(var(--sidebar-width) - 56px)`，内部子面板可用宽度从 `304px` 自动扩增至 `404px`，单行曲目卡片实际宽度提升至 `380px`；
  - 极大减少了歌名与副标题文字截断，排版更加通透舒展，同时导轨 56px 保持恒定锁定，动画顺滑无抖动。
- **配置与样式系统全闭环**:
  - `src/main/config.ts`: `DEFAULT_SIDEBAR_CONFIG.width` 改为 `460`，`clamp(obj['width'], 160, 600)` 上限调宽至 600；
  - `src/renderer/src/components/SidebarCapsule.css`: `--sidebar-width` 回退值升级为 `460px`；
  - `~/.config/lpip-player/config.json`: 先行备份为 `.bak`，配置值热更同步为 `460`；
  - `config.example.json`: 同步更新范围 `160 ~ 600` 与默认值 `460`。
- **实测物理尺寸数据 (CDP 硬件抓轨)**:
  - `sidebarWidthVar`: `460px`；
  - 展开态胶囊物理宽度 (`capsuleWidth`): **460px**（零亚像素偏差）；
  - 子面板物理宽度 (`subpanelWidth`): **404px**；
  - 队列与曲库项物理宽度 (`trackItemWidth`): **380px**。

### 2.13 悬浮胶囊第 3 按钮重构为艺人分类 (`ArtistDrawer`) - 方案 A 完备
- **功能定位与排版哲学**:
  - 将原网络电台占位重构为**艺人分类 (ArtistDrawer)**，左侧胶囊配备纯线条制表风矢量人像图标 (`ArtistsIcon`)；
  - 采用**方案 A 双级钻取微画册流 (Two-Tier Drill-Down)**，充分利用 460px 展开宽度（内容区 404px，有效卡片宽 380px），避免纵向手风琴的滚动折叠混乱；
- **层级 1：艺人总览列表 (Artist List View)**:
  - **吸顶工具栏**: 实时模糊搜索框（支持艺人名过滤，删除冗余排序按键后横向空间更宽阔舒展）与 `238 位` 艺人统计徽章；
  - **严格 A-Z 升序排列**: 移除切换按键，统一严格按照首字母与中文拼音（`a.artist.localeCompare(b.artist, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })`）从 A 到 Z 自动升序排序；
  - **44px 圆形微棱头像**: 外环 `rgba(110, 231, 183, 0.25)` 翡翠微光细线，优先截取该艺人第一张内嵌专辑封面圆切，无封面时优雅呈现纯线条制表人像印记；
  - **信息排版**: 14.5px 加粗艺人姓名（正在播放该艺人歌曲时翡翠薄荷绿 `#6ee7b7` 高亮）+ 下方 `28 首歌曲 · 13 张专辑`；
  - **右侧极简操作**: 微型【一键播放】按键（点击立即灌入播放该艺人全部作品）与进入详情提示箭头 `›`；
- **层级 2：艺人单曲详情页 (Artist Detail View)**:
  - **顶部微画卷 Hero 卡片**: 左上角 `‹ 全部艺人` 极简返回按键 + 52px 圆形大头像 + 艺人名与 `共 28 首作品 · 13 张专辑` + 【▶ 播放全部】/【+ 全部入队】紧凑操作组；
  - **单曲列表排版**: 序号、38px 专辑封面、标题、`SQ` / `Hi-Res` / `HQ` 音质徽标、专辑名、等宽时长；
  - **单曲二态开关 (+ 添加 / - 移出)**: 严格继承 `MusicLibraryList` 闭环逻辑，支持乐观更新、防连击互斥锁与 MPD 实时队列双向同步；
- **动静分离与零性能损耗**:
  - 前端利用 `useMemo` 纯内存极速聚合并根据首曲提取头像，**零额外 IPC 与 MPD 协议开销**；
  - 宿主容器锁定整像素绝对网格，`::before` 承载 hover 动画与背景，位移 $\Delta X = \Delta Y = 0\text{px}$ 零抖动；
- **实测数据 (CDP 硬件抓轨)**:
  - 胶囊第 3 项标题精准呈现“艺人分类”，图标为纯线条矢量人像；
  - 工具栏已彻底无 `.artist-sort-btn`，`badgeText: "238 位"`；
  - 艺人严格按 A-Z 升序呈现（阿鲲、阿梨粤、暗杠/寅子、奥井亜紀、別野加奈、彩音、蔡国权、陈慧娴、陈淑桦...）；
  - 单击艺人卡片钻取进入单曲详情，返回按钮一键秒回总览列表，零卡顿零报错。

### 2.14 曲库中心、播放队列与艺人分类液态玻璃微光滑动条 (`Liquid Glass Scrollbar`)
- **设计哲学与参数规范**:
  - 彻底杜绝系统原生粗灰方块或杂乱边框滚动条，在 `global.css` 中抽象通用的 `.liquid-scrollbar` 规范类与 WebKit 伪元素族；
  - **滑轨宽度**: 常态极细 `5px`，鼠标悬停于滚动容器或拖拽滑块时平滑扩展至 `6px`，既保证可点击拖拽，又绝不遮挡或挤压 380px 卡片面积；
  - **轨道 (Track)**: `background: transparent` 完全隐形，透出后方黑曜石磨砂底色与动态壁纸；
  - **滑块形态 (Thumb)**: 胶囊药丸圆角 `border-radius: 999px`，常态黑曜石半透明微白 `rgba(255, 255, 255, 0.18)`；
  - **微光互动反馈**: Hover 与 Active 状态点亮品牌薄荷翡翠高光 `rgba(110, 231, 183, 0.65)` 并附带拟物微外发光 `box-shadow: 0 0 8px rgba(110, 231, 183, 0.4)`；
  - **全主题支持**: 支持深色黑曜石模式与浅色白玉霜雪模式自适应变量（浅色下为墨玉黑半透 `rgba(0, 0, 0, 0.16)` 与草木绿高光）。
- **三大核心歌曲栏全场景覆盖**:
  1. **曲库中心 (`MusicLibraryList`)**: 400+ 本地音源长列表平滑滚动，右侧预留 3px 缝隙；
  2. **播放队列 (`QueueDrawer`)**: 实时播放队列随曲目增多平滑展现，与 HTML5 原生拖拽排序互不干扰；
  3. **艺人分类 (`ArtistDrawer`)**: 艺人总览列表（238 位歌手）与详情页单曲列表同步获得液态玻璃滑动条支持。
- **防抖与通配符解构**:
  - 重构 `SidebarCapsule.css` 中的全通配隐藏规则，排除 `:not(.liquid-scrollbar)`，释放子组件滚动条展示权；
  - 滚动容器严格保持 `overflow-x: hidden`，卡片定格 380px，彻底杜绝出现横向滚动条与布局挤压抖动。
- **实测数据 (CDP 硬件抓轨)**:
  - 曲库中心: `scrollHeight: 33720`, `clientHeight: 237`, `isLiquid: true`；
  - 播放队列: 入队后 `scrollHeight: 614`, `clientHeight: 364`, `isLiquid: true`；
  - 艺人分类总览: `scrollHeight: 15728`, `clientHeight: 364`, `isLiquid: true`；
  - 艺人单曲详情: `scrollHeight: 1646`, `clientHeight: 264`, `isLiquid: true`；
  - CSS 规则: `hasLiquidRule: true`, `thumbColor: rgba(255, 255, 255, 0.18)`, `thumbHover: rgba(110, 231, 183, 0.65)`。

### 2.15 悬浮胶囊第 4 按钮重构为歌单 (`PlaylistDrawer`) - M2-2 完成
- **功能定位与排版哲学**:
  - 将原第 4 项（音频频谱占位）重构为**歌单 (Playlists)**，左侧胶囊配备纯线条制表风矢量歌单图标 (`PlaylistIcon`)；
  - 采用**双级钻取微画册流 (Two-Tier Drill-Down)**，与艺人分类 (`ArtistDrawer`) 视觉语言统一，充分利用 460px 展开宽度（内容区 404px，有效卡片宽 380px）。
- **层级 1：歌单总览层 (Playlist Overview View)**:
  - **吸顶工具栏**: 实时模糊搜索框（支持歌单名过滤）、新建歌单按键 (`playlist-new-btn`) 与歌单总数统计徽章；
  - **歌单卡片**: 展示歌单封面预览（动态推导首曲内嵌封面，无封面时黑胶唱片占位符）、歌单名称（14.5px 加粗白色）、曲目数与总时长统计；
  - **右侧操作**: 微型【一键播放】按键与钻取详情指示箭头 `›`；
  - **歌单管理**: 支持重命名（笔形编辑图标触发行内编辑）与删除（确认弹窗防误删）。
- **层级 2：歌单单曲详情页 (Playlist Detail View)**:
  - **顶部 Hero 卡片**: 左上角 `‹ 全部歌单` 极简返回按键 + 52px 歌单封面 + 歌单名称与 `共 N 首作品 · X 分钟` + 【▶ 播放全部】/【+ 全部入队】/【+ 添加单曲】紧凑操作组；
  - **单曲列表排版**: 序号、38px 专辑封面、标题、`SQ` / `Hi-Res` / `HQ` 音质徽标、歌手/专辑名、等宽时长 (`tabular-nums`)；
  - **单曲二态开关 (+ 添加 / - 移出)**: 严格继承 `MusicLibraryList` 闭环逻辑，支持乐观更新、防连击互斥锁与 MPD 实时队列双向同步；
  - **单曲移出歌单**: 每行提供移出按键，乐观更新列表并调用 MPD `playlistdelete` 指令。
- **MPD 歌单协议全链路打通与安全加固**:
  - 主进程 `mpd.ts` 新增完整歌单指令集: `listplaylists`、`listplaylistinfo`、`playlistadd`、`playlistdelete`、`save`、`rm`、`rename`；
  - 新增 `escapeMpdString` 安全函数，剥离控制字符 (`\r`, `\n`, `\t`, `\0`) 阻断协议注入；
  - 歌单名路径穿越防护（禁止 `/`, `\` 等路径分隔符）；
  - IPC 通道 `ipc-channels.ts` 新增 9 条歌单专属信道，`preload/index.ts` 通过 `contextBridge` 暴露安全歌单 API。
- **动静分离与液态玻璃滑动条**:
  - 歌单卡片宿主容器锁定整像素绝对网格，`::before` 承载 hover 微光与缩放，文字坐标绝对静止 (ΔX = ΔY = 0px)；
  - 滚动容器统一应用 `.liquid-scrollbar` 液态玻璃微光滑动条（5px 极细药丸圆角，hover 薄荷翡翠微发光扩至 6px）。
- **实测数据 (CDP 硬件抓轨)**:
  - 胶囊第 4 项标题: `"歌单"` ✅，展开态宽度: `460px` ✅，导轨: `56px` ✅ 零抖动；
  - `.playlist-drawer-wrapper` 已渲染，`.liquid-scrollbar` 已应用；
  - 歌单列表正确展示（如"我的红心精选 · 10 首歌曲 · 42 分钟"）；
  - `pnpm typecheck` 0 错误，`pnpm build` 成功。

### 2.16 悬浮胶囊第 6 按钮重构为偏好设置 (`SettingsDrawer`) - M2-2 完成
- **功能定位与排版哲学**:
  - 将悬浮胶囊第 6 项（`SettingsIcon`）接管并渲染专属的**偏好设置 (SettingsDrawer)** 抽屉，适配 460px 展开宽度（内容区域 404px，卡片宽度定格 380px）；
  - 采用类似歌单与艺人的**双级钻取画册流 (Two-Tier Drill-Down)** 架构：
    - **层级 1（分类总览层）**: 展示 6 大设置卡片画册，每张卡片搭载纯线条矢量分类图标、加粗分类标题、副文本描述或当前关键状态摘要（如“经典黑曜石 · 沉浸式无边框”、“淡入淡出 120ms · 44.1 kHz 自适应直通”、“蓝图工程风 · 高度 160px”、“127.0.0.1:6600 · 已连接”等），右侧配有钻取指示箭头 `›`；
    - **层级 2（设置详情层）**: 顶部微画卷 Hero 卡片，包含极简返回按键（`‹ 全部设置`）以及该分类的标题与状态描述；下方呈现精细化控件流；支持键盘 Escape / Backspace 优先回退至一级总览层。
- **6 大设置分类与精细化交互控件**:
  1. **外观与窗口**:
     - 沉浸式无边框开关（`window.immersive`: 原生 ToggleSwitch 开/关）；
     - 窗口背景渲染模式单选（`window.background.mode`: 经典黑曜石 / 深色云母 / 自定义壁纸）；
     - 云母效果精细微调（若为 mica，调节默认翡翠/冷夜蓝/素雅黑/暖木炭预设、晶体颗粒度 0~10%、环境微光漫射 0~20%、内高光棱线 0~20%、外发光边框开关）；
     - 自定义壁纸微调（若为 wallpaper，路径输入与应用按键、高斯模糊 0~50px 滑块、暗色遮罩 0~100% 滑块、缩放填充方式 cover/contain/fill、视频静音与循环开关）；
     - 悬浮胶囊与抽屉底色通透度滑块（`window.sidebar.opacity`: 10% ~ 100%）。
  2. **音频与过渡**:
     - 平滑淡入淡出总开关（`audio.fade.enabled`: 开/关二态切换）；
     - 淡入淡出时长滑块（`audio.fade.duration`: 20 ~ 500ms，等宽数字指示器）；
     - 硬件音频直通管道信息卡：实时显示拓扑模型（Model B / WebAudio PCM 直送）、硬件声卡自适应采样率（44.1k / 48k）、音频流解码规格与 ~35ms 极低抗抖前瞻。
  3. **蓝图频谱**:
     - 频谱律动总开关（`visualizer.enabled`: 开/关二态切换）；
     - 视觉渲染风格单选（`visualizer.style`: 蓝图工程 / 正弦波形 / 刻度柱状）；
     - 频谱画布高度滑块（`visualizer.height`: 60 ~ 300px，步长 10px）；
     - 整体不透明度滑块（`visualizer.opacity`: 10% ~ 100%）。
  4. **MPD 服务**:
     - 实时连接状态检测徽章（已连接 / 离线）与一键重新测试按键；
     - 服务端主机 Host、控制命令端口 (6600) 与音频流端口 (8000) 编辑输入与保存应用按键。
  5. **关于播放器**:
     - 播放器核心规格卡片（版本号 v0.1.0、技术栈 Electron 44 / React 19 / Vite、MPD、Model B WebAudio、液态玻璃设计哲学）；
     - 全局操作与快捷键提示（Space, ‹/›, ↑/↓, Esc, Mouse Out）。
- **液态玻璃美学与动静分离**:
  - 纯原生 React + CSS 封装 `ToggleSwitch`、`SliderControl`（等宽数字 `tabular-nums` 防抖）、`SegmentedControl`（WAI-ARIA 键盘无障碍方向键切换）；
  - 宿主容器锁定整像素绝对网格，`::before`/`::after` 承载背景微光与微缩放，位移 $\Delta X = \Delta Y = 0\text{px}$ 零抖动；
  - 滚动容器全量挂载 `.liquid-scrollbar` 液态玻璃滑动条（5px 极细药丸圆角，hover/drag 薄荷翡翠微发光微扩至 6px）。
- **配置原子持久化、实时热重载与沉浸式窗口瞬时重构**:
  - 主进程 `src/main/config.ts` 提供 `saveConfig`，执行深度合并 (`deepMerge`)、各模块 schema 校验与数值钳位，写入前创建 `.bak` 备份，通过 POSIX 随机临时文件写入后 `renameSync` 原子替换，杜绝文件损坏；
  - 主进程提供 `CONFIG_UPDATE` IPC 处理器，更新后立即调用 `applyConfigToWindow` 并向渲染层广播 `CONFIG_CHANGED`；
  - 针对操作系统底层 frame 不可变限制，实现 `recreateWindow` 无缝平滑重建窗口，使“沉浸式无边框模式”开关变更即刻生效，并自动激活顶部 28px 隐形拖拽热区 (`.window-drag-bar`)；
  - 渲染层使用本地即时状态响应（60fps 零延迟视觉）+ 60ms 防抖累加写入，并在组件卸载时强制冲刷（flush on unmount），杜绝滑块调整后快速关闭抽屉导致配置丢失。
- **实测数据 (CDP 硬件抓轨)**:
  - 胶囊第 6 项展开宽度: `460px` ✅，导轨: `56px` ✅ 零抖动；
  - `.settings-drawer-wrapper` 挂载就绪，`.liquid-scrollbar` 覆盖全滚动区域；
  - 5 大分类卡片准确展示，钻取与返回流畅无阻；
  - 沉浸式开关双向切换实测无缝重建窗口（bounds / 全屏 / 最大化状态完整保留，耗时 ~50ms，零闪退）；
  - `pnpm typecheck` 0 错误，`pnpm build` 成功。

### 2.17 偏好设置增加字体与字形设置模块与全文本字阶热联动 (`SettingsDrawer Typography`) - M2-2 完成

> **旧版兼容提示**：配置文件中的 `font` 字段已被自动识别为 `typography` 的别名（`parseTypographyConfig` 接受 `parsed.font`），旧版配置无需修改即可继续生效；建议迁移至标准 `typography` 字段以保持一致。

- **功能定位与排版哲学**:
  - 在偏好设置抽屉中引入专属的**字体与字形 (Typography)** 模块，解决用户在不同高分屏、阅读距离与个人审美偏好下对界面可读性的诉求；
  - 继承既有的**双级钻取画册流 (Two-Tier Drill-Down)** 视觉范式：
    - **层级 1（分类总览层）**: 呈现“字体与字形”专属卡片，搭载纯线条矢量字形图标 (`TypeIcon`)、加粗标题、动态配置参数摘要（如 `UI 13px · 提示 11px · 歌词 18px / 12px`）与钻取指示箭头 `›`；
    - **层级 2（设置详情层）**: 顶部 Hero 导引卡片，提供极简返回按键（`‹ 全部设置`）以及【重置为默认】一键恢复功能；下方按文本类型划分为 4 大精细控件组；支持 Esc / Backspace 优先回退至一级总览。
- **三类文字层次划分与精细化交互控件**:
  1. **UI 界面通用字体**:
     - 适用场景：主工作区、胶囊导航项、抽屉标题、曲库/队列列表项常规标题等；
     - 控件：推荐候选胶囊（系统默认、现代黑体 Inter、优雅圆体 Quicksand、精密等宽 JetBrains Mono）+ 自由文本输入框（支持自定义字体输入、Enter 立即确认、Esc 还原、失焦回退默认）+ 基准字号滑块（11px ~ 20px，步长 1px，默认 13px，`tabular-nums` 等宽数字实时指示）。
  2. **提示与辅助文本**:
     - 适用场景：等宽播放时间指示、SQ/Hi-Res 音质徽标、歌手/专辑副文本、状态栏底部元数据标签等偏小字阶；
     - 控件：推荐候选胶囊（系统等宽 ui-monospace、现代无衬线 system-ui、精密工程 DIN Alternate）+ 自由文本输入框 + 基准字号滑块（9px ~ 16px，步长 1px，默认 11px）。
  3. **星盘歌词排印 (Lyrics Typography)**:
     - 划分为双轨独立子项：
       - **歌词正文 (Body)**: 推荐候选胶囊（史诗衬线 Playfair Display、文艺楷体 Kaiti SC、现代黑体 Inter、手写意趣 Caveat）+ 自由文本输入框 + 字号滑块（14px ~ 36px，步长 1px，默认 18px）；
       - **歌词翻译 (Translation)**: 推荐候选胶囊（默认黑体、文艺楷体、极简黑体、优雅衬线）+ 自由文本输入框 + 字号滑块（10px ~ 22px，步长 1px，默认 12px）。
  4. **配置重置与维护**:
     - 提供独立卡片与操作引导，一键将所有字形与字号秒级恢复至出厂推荐标准。
- **全局动态 CSS 变量系统与毫秒级热重载**:
  - 创建抽象工具模块 `src/renderer/src/utils/typography.ts`，导出 `applyTypographyToDOM(typography)`；
  - 动态向 `:root` 注入标准 CSS 变量：
    - `--font-family-ui`, `--font-size-ui`
    - `--font-family-hint`, `--font-size-hint`
    - `--font-family-lyrics-body`, `--font-size-lyrics-body`（同时设短别名 `--font-family-lyrics` / `--font-size-lyrics`）
    - `--font-family-lyrics-translation`, `--font-size-lyrics-translation`
  - 各组件样式表（`global.css`、`StatusBar.css`、`LyricsOrbit.css`、`MusicLibraryList.css`、`QueueDrawer.css`、`SidebarCapsule.css`）已全面挂接上述 CSS 变量；`SettingsDrawer.css` 目前仅用 `--font-family-hint`，其余组件陆续接入中，修改配置毫秒级全界面同步热响应，完全免刷新、免重启。
- **安全加固与动静分离铁律**:
  - **CSS 注入防护**: 实现 `sanitizeFontFamily` 严格清洗输入，剔除分号、反斜杠、大括号等危险字符，自动规整引号并兜底回退系统安全字体族；
  - **数值边界钳位**: 所有字号在主进程与渲染层双重经历 `clamp()` 边界钳位与 `Number.isFinite()` 校验，阻断 NaN / 负数等异常值；
  - **绝对零抖动 (Zero Layout Shift)**: 时间指示器等关键位置坚守 `tabular-nums`，抽屉卡片与状态栏容器定格整像素外框，字阶缩放绝不牵连容器尺寸抖动，位移实测 $\Delta X = \Delta Y = 0\text{px}$；
  - **防抖累加持久化**: 60ms 拖拽累加防抖 + 卸载强制冲刷（flush on unmount）+ `.bak` 备份 + POSIX 原子重命名写入。
- **实测数据与全量用例验证**:
  - `pnpm typecheck` 严格通过，全量源码 0 TypeScript 错误；
  - `pnpm build` 成功，main / preload / renderer 三产物完整输出；
  - `test-typography-unit.mjs`: 10/10 单元测试全数通过（含空值回退、边界钳位、旧版平铺格式兼容、安全转义与别名解析）；
  - `test-typography-e2e.mjs`: 11/11 端到端实机交互全数通过（含一级卡片检测、钻取详情、胶囊点击、滑块连续拖拽防抖、安全清洗、输入回退与重置默认）。

### 2.18 音频与性能深度体检 (`Audio & Performance Health Audit`) - 2026-09-11 完成

> **结论先行：核心音频指标全部健康，零缺陷。** 体检期间发现的 3 个疑似异常（CPU 偏高、采样率漂移、全局调试变量缺失）经复核全部澄清：前两者为探针自身偏差与正常自适应，后者为既有 CDP 指标已覆盖，无需改代码。

- **体检方法**：免安装依赖探针脚本（Node 24 原生 `globalThis.WebSocket` 直连 CDP 9222 + 原生 TCP 直连 MPD 6600 + `/proc/<pid>/stat` 差分采样），可复用于后续回归体检（脚本在会话临时目录，需要时可按本文档方法重建）。
- **核心音频指标实测（播放中 30 秒窗，200ms 采样）**：
  - `consoleErrors = 0`，页面零报错；
  - 调度健康度 `leadMs`：均值 **88.0ms** / 最小 79.7ms / 最大 97.4ms / 标准差 5.3ms —— 全部落于 70~110ms 铁律窗，抖动极小；
  - 活跃音频源 `activeSources.size`：稳定 5 个（健康区间 3~6）；
  - seek 响应：歌词寻道实测 301~302ms（含 200ms 采样粒度误差，接近一拍）；
  - 双级增益拓扑成员完整：`activeFadeGainNode -> masterGainNode -> analyserNode` 与 `nextPlayTime`、`streamSampleRate` 等均按设计暴露于 `window.__pcmPlayer`。
- **动态采样率自适应交叉验证**：48kHz 曲目播放中 `streamSampleRate = 48000` 且与 MPD `audio: 48000:16:2` 一致；seek/切歌后回落 44100 亦与 MPD `audio: 44100:16:2` 及 `getSampleRate()` 一致 —— 属队列中不同采样率曲目间的正常自适应，非漂移缺陷。
- **全进程树 CPU 实测（8 进程：main + 3 zygote + gpu + renderer + net-utility + audio-utility）**：播放中 **2.8%** / 暂停 **1.0%**（Δ1.8%），其中 renderer 播放中约 2.2%（频谱 RAF + PCM 调度）、暂停后主进程近乎归零。此前初测的 12.2%/5.0% 为探针自身 CDP 高频轮询污染所致（详见 §4.21），非应用缺陷。
- **调试通道备忘**：`window.__mpdSong` / `__mpdDuration` 全局不存在属预期 —— 切歌识别应走 `__pcmPlayer.currentStreamUrl` 变化或 MPD `currentsong`，初测的 600ms 切歌延迟为探针固定 sleep 值而非真实延迟。

### 2.19 封面预压缩双档缓存与提取并发上限 (`Cover Dual-Tier Cache & Extraction Concurrency Limit`) - 2026-09-11 完成

> **结论先行：封面滚动卡顿两处根因一次消除。** 画册流/曲库网格不再解码整张内嵌原图，统一走 512px JPEG 缩略图；从音频剥离原图的 ffmpeg 提取并发上限 2，杜绝视口内 N 张未缓存封面同时 spawn 的主进程 CPU/IO 尖峰。renderer 零改动，原图档留给 M2-3 黑胶大舞台。

- **双档缓存命名**: `<hash>.jpg` = 零拷贝剥离的内嵌原图（存量老缓存原样复用，零作废）；`<hash>.thumb.jpg` = 512px JPEG 缩略图；`<hash>.nocover` = 无内嵌封面标记（逻辑不变）。
- **缩略图生成**: 提取原图成功后紧接 `ffmpeg -i <orig> -vf scale=512:512:force_original_aspect_ratio=decrease -q:v 4 <thumb>`，顺带把 png 等异常内嵌流归一化为真 JPEG；缩略图缺失但原图已缓存时（存量老缓存迁移路径）直接从原图补压缩略图，**不重读音频文件**。
- **分档 URL 与 renderer 零改动**: coverUrl 生成统一 `?tier=thumb`（mpd.ts 4 处生成点）；协议层按 `tier` 参数解析对应缓存文件，`tier=full` 保留原图访问路径（M2-3 大舞台直接可用），**缺省参数按 thumb 处理** → 6 个组件的 `<img>` 与 ArtistDrawer/PlaylistDrawer 直连 URL 自动受益，renderer 零改动。
- **提取并发上限**: 手写 promise 队列（~20 行零依赖），仅包裹「从音频文件提取原图」昂贵步骤（读 FLAC + spawn ffmpeg）；缓存命中、原图补压缩略图等廉价路径不排队；并发上限 2 硬编码常量（`MAX_CONCURRENT_EXTRACT`），未进 config。
- **边界与失败模式**: 无内嵌封面 `.nocover` 短路不变、404 行为不变；缩略图生成失败降级回退 serve 原图（不 404）；原图提取失败沿用 unlink + nocover 逻辑；请求期间文件被清由协议层 `existsSync` 检查覆盖。
- **实测（CDP 9222 探针）**: 30 张并发迁移缩略图全生成（10~54KB，中位 ~37KB）、总耗时 475ms、主进程 CPU 6.8% 无尖峰；分档 thumb/full/缺省各自 200；冷提取（删缓存重取）原图 + 缩略图双档再生 119ms；console 零报错。

### 2.20 悬浮面板全局最小 12px 字阶托底 (`Global 12px Minimum Font Floor`) - 2026-09-11 完成

> **结论先行：低 PPI 屏幕可读性补齐。** 悬浮面板六组件（SidebarCapsule/SidebarBubble/MusicLibraryList/QueueDrawer/ArtistDrawer/PlaylistDrawer/SettingsDrawer）共 75 处 `<12px` 字号声明全部托底 12px；ui/hint 解析钳位与 hint 默认值同步收紧为 12 起跳，偏好设置滑块 min=12；行盒同步补偿，436 行曲库 + L1/L2 全抽屉 computed 扫描零残留、零夹行、零溢出。

- **字号托底三板斧**: ① 硬编码 `9/9.5/10/10.5/11/11.5px` 正则全量上调 12px（含艺人/歌单 9px 音质徽标、导轨 9px `M-B` 徽标）；② hint 变量 calc 负偏移（`-0.5/-2/-2.5px`）归零为 `var(--font-size-hint, 12px)`，`queue-track-duration` 的 `+0.5px` 保留；③ hint 默认 `11→12`（`DEFAULT_TYPOGRAPHY_CONFIG`），解析钳位 ui `11~20` / hint `9~16` 收紧为 **12 起跳**（`parseTypographyConfig` + `applyTypographyToDOM` + SettingsDrawer 滑块 `min={12}`/desc/预览默认值同步）。
- **行盒补偿防夹行溢出**: 艺人/歌单单曲行高 `54→56px`（+ `contain-intrinsic-size` 同步）；曲库行纵向内边距 `7→6px`（曲库标题 14.5px 不变）；Lib/Queue 音质徽标高度 `13/12→16px` 放行 12px 文字；艺人/歌单卡片与单曲双行 `gap 3→2px`、Artist 单曲 meta `gap 2→1px`、Playlist 添加项 `gap 2→1px`。动静分离铁律不受影响（只改盒尺寸与间距，不动缩放宿主）。
- **测试闭环**: 单测 11/11（Test 3 钳位期望更新 + 新增 Test 11 全局托底断言）；e2e Step 9 重置期望 hint `11px→12px` + 新增 **Step 11 computed 扫描**（TreeWalker 遍历胶囊内真实文本宿主 computed font-size，`<12px` 即失败）；typecheck/build 全绿。
- **实测（CDP 9222 探针，HMR 热更后 reload）**: 曲库 436 行 / 队列 10 行 / 艺人 L1 238 卡 / 歌单 L1 / 艺人 L2 单曲 / 歌单 L2 10 行，`<12px=0、夹行=0、溢出=0`；用户桌面窗口保留运行，亲手核验排版。

### 2.21 全界面文字受控分层映射联动设置 (`Typography Layered Mapping`) - 2026-09-11 完成

> **结论先行：界面每一个文字都能通过设置更改，设置页自身同步缩放。** 九组件 89 处硬编码 `font-size` 全量变量化，零硬编码残留；五层语义映射（HINT=hint 直挂 / TITLE=ui 直挂 / MODAL=ui+0.5 / HERO=ui+3 / ICON=ui+1），拖 ui/hint 滑条整组联动；全局 12px 托底收口，单测 11/11 + e2e Step 12 联动验收全绿。

- **分层映射施工**: MusicLibraryList 4 / QueueDrawer 5 / ArtistDrawer 16 / PlaylistDrawer 32 / SettingsDrawer 23 / SidebarBubble 4 / SidebarCapsule 5（含 StatusBar 3 处 hint 11→12 回退基线同步）；缺 `font-family` 的块同步补 `var(--font-family-ui/hint)` 族；`font:` 简写与 TSX 内联经查零残留（仅 StatusBar SVG 装饰数字 `fontSize="8"`，非界面文字，不管）。
- **12px 托底收口**: translation 解析/DOM 钳位/滑条 min `10→12`，ui DOM 钳位 `11→12`，badge 负偏移归零（StatusBar `-1.5px`、Capsule `-0.5px`，Capsule 以 `+0px` 形式保留声明可溯），`global.css` hint 默认 `11→12`，`config.example.json` hint `11→12`（此前托底会话遗留）。
- **测试闭环**: 单测 Test 3 翻译钳位期望 `10→12`；e2e 新增 **Step 12 联动验收**（ui 13→18 / hint 12→16 时设置页自身三处 computed 同步放大且可恢复基线，全程 `<12px=0`）；typecheck/build 全绿；CDP 9222 实测 Step 12 `13.5→18.5 / 12→16 / 13→18` 联动成立、恢复基线一致，Step 11 托底扫描仍为 0。

### 2.22 UI 整洁化隐藏专辑名与冗余说明 (`UI Declutter`) - 2026-09-11 完成

> **结论先行：界面更干净，字阶链路零触碰。** 五处单曲行副文本仅保留歌手（曲库 436 行 / 队列 10 行 / 艺人 L2 / 歌单 L2 10 行 / 添加面板 436 行，严格分隔符 ` - `/` · ` 零残留）；设置页三级描述全删（模块卡 desc + Hero desc + 行级 control-desc，`cardDesc=0/heroDesc=0/ctrlDesc=0`，label 9 + 滑条 4 保留）；胶囊底部版本号 footer + 移出提示 + M-B 全删，呼吸点保留；单测 11/11 + e2e 全绿 + Step 11/12 零回退。

- **五处去专辑同步**: MusicLibraryList（副文本 + title 悬停去 `- 专辑`）/ QueueDrawer（同上，`· 专辑`）/ ArtistDrawer（删 `.artist-song-album` 行，subinfo 仅剩 SQ 徽标）/ PlaylistDrawer L2（`歌手 · 专辑`→仅歌手）+ 添加面板（同上）；搜索过滤 `s.album`、封面 `alt` 兜底、艺人分组 `albums` 统计与 L1 `N 首·N 张专辑`、Hero 计数、`点击播放: 标题 - 歌手` 悬停全部保留 —— 只动展示拼接，不动数据与计数。
- **设置三级全删**: `modulesMeta` 六模块 desc 置空（字段保留防类型涟漪，`hardwareSampleRate/mpdConnected` 状态源保留他用）；L1 卡片与 L2 Hero 的 desc 行删除；7 处行级 `settings-control-desc` 整段删除；`SliderControl/FontPickerControl` 的 `desc?` 签名保留但不再渲染（17 处调用传参暂留，后续可清理）。`liquid-shortcut-desc`（快捷键键值对，非说明小字）与 MPD 状态 label 保留。
- **胶囊底部三删**: `subpanel-footer`（版本号 + 就绪）整节删除；fallback 分支的 `subpanel-section-hint`（子项配置 + `closeDistance/closeDelay` 读数）删除但保留其下 `subpanel-list`（外观主题仍可用）；`capsule-model-badge`（M-B）删除，`capsule-rail-bottom` 留空占位；`capsule-status-dot` 呼吸点保留。被删 CSS 类名保留不动，零样式重构风险。
- **测试闭环**: `pnpm typecheck` 通过；单测 11/11；`pnpm build` 通过（53 模块，CSS 157.44kB）；e2e 全绿（含 Step 11 `<12px=0` + Step 12 `13.5→18.5/12→16/13→18` 联动成立且恢复基线 —— 所用 `.settings-control-label/.liquid-slider-value/.settings-group-title` 选择器均在保留集合内）；CDP 实测曲库 436 行样本全为纯歌手、队列 10 行 `sep=0`、艺人 L2 subinfo 仅 SQ、歌单 L2 10 行 `sep=0`、添加面板 436 行严格分隔符零残留（`See-Saw` 系艺人名内连字符，非拼接残留）；`git status` 仅 6 文件改动，feat 已提交 `8afd258`，`config.json` 经比对零漂移。
- **追加清理 + 原则沉淀**: 设置页 8 处中文标签去英文括号后缀（`(Font Family)/(Body Font)/(Translation Font)/(Control Port)/(PCM Stream Port)/(Model B)`，`星盘歌词排印→歌词排印`，提交 `fce1f17`，typecheck/build/e2e 全绿无回退）；整洁化设计原则整理为 `docs/STYLE.md` §7（七条：只留歌手 / 计数保留 / 无三级小字 / 无英文括号 / 底部无调试 / 只删展示 / 验收纪律），后续抽屉与 M2-3 新页面统一遵循。

### 2.24 悬浮胶囊第五按键重构为统计信息抽屉 (`StatisticsDrawer`) - 2026-09-11 完成

> **结论先行：第五键变统计，次数降序排，累计时长取 MPD 权威值。** 悬浮胶囊第 5 按键由占位外观主题重构为统计信息（`StatsIcon` 三柱条形图，`统计信息`）；抽屉单级展示：顶部摘要卡（累计播放时长 / 总播放次数 / 已统计曲目）+ 降序排行（38px 圆角封面 + 标题>歌手 + 右侧 `N 次` 徽标 + 前三 `#6ee7b7` 高亮 + 空态 `暂无播放记录`）；计数由主进程 `broadcastStatus` 500ms 轮询 `observePlaySession` 状态机驱动（`max(30s, 时长×50%)` 连续 wall-clock，暂停冻结/seek 不清/stop 清空/单曲循环不重复计，达标 `sticker set playCount+1` fire-and-forget）；排行数据源 `stats.playtime` + `sticker find song "" playCount` + 曲库元数据映射（残留 sticker 文件名回退 + `未知歌手`）；应用零本地统计状态，阈值常量硬编码（`PLAY_COUNT_MIN_MS=30000` / `PLAY_COUNT_HALF_RATIO=0.5`），`config.json` 零漂移。

- **通信链**: `MPD_GET_PLAY_STATS: 'mpd:get-play-stats'`（ipc-channels）→ `main/index.ts` handler + 轮询钩子 → `preload` `mpd.getPlayStats()` → `StatisticsDrawer` 挂载拉取 + `onStatusChange` 切歌重拉（序列锁防乱序）；类型 `PlayStats/PlayStatsEntry/PlaySessionState` 落 `types/music.ts`；`getPlayStats/getPlayCount/incrementPlayCount/observePlaySession` + 纯函数 `calcPlayCountThresholdMs/parseMpdPlaytime/parseStickerPlayCounts` 落 `main/mpd.ts`。
- **UI 接线**: `SidebarCapsule` 删 `theme` 模块/`ThemeIcon`/主题注入（设置页已覆盖）+ `subpanel-content-stats` 入滚动组；整洁化延续：副文本只留歌手、计数保留徽标、`tabular-nums`、`.liquid-scrollbar`、`::before` 动静分离、12px 托底；暗知识：MPD `sticker set` 要求 file 必须在曲库内（幽灵 file 报 `No such song`），残留回退分支 e2e 不覆盖仅代码兜底。
- **测试闭环**: `pnpm typecheck` 通过；`pnpm build` 通过（55 模块，JS 894.29kB，CSS 163.87kB）；新增 `test-playstats-unit.mjs` 4 组全绿（阈值/playtime/sticker 解析/状态机暂停冻结·seek 不清·停清空·单循环单计）；新增 `test-playstats-e2e.mjs` 6 步全绿（sticker 预置 A=7/B=3/C=5 → 摘要 `1 小时 55 分/15/3` → 降序 7>5>3 → top-3 高亮 → 空态 → 零残留）+ `test-typography-e2e.mjs` 全绿无回退；feat 已提交 `c7cbd35`，`config.json` 经比对零漂移。

### 2.23 歌词滚轮预览+单击确认跳转 (`Lyric Wheel Preview`) - 2026-09-11 完成

> **结论先行：滚轮只看不跳，单击才跳；暂停常驻，跳完自动播。** 滚轮滚动歌词只进入预览态（轨道/齿轮/窗口/`is-active` 全跟随预览行，零新色零新类），播放态默认 1.5s 超时回弹、暂停态常驻；左键单击任意行直接跳转（`seekLock 1.2s` 仅确认跳转），点播放行仅取消预览；方向键/PageUpDown 保持直跳清预览；`audio.lyricPreview.timeoutMs`（500~5000ms，默认 1500）落盘可配，设置音频模块滑条 0.5~5s step 0.1 显示 `x.x s`；暂停态确认跳转 seek 成功后自动 resume 恢复播放。

- **配置链**: `LyricPreviewConfig{timeoutMs}` + `DEFAULT 1500` + `parseLyricPreviewConfig`（别名 `timeout/timeoutMs/delayMs`，数字串与秒级小数兼容，钳位 500~5000，缺省回退 1500）同时落在 `src/types/config.ts` 与 `src/main/config.ts`（主进程独立解析器，不经 renderer）；`config.example.json` 同步注释；用户 `config.json` 零漂移（缺省走回退，不写盘污染）。
- **预览态机**: `previewIndex/displayIndex` + `previewTimerRef`（每次 tick 重置计时）+ `previewStateRef`（回调内读最新 playing/timeout，防闭包陈旧）；切歌（lyrics 引用变）/自然切行（currentTime 推进）/卸载清预览；`data-lyric-index/data-active-index/data-preview-index` 诊断属性供 e2e 断言。
- **测试闭环**: `pnpm typecheck` 通过；单测 11/11；`pnpm build` 通过（53 模块，JS 890.12kB，CSS 157.44kB 未动）；新增 `test-lyric-preview-e2e.mjs` 7 步全绿（默认 1500/滑条规格/可信滚轮步进+1 且零 seek/播放态超时回弹或暂停态常驻/单击收起/方向键清预览/暂停常驻）；`test-typography-e2e.mjs` 全绿无回退（含 Step 12 联动）；feat 已提交 `39a1842`，`config.json` 经比对零漂移（验证中落盘的 `lyricPreview` 已剔除恢复）。
- **踩坑三则**: (1) React 合成 `onWheel` 只收可信事件，合成 `WheelEvent` dispatch 到 React 根监听不到 —— e2e 必须用 CDP `Input.dispatchMouseEvent mouseWheel`；(2) dev 主进程是常驻进程，改 `src/main` 后出盘 `out/main/index.js` 不自动更新，需重启 `pnpm dev`（`touch` 无效）；(3) e2e 中途会污染用户 `config.json`（滑条/配置更新落盘），断言前后必须用 `/tmp/lpip-config-bak.json` 比对，漂移要剔除恢复 —— 详见 §4.26。

### 2.25 React 组件重渲染阻断隔离与艺人抽屉 GPU 视窗裁剪 (P1 性能优化) - 2026-09-13 完成

> **结论先行：彻底阻断 500ms 进度心跳对静态机芯背景与侧边抽屉长列表的无谓传染，全量补齐 GPU 视窗裁剪。** 通过 `React.memo` 隔离 `MechanicalGear`、`WallpaperLayer`、`SpectrumVisualizer` 与 `SidebarCapsule`；在 `App.tsx` 的 `syncFromMpdStatus` 中对 `currentSong` 实施同曲引用稳定化；将透传给侧边抽屉的操作回调 `handlePlaySong` 与 `handleAddToQueue` 固化为 `useCallback`；在 `ArtistDrawer.css` 为艺人总览（`.artist-item`，238 项）与单曲列表（`.artist-song-item`）补齐 `content-visibility: auto` 与对应 `contain-intrinsic-size`。实测在播放态 3 秒连续心跳窗口下，机械齿轮与曲库长列表（436 首）DOM 突变严格为 0，切歌秒播零延迟，音频健康度稳健维持。

- **功能定位**: 消除播放中心跳广播引发的高频 React VDOM Diff 与长列表重排开销，确保高刷新率与极低 CPU 占用。
- **设计哲学与架构**:
  1. **展示层 memo 隔离**: `MechanicalGear`（内含 800+ 行复杂渐开线齿轮轮廓数学运算与海量同心圆/轮辐 SVG 节点）与 `WallpaperLayer`、`SpectrumVisualizer`、`SidebarCapsule` 全部通过 `React.memo` 包裹，切断非相关 props 驱动的重绘；
  2. **状态心跳引用稳定化**: MPD 500ms 轮询推送反序列化的 `status.currentSong` 对象，若 `file` 与 `id` 未发生改变，沿用既有状态引用，彻底阻断自上而下的无谓属性失效；
  3. **回调函数引用持久化**: 传递给 `SidebarCapsule` 的 `handlePlaySong` 与 `handleAddToQueue` 采用 `useCallback` 固化引用，阻断抽屉打开态下数百条单曲项在心跳节拍下的逐项虚拟 DOM Diff；
  4. **全量视窗裁剪覆盖**: `ArtistDrawer.css` 补齐 `content-visibility: auto; contain-intrinsic-size: 0 60px;`（`.artist-item`）与 `contain-intrinsic-size: 0 56px;`（`.artist-song-item`），使曲库、队列、歌单、艺人四大抽屉实现现代 GPU 视窗裁剪规范统一。
- **性能保障与实测数据**:
  - `pnpm typecheck` 严格 0 报错；
  - `pnpm build` 顺利产出（55 模块，JS 910.16kB，CSS 166.56kB）；
  - CDP 实机探针：播放态下 3 秒观测窗内（至少 6 次 500ms 状态广播），`MechanicalGear` DOM 突变严格为 0，曲库展开态下 436 首歌 DOM 突变严格为 0；
  - 音频管道健康度：`isPlaying=true`，`activeSources=4`，`leadMs=78ms`（严格在 70~110ms 黄金抗抖区间内），采样率 48000Hz 自适应；
  - 艺人抽屉 computed 扫描：238 位艺人卡片全部成功挂载 `content-visibility: auto`。

### 2.26 彻底移除机械齿轮、歌词与列表行上的无意义原生悬浮提示框 (UI Tooltip Declutter) - 2026-09-13 完成

> **结论先行：还界面纯净通透，彻底铲除粗糙的 HTML 原生 title 悬浮框。** 用户反馈鼠标悬停在背景机械齿轮上会弹出“1号齿轮”等原生黑色/灰色小方框，破坏桌面质感与沉浸氛围。全面审查并移除了机械齿轮、星盘歌词、状态栏封面、曲库单曲行、队列单曲行、艺人行/单曲行、歌单卡片/单曲行及设置分类卡片上的无意义 `title` 提示；仅对纯图标按键保留必要的无障碍 `title`。通过 CDP 实机自动化验证全量清理达标，零视觉杂质。

- **问题根因与排查**:
  - 用户提供的 Klipper 剪贴板路径为 KDE Spectacle 局部截图，经像素与文字轮廓分析确认为背景齿轮触发的 HTML 原生 `title="1号齿轮"` 提示框；
  - 原生 `title` 提示框在 Linux/KDE 下表现为沉重的纯色矩形，不仅延迟弹出会遮挡精密线条，且对背景装饰、长行歌词、曲库单曲等本就直观的视觉与行级元素毫无信息增量。
- **清理规范与施工矩阵**:
  1. `MechanicalGear.tsx`: 移除 4 处齿轮与飞轮的 `title="1号齿轮"`、`2号齿轮`、`3号齿轮`、`4号齿轮`（纯视觉背景元素禁止带 title）；
  2. `LyricsOrbit.tsx`: 移除歌词行 `title={"点击跳转至第 ${originalIndex + 1} 行歌词"}`（歌词交互直观，悬浮框遮挡后文）；
  3. `SidebarCapsule.tsx`: 移除顶部微光呼吸点 `title="lpip 播放器"`；
  4. `StatusBar.tsx`: 移除封面卡片容器 `title={currentSong ? ... : 'lpip-player'}`；
  5. `MusicLibraryList.tsx`: 移除曲库单曲行 `title={"点击播放: ${song.title} - ${song.artist}"}`；
  6. `QueueDrawer.tsx`: 移除播放队列单曲行 `title={"点击播放: ${song.title} - ${song.artist}"}`；
  7. `ArtistDrawer.tsx`: 移除艺人列表项 `title={artist.artist}` 与钻取后单曲行 `title`；
  8. `PlaylistDrawer.tsx`: 移除歌单卡片 `title={playlist.name}`、已在歌单提示与单曲行 `title`；
  9. `SettingsDrawer.tsx`: 移除分类总览卡片 `title={`点击进入【${meta.label}】设置`}`。
- **特例保留与无障碍准则**:
  - 纯图标按钮（如播放/暂停、上一曲/下一曲、音量、添加至队列、移除、清空、返回等无文字标签控件）保留必要的 `title` 与 `aria-label`，兼顾可访问性与极简交互。
- **自动化实机验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck` 0 错误；
  - `pnpm build` 成功通过；
  - CDP 实机探测：`gearTitles: []`（4 个齿轮 title 归零）、`lyricTitlesCount: 0`（歌词行 title 归零）、`coverTitle: null`、`railTopTitle: null`，曲库 436 行与队列 10 行单曲行 title 严格为 0，设置卡片 title 严格为 0；
  - 桌面 Electron 实例保持运行，用户核验无障碍与视觉纯净度。

### 2.27 偏好设置分组卡片标题栏冗余状态徽标移除 (Settings Group Badge Declutter) - 2026-09-13 完成

> **结论先行：贯彻极简设计语言，彻底清除卡片顶部的伪装饰噪音。** 用户反馈在偏好设置卡片中，各分组标题右侧带有的状态与英文标识徽标（如 `无边框`、`wallpaper`、`Wallpaper` 等）视觉杂乱、信息重复。经全面排查，将 6 大设置模块共 14 处 `.settings-group-badge` 全部移除；保留硬件音频直通与 MPD 动态连接指示灯。实机全模块 CDP 探测 `groupBadgesCount` 严格归零，界面更舒展纯净。

- **问题根因与排查**:
  - 用户提供的 Klipper 截图圈出了“外观与窗口”中各卡片顶部的 `无边框`、`wallpaper`、`Wallpaper` 徽标；
  - 这类徽标一部分是对下方表单控件（开关、单选框）选中状态的二次镜像，另一部分则是对中文标题的英文重复翻译（如 `Wallpaper`、`Sidebar`、`UI Font`、`Hint Font`、`Lyrics`、`Default`、`Shortcuts`），不仅没有增加用户决策信息，反而给每张卡片增加了视觉噪音。
- **清理清单 (SettingsDrawer.tsx 14 处)**:
  1. `窗口形态与标题栏`: 移除 `{config.window.immersive ? '无边框' : '原生边框'}` 镜像徽标；
  2. `窗口背景渲染模式`: 移除 `{config.window.background.mode}` 模式徽标；
  3. `深色云母晶体效果 (Mica)`: 移除 `Mica Effect` 英文重复徽标；
  4. `自定义壁纸微调 (图片/视频)`: 移除 `Wallpaper` 英文重复徽标；
  5. `悬浮抽屉交互`: 移除 `Sidebar` 英文重复徽标；
  6. `UI 界面通用字体`: 移除 `UI Font` 英文重复徽标；
  7. `提示与辅助文本`: 移除 `Hint Font` 英文重复徽标；
  8. `歌词排印`: 移除 `Lyrics` 英文重复徽标；
  9. `恢复出厂设置`: 移除 `Default` 英文重复徽标；
  10. `双级解耦增益平滑过渡`: 移除 `{config.audio.fade.enabled ? '已开启' : '硬切'}` 镜像徽标；
  11. `蓝图工程律动图层`: 移除 `{config.visualizer.enabled ? '运行中' : '已关闭'}` 镜像徽标；
  12. `原生 TCP 控制客户端与音频流`: 移除 `TCP / HTTP` 英文徽标；
  13. `关于 lpip-player`: 移除 `v0.1.0` 徽标；
  14. `全局快捷键`: 移除 `Shortcuts` 英文徽标。
- **保留特例**:
  - `硬件音频直通管道` 与 `实时连接状态检测` 中的 `liquid-status-badge`（带呼吸/脉冲微光的动态连接状态）作为真实硬件与网络探针保留，符合 STYLE.md §7 规范。
- **自动化实机验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 报错；
  - `pnpm build`：成功构建产出；
  - CDP 遍历 6 大设置模块：`外观与窗口`、`字体与字形`、`音频与过渡`、`蓝图频谱`、`MPD 服务`、`关于播放器` 的 `groupBadgesCount` 全部严格为 **0**；
  - 桌面 Electron 实例已热重载并同步至外观设置页供直接检视。

### 2.28 偏好设置一级总览副顶栏与二级导航分类徽标彻底移除 (Settings Toolbar Declutter) - 2026-09-13 完成

> **结论先行：抽屉标题唯一自明，彻底消除多层嵌套副标题与分类徽标复读。** 用户通过截图明确指出：偏好设置一级总览顶部的 `• 播放器偏好设置` + `实时热重载` 工具栏，以及二级详情页导航栏右上角的分类徽标（如 `外观与窗口`）属于无意义冗余元素。经整洁化施工，将一级总览中的 `.settings-overview-toolbar` 整段移除，并将二级详情导航中的 `.settings-toolbar-badge` 彻底清除。全量 CDP 实机验证 `hasOverviewToolbar=false`、`hasToolbarBadge=false`，界面上下呼吸感与整洁度达到极致。

- **问题根因与排查**:
  - 用户提供的两张 Klipper 截图分别明确圈出了：
    1. 一级总览顶部的 `.settings-overview-toolbar`（左侧小绿点加粗文本 `• 播放器偏好设置` 与右侧绿色徽标 `实时热重载`）；
    2. 二级详情页微画卷 Hero 头部导航条右侧的绿色分类徽标 `外观与窗口`；
  - **冗余根因**: 悬浮抽屉原生顶栏已以 16px 粗体常驻显示 `偏好设置`，一级总览内部再放一条副顶栏纯属套娃复读；二级详情页中，导航栏下方 15px 处即为带有大图标与大字号的 Hero 标题（`外观与窗口`），右上角重复渲染分类徽标没有任何用户决策增益。
- **清理范围 (SettingsDrawer.tsx)**:
  1. 一级总览层：整段删除 `<div className="settings-overview-toolbar">...</div>`（含 `.settings-toolbar-title-area`、`.settings-toolbar-dot`、`.settings-toolbar-title` 与 `.settings-toolbar-badge`）；
  2. 二级详情层：从 `.settings-hero-nav` 中彻底移除 `<span className="settings-toolbar-badge">{activeModuleMeta.title}</span>`，仅在排印设置下保留 `.settings-hero-nav-actions`（承载 `重置默认` 功能按钮）；
  3. 保留 CSS 类名不动，杜绝样式重构风险。
- **自动化实机验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 报错；
  - `pnpm build`：成功构建产出（55 模块，JS 906.34 kB，CSS 166.56 kB）；
  - CDP 实机探测：
    - 一级总览页：`hasOverviewToolbar: false`、`hasToolbarTitle: false`、`hasToolbarBadge: false`、`categoryCardsCount: 6`；
    - 二级详情页：全部 6 大模块的 `hasToolbarBadge` 均恒为 **false**；
    - 字体排印模块的 `hasResetBtn: true` 与所有模块的 `hasBackBtn: true` 完好无损。

## 3. 当前配置文件快照 (`~/.config/lpip-player/config.json`)

```jsonc
{
  "window": {
    "immersive": true,
    "theme": {
      "mode": "dark",
      "brightness": 0,
      "contrast": 1.0
    },
    "background": {
      "mode": "wallpaper",
      "wallpaper": {
        "path": "/home/lpipwei/Movies/【哲风壁纸】HH-卡通-小xx.mp4",
        "blur": 0,
        "overlayOpacity": 0.4,
        "fit": "cover",
        "muted": true,
        "loop": true,
        "playbackRate": 1.0
      },
      "mica": {
        "style": "default",
        "grainOpacity": 0.045,
        "tintOpacity": 0.08,
        "edgeHighlight": 0.12,
        "border": true
      }
    },
    "sidebar": {
      "enabled": true,
      "opacity": 0.3,
      "closeBuffer": 40,
      "closeDelay": 300,
      "animationDuration": 280,
      "animationEasing": "cubic-bezier(0.16, 1, 0.3, 1)",
      "width": 460,
      "verticalExtension": 50
    }
  },
  "mpd": {
    "host": "127.0.0.1",
    "port": 6600,
    "streamPort": 8000
  }
}
```

---

### 4.34 抽屉标题单一性与导航分类徽标的收敛纪律 (2026-09-13)

1. **抽屉原生大标题与面板内副标题的冲突**:
   - 悬浮抽屉在展开时顶部已有由 `SidebarCapsule` 统一渲染的 `subpanel-header`（带模块图标 + `偏好设置` 标题）；
   - 子组件内部若自行再声明一条标题栏（如 `• 播放器偏好设置`），会导致界面纵向出现“标题-副标题-卡片”的三重嵌套堆叠，挤占高分屏与有限纵向视窗；
   - 纪律：抽屉子面板顶层直接呈现内容卡片或真正具备交互行为的搜索框/工具条（如曲库搜索框、队列清空按键），严禁添加无任何控件的纯说明性副顶栏。
2. **两级钻取导航栏与 Hero 标题的去重复读**:
   - 在两级钻取画册流（Two-Tier Drill-Down）中，返回栏的作用是提供明确的返回动作（`‹ 全部设置`）与页面级动作（如 `重置默认`）；
   - 当前分类名称由下方 Hero 标题（带专属矢量图标与强调字阶）权威呈现，严禁在导航栏右上角以徽标形式复读分类名。

### 4.33 卡片标题右侧冗余状态与英文徽标的整洁化清理 (2026-09-13)

1. **表单控件自明性与“状态回声”现象**:
   - 在卡片标题右侧放置微缩状态徽标（如开/关、当前模式名），是典型的不信任控件自明性的“状态回声”设计反模式；
   - 下方的 Toggle 开关（带薄荷绿发光激活态）或 SegmentedControl（带选中高亮胶囊）已经以极高的视觉层级呈现了当前状态，顶部的徽标纯属多余复读；
   - 英文单词翻译型徽标（如 `Wallpaper`、`Sidebar`、`UI Font`）更是缺乏用户决策价值的界面涂鸦。
2. **纯净标题栏带来的排版红利**:
   - 移除 `.settings-group-badge` 后，`.settings-group-header` 仅由 `.settings-group-title` 占据主视觉线，左对齐的大写小字标题与下方控件间距呼吸感显著增强，整体更趋向专业级桌面软件的高级与克制。

### 4.32 界面元素原生 title 属性污染与 UI 纯净原则 (2026-09-13)

1. **原生 HTML title 属性的视觉断层与噪音污染**:
   - 浏览器原生的 `title` 属性由操作系统/浏览器内核绘制（在 Linux/KDE 环境下为不透明纯色方框），通常伴随 500ms~1000ms 的悬停延迟且在移动鼠标时容易残留遮挡后方内容；
   - 播放器的视觉基调是液态磨砂玻璃、黑曜石与高精密度纯线条（如 800+ 行渐开线机械机芯与极坐标星盘歌词），这种原生小黑框与精细打磨的界面质感形成强烈的视觉割裂；
   - 背景机芯、全屏壁纸、歌词行、单曲列表行等属于大面积内容/装饰层，添加 `title` 不仅毫无信息增益，反而在用户光标划过时频繁弹出视觉牛皮癣。
2. **纯图标按钮与行级/卡片容器的权责边界**:
   - **纯图标按钮放行**: 仅在按键自身没有伴随文字标签（如播放/暂停、切歌、关闭、移除、返回、刷新）时保留精炼的 `title` 或 `aria-label`，方便新用户或无障碍读屏理解操作含义；
   - **行级/卡片容器严禁携带**: 单曲行、艺人项、歌单卡片、设置分类卡片等已有清晰的加粗标题、副标题歌手或操作手势暗示，严禁挂载 `title` 属性。
3. **Klipper 剪贴板文件与截图线索分析**:
   - 用户反馈的问题若提供形如 `/home/lpipwei/.local/share/klipper/data/<hash>/<hash>` 的路径，是 KDE Plasma 剪贴板管理工具（Klipper）缓存的 Spectacle 截图文件；
   - 本次通过分析其 103x49 PNG 图像特征快速定位到了悬停在齿轮上触发的 `1号齿轮` 原生 tooltip，实现零沟通成本精准闭环。

### 4.31 React 状态心跳引发的子树连带重渲染与 IPC 引用稳定化 (2026-09-13)

1. **状态心跳对重型 SVG 与长列表的传染性重渲染**:
   - **症状**: MPD 每 500ms 广播一次状态心跳，`App.tsx` 中的 `currentTime` 频繁自增触发 `App` 重渲染；由于 `MechanicalGear`（800+ 行复杂渐开线与微米同心圆 SVG）、`WallpaperLayer`、`SpectrumVisualizer` 未做 memo 隔离，每次心跳都在 JS 线程进行无意义的虚拟 DOM diff；
   - **深层根因**: IPC 每 500ms 反序列化下发的 `status.currentSong` 是全新对象引用，若直接 `setCurrentSong(status.currentSong)` 会导致同曲下 `currentSong` 引用每 500ms 失效；外加透传给 `SidebarCapsule` 的 `handlePlaySong` 未做 `useCallback`，导致即使侧边栏展开着包含 436 首歌曲的曲库列表，全量列表项也会在每个心跳节拍做一轮 VDOM diff；
   - **彻底根治方案**:
     1. **展示层 Memo 隔离**: `MechanicalGear`、`WallpaperLayer`、`SpectrumVisualizer`、`SidebarCapsule` 统一 `export default memo(...)`；
     2. **同曲状态引用稳定化**: 在 `syncFromMpdStatus` 中比对 `prev.file === status.currentSong.file && prev.id === status.currentSong.id ...`，同曲时直接返回 `prev` 保持引用恒定；
     3. **回调函数持久化**: `handlePlaySong` 与 `handleAddToQueue` 固化为 `useCallback`，配合 `syncFromMpdStatusRef` 规避闭包过期；
     4. **视窗裁剪全量补齐**: `ArtistDrawer.css` 补齐 `content-visibility: auto; contain-intrinsic-size: 0 60px;`（`.artist-item`）与 `0 56px;`（`.artist-song-item`）；
     5. **实机验证数据**: 播放态 3 秒观测窗内（至少 6 次 500ms 广播），`MechanicalGear` 与 436 首曲库列表的 DOM 突变数严格为 **0**，切歌即时秒播，`activeSources=4/leadMs=78ms` 黄金抗抖区间稳固。

### 4.30 P0/P1/P2 全量并行修复批量落地 + 实机验收 (2026-09-12)

首轮 6 路并行只读审查挖出 P0×1 + P1×8 + P2×20（§4 独立小节沉淀方法论）；6 worker 并行修复（文件零重叠边界）→ tsc 零错误 → 6 reviewer 只读复检（4 路 OK，stage/config 2 路有尾巴）→ 2 worker 补修 → 2 reviewer 终检全 PASS → 统一批量提交 `6a8af86`（27 文件 +909/−607）。

1. **P0 play-after-pause 永久静音（pcmPlayer）**：`pause()` 置 `activeFadeGainNode=null`，`play()/startStream()` 不重建，只有 `flushAndReconnect()` 建；逐块 `currentGain==null` 仍 `source.start()` 调度未连接源 —— 烧 CPU+流量零声音。修法：`ensureFadeGain()`（play/startStream 双保险）+ 空 gain 直接丢块（残留缓冲保留，下块续拼）。实机：pause 后 sources=0，resume 后 sources=5、leadMs=92ms，再 5s 稳态 sources=4、leadMs=84ms（70~110 健康窗内）。
2. **P1 数值型 MPD 注入（mpd.ts）**：`playQueueItem/moveQueueItem/removeFromPlaylist` 三处 pos 直接插值命令；修法 `isValidMpdIndex`（`Number.isInteger && >=0`）守卫。**P1 共享默认污染（config）**：parser 失败路径返回 DEFAULT 单例引用，后续 `mica.enabled=` 写进全局；修法全部返回拷贝 + 深拷贝。**P1 频谱 stale 闭包 / 飞轮十字臂 / 滚轮阈值 / 徽标类名 / 钻取竞态 / 队列索引错位** 同批修复。
3. **补修尾巴**：gear-2 十字臂同形斜臂（546-547）、同戳分组 secondary 重复拼接（`splitTails + rest.slice(1)` 双计数 → 逐行 `secondary ?? raw`）、package.json 3 个 `@types/*` 残留 `^` 钉死、`parseLyricPreviewConfig/stripJsonComments` 双层重复并入单源。
4. **验收纪律复用**：构建后必须杀旧主进程重启（main 旧则 `Page.reload` 无解，§4.29 纪律）；探针前后 `cp config.json /tmp` + diff 自证零漂移（本次 ZERO_DRIFT）；稳态断言要等 5s（刚 resume 的 11 sources/223ms 是追赶期，稳态 4/84ms 才是结论）。

## 4. 关键踩坑经验与技术纪律

1. **动静分离 (Motion Decoupling) 铁律**:
   - 具有 `transform: scale()` 或 `border-radius` 变形动效的组件，**严禁直接施加在包含图标或文字的宿主容器上**；
   - 否则将破坏整像素网格，导致子元素文字模糊、图标连带拉伸，或在动画移除瞬间发生明显的向上/向下弹跳；
   - **正确做法**: 宿主容器仅负责几何布局与事件捕捉，由 `::before`（基础层）和 `::after`（动态层）伪元素分别承载背景、缩放与动画，文本/图标提升至 `position: relative; z-index: 2` 保持物理坐标绝对静止。
2. **避免奇数物理边框导致的 0.5px 亚像素栅格抖动**:
   - 顶栏或底栏使用 `border-top: 1px` 会导致容器内容可用空间变成奇数（如 `80px - 1px = 79px`），子元素居中时坐标必落在 `.5px` 半像素上，极易在重绘时出现 1px 抖动；
   - **正确做法**: 边缘光效采用 `box-shadow: inset 0 1px 0 0 ...` 替代实体 border，保持内容区为偶数整像素空间。
3. **数字跳动与布局防抖 (Tabular Nums)**:
   - 播放进度条两端的时间指示器必须强制声明 `font-variant-numeric: tabular-nums`；
   - 否则等宽字体在不同数字宽度微差时，会导致右侧或两端容器发生肉眼可见的 1~2px 水平挤压跳动。
4. **精密机械表机芯纯线条蓝图设计纪律 (Mechanical Horology Rules)**:
   - **风格纪律**: 瑞士高级镂空机芯重在极简、透气与纯净的几何线条，严禁堆砌厚重多边形填充、浓艳宝石渐变与过于密集的细碎辅助线，必须保留空灵的呼吸空间；
   - **传动比与转向严格等比**: 咬合齿轮必须遵循相邻反向旋转定律；周期按齿数比严格折算（如 1号 60 齿 180s，2号 24 齿 72s，3号 28 齿 84s）；
   - **摆轮游丝往复物理简谐振动**: 采用 4.5 圈阿基米德等距螺线绘制经典储能游丝，使用正弦平滑曲线 `cubic-bezier(0.45, 0.05, 0.55, 0.95)` 驱动 $\pm 65^\circ$ 往复摆动，模拟真实机芯心跳；
   - **光学穿透层级 (Optical Layering)**: 机芯容器采用 `overflow: visible`，让下级齿轮与飞轮下沿自然穿入底栏，利用状态栏的 20px 高斯模糊形成如蓝宝石水晶夹板下的机芯景深，杜绝生硬平切的线条切口。
5. **原生 `<button>` 标签默认样式重置 (CSS Reset)**:
   - 在使用伪元素重构按钮背景时，原生 `<button>` 标签在 Chromium/Linux 下默认带有 `background-color: buttonface`（约 `#efefef` 灰色正方形）；
   - **正确做法**: 必须在基础按钮类上显式声明 `background: transparent; border: none; outline: none; box-shadow: none;`，防止默认浅灰方块透出。
6. **CSS 裁剪上下文 (Clipping Context) 铁律**:
   - 当元素设置了 `overflow-y: auto` 或 `scroll` 时，内部子元素的缩放或阴影如果超过了 padding，会被硬裁切成直线；必须在滚动容器内部留出足够弥散距离的 padding（`14px ~ 18px`）。
7. **工作流纪律**:
   - 每次构建部署后，**必须启动 Electron 进程并保留在桌面上供用户亲手实机核验**，严禁擅自杀掉进程或让桌面留空；
   - 修改任何用户配置 `~/.config/lpip-player/config.json` 前，必须先备份 `.bak`。

### 4.8 音频卡顿三 bug 根治与测量方法铁律 (2026-09-09, 提交 `7e60a56`)

> **新会话若再遇音频卡顿，先读完本节再动手。** 本节记录了两代错误实现与一次错误的验证方法，
> 重蹈其中任何一条都会浪费整个会话。

#### 症状（用户实测反馈）
1. 点击歌词跳转后间歇性卡顿持续 2~3 秒；
2. 暂停后再播放延迟不固定，**有静音空档**；
3. 拖动进度条跳转，**卡顿在松手后出声前**。
4. 用户明确补充：**纯音频卡顿，画面无影响**。

#### 根因
MPD httpd 输出本质是**一条连续不断的实时直播流**（实测 `<audio>.currentTime` 可达 4006s，
即已连播一小时，**流时间轴与歌曲进度完全解耦**），且服务端严格按真实速率喂数据、
**无初始 burst**（vorbis 实测恒定 ~60KB/s）。

在此前提下，前端任何对 `<audio>` 的干预都是有害的：

| 代 | 做法 | 后果（实测） |
|---|---|---|
| 一代 | 换 `src` 重建连接（`flushAudioStream`） | Chromium 只能按**真实时间**重攒起播缓冲 → **2110ms** 静音 + 3 次 waiting/stalled |
| 二代 | 改写 `currentTime` 追至直播边缘 | `playing` 事件很快回来（**故被误判为已修复**），但强制 seek 令 Chromium 丢弃解码管线内已就绪样本，耳朵仍听得到断续（真实静音 0.23s） |
| 三代（现行） | **什么都不做**，只保证在播 | 真实静音 **0s**，零停滞 |

**正解**：`seekcur` 改变的是 MPD 往**同一条流**里推送的内容，前端唯一该做的是「保证在播」，
**绝不触碰 `src` 与 `currentTime`**。仅保留断供看门狗（1500ms）兜底 MPD
`connection_timeout 60s` 单方面断连的情形。

#### ⚠️ 测量方法铁律（本次最大教训）
**`<audio>` 的 `playing` / `canplay` / `readyState` 只代表解码器收到了数据，
绝不代表扬声器真的出声。** 二代实现正是据此误判为"已修复"，被用户当场否证。

- **唯一可信的真实听感指标**：按固定间隔（200ms）采样 `audio.currentTime`，
  检验其是否**匀速前进**；`Δct < Δt × 0.3` 即为一次真实卡顿，累加即真实静音时长。
- 辅助观察 `buffered.end - currentTime`（cushion 缓冲余量）是否稳定。

#### 现行实测数据（PCM 模式 + 不干预 `<audio>`）
| 操作 | 真实静音 | 停滞样本 |
|---|---|---|
| 进度条 seek | **0 s** | 0 |
| 暂停 5s 后恢复 | **0.2 s**（499ms 出声） | 1 |
| 下一曲切歌 | **0 s** | 0 |

cushion 全程稳定 2.64s，无 `error`，无重建循环。

#### 已被实测否证的假设（勿重复排查）
- ❌ **GPU / `backdrop-filter` / UI 动画管线**：上一会话曾长时间追此方向。用户"纯音频卡顿、
  画面无影响"一句即可排除 —— UI 合成压力只会掉帧发涩，造不出 2~3 秒静音。
- ❌ **MPD seek 后开启新 Ogg 逻辑流**（怀疑 Chromium demuxer 不支持流中途 Ogg 链接）：
  跨 seek 抓包分析证明**只有 1 个 serial、1 个 BOS 页，流完全连续**。
- ❌ **`setvol 0` 可用作流内容标记物**：httpd 输出**无 mixer**，`status` 不返回 `volume` 字段，
  `setvol` 不改变流内容，故该探针无效（曾据此写过一个失败的实验脚本）。

#### 遗留未验事项 (已于 2026-09-10 由方案 C 彻底闭环)
- 方案 A 残留的约 3.2 秒响应滞后（用户实测证实：切歌后歌词已变但耳朵还在唱上一首 3~4 秒），
  现已通过实施「方案 C（WebAudio PCM 流式播放管线）」彻底解决，实测响应时间由 3200ms 降至约 44ms（详见 §4.9）。

### 4.9 方案 C 落地: WebAudio PCM 流式播放管线与响应滞后彻底根除 (2026-09-10)

- **根因确认**:
  HTML5 `<audio>` 标签底层具有强制性预缓冲黑盒（Chromium `buffered.end - currentTime` 恒定积存 2.64s ~ 3.5s 音频样本）。在不强行丢弃缓冲的前提下，必须播完旧缓冲新音频才会出声；若强行重连又会引发 2.1s 起播静音。`<audio>` 在架构上无法兼顾「0 静音」与「低延迟」。
- **方案 C 核心设计**:
  1. **彻底废除 `<audio>` 标签**: 前端彻底移除 `<audio>` 元素与相关 workaround；
  2. **自建 PCM 流式驱动 (`src/renderer/src/services/pcmPlayer.ts`)**:
     - 基于 `fetch` + `ReadableStream` 零拷贝直拉 MPD `:8000`（`wave/PCM 44100:16:2`）；
     - 极速解析 44 字节 WAV 头部，裸 16-bit PCM 转 WebAudio `Float32Array`；
     - 采用 `AudioBufferSourceNode` 毫秒级流水线调度，基准抖动缓冲仅 **35ms**；
     - 集成 `GainNode`（平滑音量与静音）和 `AnalyserNode`（FFT 频域分析）；
  3. **瞬间排空 (`flushAndReconnect`)**:
     - 切歌或寻道时，`abortController.abort()` 立即截断 fetch 流，同时对所有已调度的 `AudioBufferSourceNode` 执行 `stop(0)`（**0ms 硬截断旧声音**）；
     - 重置调度时钟并立即发起新连接，新音源在 **~44ms 内即可从扬声器出声**。
- **实测数据验证**:
  - 切歌响应：旧曲在 0ms 瞬间停止，新曲在 ~50ms 起播，彻底根除“歌词已换还在唱上一首”；
  - 进度条寻道 / 歌词跳转：实测 44ms 即开始输出新落点音频，FFT 能量无缝衔接；
  - 真实静音 0s，卡顿 0s，CPU 增加 < 1%；
  - 原生打通 WebAudio `AnalyserNode`，实时提取 FFT 频域能量，直接为 M2-1 频谱动效奠定物理底座。

### 4.10 切歌与歌词跳转音频平滑淡出淡入与配置系统落地 (2026-09-10)

- **用户需求**:
  方案 C 瞬间排空虽然实现了 44ms 极速响应，但 0ms 硬截断会在切歌与歌词跳转时产生突兀感甚至微弱的截断爆音。要求增加可配置的淡出淡入（Fade-Out / Fade-In）平滑过渡，并在配置文件中支持开关与时长调节。
- **架构设计与双级增益拓扑 (Two-Tier Gain)**:
  1. **音频图解耦**:
     - 拓扑：`AudioBufferSourceNode -> fadeGainNode (过渡专用) -> masterGainNode (音量/静音专用) -> analyserNode (FFT) -> destination`；
     - 彻底解耦用户音量控制与切换过渡，用户在任何音量或静音状态下，过渡曲线均不污染用户设置。
  2. **切换与排空过渡驱动 (`flushAndReconnect`)**:
     - **淡出 (Fade-Out)**: 若 `fadeConfig.enabled` 为 true，当前 `fadeGainNode` 线性淡出至 0 (`linearRampToValueAtTime(0, now + fadeSec)`)，旧源延迟精准停止并自动销毁；若为 false 则 0ms 硬切；
     - **接续淡入 (Fade-In)**: 首块新 PCM 数据到达时，在调度起点 `nextPlayTime` 将 `fadeGainNode` 线性淡入至 1.0 (`0 -> 1.0`)；旧流淡出与新流到达（~35-45ms）精准接续，形成极佳听感的下凹平滑过渡（Dipped Crossfade）。
     - **暂停柔化 (`pause`)**: 暂停时执行 80ms 柔和微淡出，杜绝卡哒声。
  3. **配置系统支持与文件热重载**:
     - 配置文件 `~/.config/lpip-player/config.json` 与 `config.example.json` 新增 `audio.fade` 配置段（`enabled: boolean, duration: number`）；
     - 主进程通过 `node:fs` 的 `watch()` 监听配置文件变动，带 150ms 防抖，通过 `CONFIG_CHANGED` IPC 实时广播；
     - Preload 暴露 `window.electronAPI.config.get()` 与 `onChange()`；渲染层订阅即时更新 `pcmPlayer.setFadeConfig()`，无需重启应用即可秒级生效。
- **实测验证 (CDP 增益采样与热更测试)**:
  - 切歌实测增益轨迹：`dtMs: 23ms -> 1.0`, `55ms -> 0.168`, `75ms -> 0.337`, `96ms -> 0.506`, `119ms -> 0.700`, `139ms -> 0.869`, `160ms -> 1.0`，完全符合平滑过渡预期；
  - 动态切换测试：通过脚本动态修改 `enabled: false`，渲染端 400ms 内即时收到广播并切回硬切模式；还原后即刻恢复平滑淡入淡出。

### 4.11 歌词跳转与切歌后短暂杂音根因排查与彻底根治 (2026-09-10)

- **症状**:
  用户实测反馈：“歌词跳转或切歌后会有短暂杂音”。
- **精确定位四大根因**:
  1. **单一 GainNode 共享导致新旧流交叠拉扯与阶跃截断**:
     - 旧实现中，新流与旧流连接至同一个 `fadeGainNode`；
     - 当新流第一块数据到达触发淡入（0 -> 1.0）时，仍在延时淡出的旧源被一同拉高增益，导致新旧两处音频混杂叠播；
     - 调度起点处 `cancelScheduledValues` 与 `setValueAtTime(0)` 将尚未淡出完毕的增益瞬间打回 0，产生严重的时间轴阶跃爆音（Step Discontinuity）。
  2. **调度时钟激进判定引发人工静音裂隙 (Artificial Gap Glitch)**:
     - 旧调度逻辑判定 `if (this.nextPlayTime < now + 0.015)` 即重置时钟 `nextPlayTime = now + 0.035`；
     - 当切歌或歌词跳转触发 React 复杂 UI（星盘、歌词重排、高斯模糊）重绘导致主线程发生 15~20ms 微停顿时，音频硬件其实仍在持续平滑出声，但此条件被误触，强行向前插入 20ms 人工静音空档，导致切歌出声后约 0.5 秒处必定爆发一次咔哒杂音。
  3. **旧 fetch 读取流微任务尾包残留泄漏**:
     - `AbortController.abort()` 异步触发过程中，若前一个 HTTP 连接有尚未结算的 PCM 块，在重连后可能窜入新解析管线。
  4. **WAV 头部 44 字节边界保护不足**:
     - 若因网络抖动前序字节发生极微小偏移，ASCII 字符可能被当作 16-bit 线性 PCM 强行解码，输出刺耳爆裂声。
- **解决方案与重构落地**:
  1. **流世代专属增益节点架构 (Decoupled Stream Generation Gain)**:
     - 每个流会话拥有自生自灭的独立 `activeFadeGainNode`；
     - `flushAndReconnect` 时旧流 GainNode 独立淡出至 0 并于 100ms 后安全 disconnect；新流 GainNode 独立创建并以增益 0 启动淡入；新旧声源互不干扰，彻底消除交叠与阶跃。
  2. **严密的无裂隙调度防线 (Seamless Contiguous Scheduling)**:
     - 调整判定逻辑：只要 `nextPlayTime >= now`（音频硬件未跑空），一律以精确毫秒级无缝紧密拼接；
     - 仅当 `nextPlayTime < now`（真正硬件断粮）时才重置前瞻，并将初始安全前瞻充盈至 50ms，彻底根绝 React 渲染微停顿引发的裂隙杂音。
  3. **递增 `currentStreamId` 隔离门禁**:
     - 每次切换递增世代 ID，丢弃一切不匹配当前 ID 的异步微任务数据，旧流不可泄露。
  4. **严格的 RIFF 标识对齐与安全解析**:
     - 强制扫描校验 WAV 头部 `RIFF` 标识与 44 字节边界，杜绝任何非音频字符入耳。
- **实测数据验证**:
  - 切歌与歌词跳转后连续接收 65+ 块音频数据，CDP 监测 `underruns: []`（0 欠载，0 裂隙）；
  - 增益曲线自真 0 线性无缝爬升至 1.0，波形连续无阶跃，杂音彻底消除。

### 4.12 少数 48kHz 特殊曲目全程背景爆破音根因定位与彻底根治 (2026-09-10)

- **症状**:
  用户实测反馈：“少数音乐会出现全程背景爆破音，如：《灰色轨迹》、《钟无艳》、《喜帖街》”。
- **排查与对比实测事实**:
  1. **音频源文件规格差异**:
     - 出现爆破音的三首歌曲全部为 **48000 Hz / 16-bit / FLAC / blocksize 1024 samples**:
       - `灰色轨迹 - Beyond.flac`: `48000 Hz, s16, 2ch, blocksize 1024`
       - `钟无艳 - 谢安琪.flac`: `48000 Hz, s16, 2ch, blocksize 1024`
       - `喜帖街 - 谢安琪.flac`: `48000 Hz, s16, 2ch, blocksize 1024`
     - 正常播放的歌曲（如《不将就》）为 **44100 Hz / 16-bit / FLAC / blocksize 4096 samples**。
     - 文件本身校验：`flac -t` 全部显示 `ok`（100% 完整无破损）。
  2. **三大致命根因链条**:
     - **根因 1: MPD 配置 `format "44100:16:2"` 强制劣质重采样**:
       MPD 默认未配置 `resampler` 时回退至 `internal`（官方文档说明：“Its quality is very poor, but its CPU usage is low”）。当播放 48000 Hz 歌曲时，MPD 强制进行 48000 -> 44100 劣质重采样，不仅产生严重的高频折叠与相位失真，且输出块大小在 3696 字节与 3700 字节间不断非周期撕裂抖动，每隔数个包爆发一次高达 42ms 的网络传输骤停。
     - **根因 2: 前端 `pcmPlayer.ts` 写死 44100 且完全丢弃 WAV 真实采样率**:
       前端初始化写死 `new AudioContextClass({ sampleRate: 44100 })`，且 `createBuffer(2, frameCount, 44100)` 硬编码。解析 44 字节 WAV 头后未读取真实的 sampleRate 字段。
     - **根因 3: Linux PipeWire 硬件原生采样率 (48000 Hz) 的双重重采样冲击**:
       系统默认音频规格为 `float32le 2ch 48000Hz`（蓝牙耳机与板载声卡主流规格）。MPD 强制 48000 -> 44100，Electron 强制 44100，系统驱动再强制 44100 -> 48000，三重非整倍数重采样叠加上 42ms 的数据流微滞后，导致 WebAudio 缓冲区频频面临边缘欠载并爆发连续背景噼啪爆破音。
- **重构与治本方案**:
  1. **MPD 端配置透传与 SoX 黄金重采样器**:
     - 修改 `~/.config/mpd/mpd.conf`：将 `format "44100:16:2"` 改为 `format "*:16:2"`，原汁原味透传 44.1k / 48k 原声，从源头彻底消灭无谓重采样与数据块抖动（输出块稳定在 4096 字节均匀脉冲）；
     - 增加 `resampler { plugin "soxr" quality "very high" }`，万一遇到非常规音源需重采样时采用专业 64-bit SoX 算法，杜绝内置劣质 internal 算法。
  2. **前端 WebAudio 动态采样率感知与硬件自适应**:
     - `initAudioContext()` 移除写死 `sampleRate: 44100`，允许自动采纳系统底层音频硬件原生采样率（如 48000 Hz）；
     - `handleIncomingBytes` 从 44 字节 WAV 头部（bytes 24..27）动态提取 32-bit `streamSampleRate`；
     - `processPcmChunk` 动态使用 `audioCtx.createBuffer(2, frameCount, this.streamSampleRate)` 创建音频缓冲区，时长计算精准匹配；
     - 将缓冲区初始抗抖前瞻量充盈至 80ms，并支持 MPD 切歌/切流时 150ms 自动平滑重连。
- **实测验证数据 (CDP 硬件抓轨)**:
  - 《灰色轨迹》(48kHz): `detectedSampleRate: 48000`, `audioCtxSampleRate: 48000`, `underrunHits: 0`, `minLeadMs: 76ms`, `avgLeadMs: 87ms`；
  - 《喜帖街》(48kHz): `detectedSampleRate: 48000`, `audioCtxSampleRate: 48000`, `underrunHits: 0`, `minLeadMs: 76ms`, `avgLeadMs: 88ms`；
  - 《钟无艳》(48kHz): `detectedSampleRate: 48000`, `audioCtxSampleRate: 48000`, `underrunHits: 0`, `minLeadMs: 98ms`, `avgLeadMs: 110ms`；
  - 《不将就》(44.1kHz): `detectedSampleRate: 44100`, `audioCtxSampleRate: 48000`, `underrunHits: 0`, `minLeadMs: 78ms`, `avgLeadMs: 97ms`；
  - 寻道淡入淡出增益实测：`0 -> 0.31 -> 0.67 -> 1.0` 完美平滑过渡，全程背景爆破音彻底消散，声音通透纯净。

### 4.13 星盘歌词背景暗角硬边纵向色差分层定位与彻底消除 (2026-09-10)

- **症状**:
  用户截图反馈胶囊右侧区域存在明显垂直色差分层（一条突兀的竖直暗边切开背景）。
- **根因**:
  在 `src/renderer/src/components/LyricsOrbit.css` 中，`.lyrics-orbit-wrapper::before` 设置了 `left: 100px`。左侧悬浮胶囊收起态右边缘为 `72px`，在 `72px ~ 100px` 之间留出了 28px 宽度的未遮罩壁纸明亮间隙，而在 `x = 100px` 处暗色径向渐变（`rgba(8, 12, 20, 0.45)`）硬性截断切入，形成通顶到底的硬边分层。
- **解决方案**:
  将 `.lyrics-orbit-wrapper::before` 的 `left: 100px` 改为 `inset: 0`，使柔和径向渐变自视觉中心平滑扩散至视窗四周边缘（`transparent 85%`），彻底消除了局部矩形硬边切口，背景动态壁纸与星盘机芯浑然一体。

### 4.14 播放队列二态开关交互重构与状态同步防抖踩坑纪律 (2026-09-10)

1. **二态开关优于单向追加 + 重复提示**:
   - 单向添加按钮在歌曲已存在时弹出“已在队列” Toast 存在信息冗余与多余干扰；
   - 升级为 `+`（未在队列）/ `-`（已在队列）二态开关，不仅直观表达当前曲目与队列的关系，且自然杜绝了重复添加的入口，用户可以直接在曲库列表中自由增删队列。
2. **500ms 轮询与乐观 UI 闪烁防护 (Optimistic Locking & Sequence Guard)**:
   - 乐观更新虽然反应迅速，但如果在 500ms 轮询的周期内直接用异步收到的上一版本覆盖本地状态，会导致按键发生 100ms 的瞬间闪烁（如刚点击变 `-`，被旧广播打回 `+`，随后又变 `-`）；
   - **正解**: 引入 `syncSeqRef` 递增序列号，并在操作执行期间配置 `clickLockRef` 互斥保护，确保新状态不被旧请求覆盖，且防范用户快速连击引发的 MPD 竞态。
3. **按钮键盘激活防冒泡 (Keyboard Navigation Bubbling)**:
   - 当行元素容器（`.music-track-item`）绑定了点击/按键切歌播放事件时，右侧子按钮（`.music-track-add-btn`）仅处理 `onClick` 的 `stopPropagation` 是不够的；
   - 键盘通过 Tab 键聚焦到子按钮并按下 Enter / Space 时，原生 `<button>` 会先派发 `keydown` 事件，若未在按钮上阻止 `onKeyDown` 冒泡，事件会击穿至父容器触发整行点播切歌；
   - **正解**: 在子按钮上必须显式添加 `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}`。
4. **MPD 按文件移除队列曲目的安全阻断 (Pos 0 Guard)**:
   - 调用 `removeQueueItem(pos, queueId, file)` 时，若传入了 `file` 参数，在遍历队列尝试移除完毕后必须立即 `return found`；
   - 严禁在文件未命中时继续下泄执行默认的 `delete pos`，防止回退位置默认值 `0` 误删队列第 0 号无辜歌曲。

### 4.15 悬浮抽屉滚动条全局通配隐藏霸道抑制与特许放行纪律 (2026-09-10)

1. **子组件伪类规则被父级通配符压制**:
   - 在子组件的 CSS 中即便写了 `::-webkit-scrollbar { display: block !important; }`，滚动条依然不可见；
   - 根因：祖先容器 `SidebarCapsule.css` 中声明了 `.sidebar-capsule *::-webkit-scrollbar { display: none !important; }` 与 `.sidebar-capsule * { scrollbar-width: none !important; }`，由于通配符选择器带 `!important` 且挂在最外层祖先上，子组件局部的样式规则会被霸道覆盖。
2. **精准排除与特许放行模式 (Whitelist Approach)**:
   - 不能用一刀切的全局通配抑制，应将规则精准收敛为 `:not(.liquid-scrollbar)::-webkit-scrollbar` 与 `*:not(.liquid-scrollbar)`；
   - 这样未声明滑动条的视口（如父层容器、工具栏、导轨等）依然保持干净平整无原生粗灰条，而挂载了 `.liquid-scrollbar` 的核心歌曲列表区域则能完美展示定制的高质感液态玻璃微光滑动条。
3. **零抖动与防挤压间距 (Anti-Jitter Gutter)**:
   - 滚动容器严格配置 `overflow-x: hidden`，内部卡片固定为 380px，右侧预留 3px~8px 内边距；
   - 极细 5px 滑轨在鼠标悬停时平滑微扩至 6px，不引起内容横向重排或文字位移抖动。

### 4.16 设置界面双级钻取与配置持久化防抖防丢踩坑纪律 (2026-09-11)

1. **滑块高频触发与异步落盘防抖防并发 (Debounce Accumulation & Flush on Unmount)**:
   - 用户拖动高斯模糊或透明度滑块会产生密集的 input 事件，如果每次都发起 IPC 写入磁盘，会引发严重的文件 I/O 抖动；
   - **正解**: 本地 React state 立即更新保证 60fps 丝滑，变更累积至 `pendingUpdateRef`，通过 60ms 防抖定时器批量向主进程提交；
   - **关键防护 (卸载紧急冲刷)**: 用户快速调节滑块后立即关闭抽屉会导致组件卸载。在 `useEffect` 清理函数中必须检查 `pendingUpdateRef`，若有未落盘变更立即执行紧急保存，杜绝配置丢失。
2. **POSIX 原子文件替换防配置文件损坏 (Atomic Rename & .bak Backup)**:
   - 直接 `writeFileSync` 若遇断电或程序崩溃可能导致 `config.json` 成为空文件或残缺 JSON；
   - **正解**: 先将全量配置写入随机临时文件（`${configPath}.${pid}.${now}.${rand}.tmp`），再通过 `renameSync` 进行原子替换；替换前保留上一次的 `.bak` 备份。
3. **目录级文件监听与临时文件过滤 (Directory Watch & File Filtering)**:
   - Linux 下通过 `renameSync` 替换文件时，针对单个文件的 `watch` 可能在原 inode 被替换后失效；
   - **正解**: 监听父目录 `configDir`，并在回调中严格对比 `filename === configFileName`，过滤掉 `.tmp` 与 `.bak` 文件，防止触发循环监听与无意义的广播重载。
4. **二级详情键盘无障碍与退格误触拦截 (Keyboard Navigation Guard)**:
   - 用户在二级设置页按 Esc 或 Backspace 时，若未在详情层拦截，按键会冒泡至胶囊外层直接收起整个抽屉；
   - **正解**: 在二级详情层挂载全局捕获拦截（`capture: true`），非输入框聚焦时按 Esc / Backspace 优先回退至一级分类总览，再按 Esc 才收起抽屉。

### 4.17 原生窗框与沉浸式无边框模式热切换机制与顶部拖拽踩坑纪律 (2026-09-11)

1. **Electron 无法单实例动态切换 frame 的平台限制与无缝交接重构 (Window Reconstruction Pattern)**:
   - **症状**: 用户在偏好设置中切换“沉浸式无边框模式”开关后，配置文件虽已写入 `immersive: true`，但当前运行窗口的原生标题栏与边框纹丝不动；
   - **根因**: Electron 底层依赖 Chromium Views 与操作系统窗口管理器协议（Linux Wayland xdg_toplevel / X11 Motif Hints），`frame: false/true` 为窗口实例化时的不可变硬属性，Electron 未提供任何 `win.setFrame()` 接口；调用 `applyConfigToWindow` 仅在 DOM 上添加了 `data-window-immersive` 属性，无法移除操作系统绘制的外部窗框；
   - **解决方案**: 在主进程实现 `recreateWindow(oldWin, isImmersive)`：
     - 保留原窗口的物理坐标、尺寸（bounds）、最大化与全屏状态；
     - 创建带有相反 `frame` 配置的新 `BrowserWindow` 实例；
     - 在 `ready-to-show` 时同步原最大化状态并展示新窗口，随后安全销毁旧窗口；
     - 在 `CONFIG_UPDATE` 与配置目录 watcher 中检测 `prevImmersive !== nextImmersive`，一旦变化即触发无缝交接，视觉过渡自然平滑；
     - 设置 `isRecreatingWindow` 互斥保护标志，并拦截 `app.on('window-all-closed')`，防止旧窗口销毁时瞬间触发应用退出。
2. **无边框沉浸式窗口的移动拖拽热区 (Invisible Window Drag Strip)**:
   - **症状**: 原生窗框移除后，窗口失去了系统标题栏抓手，常规拖拽无法移动窗口；
   - **解决方案**:
     - 在 `.stage` 顶部挂载高度为 28px 的 `.window-drag-bar`；
     - 仅在 `[data-window-immersive='true']` 下激活显示，并赋予 CSS `-webkit-app-region: drag`；
     - 为 `.sidebar-capsule`、`.status-bar` 以及全局交互元素显式声明 `-webkit-app-region: no-drag`，杜绝拖拽事件污染控制栏。

### 4.18 偏好设置字体配置原子联动、CSS 特殊字符转义与输入防抖踩坑纪律 (2026-09-11)

1. **自由字体输入框在 CSSOM 与内联变量中的注入与安全转义**:
   - **症状**: 用户在自定义字体框输入带未闭合单双引号、多重空格或分号（如 `CustomFont; display: none`）时，若直接写入 CSS 变量，可能导致 CSSOM 解析中断甚至样式逃逸；
   - **根因**: 原生 `document.documentElement.style.setProperty()` 虽对大多数属性值做了弱校验，但对于 `font-family` 复合属性，非法字符会导致 Chromium 引擎直接丢弃该属性规则并回退至父级继承，使文字瞬间坍缩至浏览器底层默认衬线字；
   - **解决方案**: 在 `types/config.ts` 中实现 `sanitizeFontFamily`：
     - 剥离控制字符与 CSS 分号、花括号等字符；
     - 对包含空格的多词字体族名（如 `Playfair Display`）规范化包裹单引号；
     - 空字符串或纯空格直接回退至该维度的默认安全字体族。
2. **输入框编辑过程中的聚焦与失焦防丢体验**:
   - **症状**: 在输入框内修改字体名称时，若每敲一个字符就触发一次持久化并刷新 DOM，会导致输入焦点丢失或拼音输入法截断；若清空输入后直接失焦，又会导致保存空字体；
   - **解决方案**:
     - 输入框使用本地临时状态进行受控渲染，仅在用户按下 `Enter` 键或显式点击确认时才向全局提交生效；
     - 用户按下 `Escape` 键时撤销当前未保存的临时输入，恢复为正在生效的配置，并拦截冒泡防止意外触发抽屉返回；
     - 当输入框被清空并失焦（Blur）时，自动回退显示为当前已生效的有效字体名，杜绝留下空白无效占位符。

### 4.19 悬浮胶囊收起态按键全空消失与 Chromium 焦点横向滚动踩坑纪律 (2026-09-11)

1. **子面板获焦引发的父容器意外横向滚动 (Focus-Induced scrollLeft Displacement)**:
   - **症状**: 用户在使用抽屉内部输入框或特定操作收起胶囊后，左侧悬浮胶囊中的 6 大功能图标全部消失不见，胶囊只剩一个空黑的毛玻璃长圆框；
   - **根因**:
     - `.sidebar-capsule` 容器原声明为 `overflow: hidden; display: flex; flex-direction: row;`；在收起态下宽度仅为 `56px`，但内部包含了右侧 `404px` 宽度的子面板（总内容宽 `460px`）；
     - CSS 规范中 `overflow: hidden` **并不禁止**程序化、焦点导航或 `scrollIntoView` 驱动的滚动。当子面板内的输入框或按钮获取焦点时，Chromium 默认行为会将可滚动祖先的 `scrollLeft` 自动滚至该元素可见位置（实测 `scrollLeft` 被滚至 `374px`）；
     - 这一滚动导致原本停靠在左侧边缘（offset 0）的导轨 `.capsule-rail` 物理坐标被推至屏幕外 `x = -357px`，而收起态的子面板又处于 `opacity: 0`，最终呈现出全空胶囊黑框的严重视觉缺陷；
   - **彻底根治方案**:
     1. **启用现代 CSS `overflow: clip`**: 将 `.sidebar-capsule` 升级为 `overflow: hidden; overflow: clip;`。在 CSS Overflow Level 3 规范中，`clip` 严格禁止创建任何滚动容器，浏览器底层的 `scrollLeft` 被彻底锁定为 0，杜绝任何焦点引起的横向视口偏移；
     2. **收起态 `visibility: hidden` 隔离**: 为收起态 `.sidebar-capsule.collapsed .capsule-subpanel` 赋予 `visibility: hidden` 并配合 `320ms` 退出过渡延时，确保抽屉收起后彻底从键盘 Tab 链与 DOM 获焦树中摘除，防止隐藏状态下误聚焦；
     3. **React 状态保护守卫**: 在 `SidebarCapsule` 中添加 `onScroll` 强制归零拦截器，并在 `!isExpanded` 时主动检查并执行 `activeElement.blur()`，确保子面板焦点在抽屉关闭时平滑释放。实测导轨物理位置严格锁定在 `x = 17px`，图标居中定格 `x = 25.5px`，彻底杜绝位移隐患。

### 4.20 受控输入框基准值 ref 的渲染期写入违反并发渲染纪律 (2026-09-11)

1. **症状**: 字体输入框 (`FontPickerControl`) 的 Escape 回退基准 `initialFontRef` 原先在渲染期直接赋值 `currentFont`；当外部 prop 在空闲态被变更（如测试脚本直接调用 `onInputChange`、一键重置默认）后，渲染期赋值会冲掉编辑中的基准值，导致后续按下 Escape 时没有正确的 baseline 可回退；
2. **根因**: React 渲染期写入 ref 属于副作用（与并发渲染模式相悖），无法感知“用户是否正在编辑”这一动态状态；
3. **解决方案**: 改用 `useEffect([currentFont])` 在空闲态（`!isEditingRef.current`）同步基准，编辑会话的 baseline 由 `onFocus` 建立，渲染期不再写 ref；`pnpm typecheck` 0 报错、单测 10/10 通过（提交 `7641beb`）。

### 4.21 体检探针三坑: pgrep 自匹配、Chromium cmdline 改写与探针流量污染基线 (2026-09-11)

音频与性能深度体检中踩过的三个探针自身缺陷，复用探针时务必遵守：

1. **`pgrep -f` 自匹配**: 在 shell 探针里用 `pgrep -f "pattern | head -1"` 这类带管道的匹配串时，`pgrep -f` 会匹配到包裹命令自身的 `/bin/sh -c` 进程（模式串本身出现在其 cmdline 中），采到空壳进程得出 0% CPU 假象。根治：不用 `pgrep -f` 匹配应用，改扫 `/proc/*/exe` readlink 匹配真实二进制路径；
2. **Chromium setproctitle 改写 argv**: Electron 主进程的 `/proc/<pid>/cmdline` 中 NUL 分隔符被改写为空格，读出单串 `"electron ."`（argv 数组长度为 1），按 `split('\0')` 数参数个数的判定永远失效。根治：`replace(/\0/g, ' ')` 空格归一化后，用「无 `--type=` 参数」判定主进程（zygote/gpu/renderer/utility 全都带 `--type=`）；
3. **探针自身流量污染 CPU 基线**: 初测「播放 12.2% / 暂停 5.0%」实为探针 CDP `Runtime.evaluate` 200ms 高频轮询 + 串口日志自身开销；改为纯 `/proc/<pid>/stat` utime/stime 差分（无 CDP 参与采样窗）后，真值仅播放 2.8% / 暂停 1.0%。教训：**测量探针必须与被测数据通路隔离，CPU/延迟类基线必须在无探针轮询的静默窗内采样**；另 Node 24 原生 `WebSocket`（`addEventListener`，无 `.once()`）可零依赖直连 CDP，无需 ws 库。

### 4.22 封面双档缓存 renderer 零改动与「廉价路径」实测校正 (2026-09-11)

封面预压缩双档缓存落地中沉淀的三点经验：

1. **分档开关下沉到协议层实现 renderer 零改动**: renderer 里 ArtistDrawer/PlaylistDrawer 有 6 处直接构造 `app-media://cover/<file>`（不带 tier），最初以为要逐个组件补参数；改为协议层 `tier` 缺省即 thumb 后，所有既有 `<img>` 与 mpd.ts 生成的 coverUrl 一次性自动受益，覆盖面更大、改动面更小、不会漏。
2. **「原图补压缩略图是廉价路径」需实测校正**: 方案假设缩略图生成「廉价」，但对 5906×5906/1.8MB 的原图，缩略图实为完整解码 + 重编码（~100ms+），远超零拷贝剥离的「数十 ms」。实测 30 张并发迁移总耗时仅 475ms、主进程 CPU 6.8% 无尖峰 —— 因迁移仅首轮发生一次（此后命中 `.thumb.jpg` 缓存），且 ffmpeg 单图重编码足够快。若未来出现超大原图批量首迁 CPU 尖峰，可将缩略图生成也纳入并发队列（当前按方案约定不排队）。
3. **ffmpeg 单帧输出 stderr 告警非失败**: `-vf scale=...` 单图输出会向 stderr 打印 "does not contain an image sequence pattern"，但 exit 0 且文件正确写出；`execFile` 回调 `err` 仅由非零退出码触发，勿因 stderr 告警误判为提取失败。

---

## 5. 下一步开发计划 (Next Milestone)

- **M2-1 阶段: WebAudio FFT 蓝图频谱律动图层 (SpectrumVisualizer) [已完成]**:
  - 原生复用 `pcmPlayer.getAnalyserNode()`，零性能损耗提取 60fps 频域与时域特征；
  - 采用高级制表纯线条工程蓝图风，底栏正上方定格，自适应休眠与配置热重载完备。
- **M2-2 阶段: 悬浮胶囊抽屉体系完备 [已完成]**:
  - 展开宽度统一扩增至 460px，导轨锁定 56px 零抖动；
  - 第 1 项: 曲库中心 (`MusicLibraryList`)，二态开关 (+/-)、60fps 模糊检索；
  - 第 2 项: 播放队列 (`QueueDrawer`)，原生拖拽重排、单曲移除、一键清空、跳动均衡条、定位；
  - 第 3 项: 艺人分类 (`ArtistDrawer`)，双级钻取微画册流、圆形微棱头像、作品统计、二态开关；
  - 第 4 项: 歌单管理 (`PlaylistDrawer`)，双级钻取画册流、MPD 原生歌单协议全链路、创建/重命名/删除/添加/移出/播放/入队；
  - 第 5 项: 统计信息 (`StatisticsDrawer`)，单级展示（摘要卡 + playCount 降序排行），MPD sticker 计数 + stats.playtime 累计时长，主进程阈值状态机计数；
  - 第 6 项: 偏好设置 (`SettingsDrawer`)，双级钻取画册流、6大模块精细控件（包含外观/音频/频谱/MPD/关于，以及最新完备的“字体与字形”排印系统，支持 UI/提示/歌词正文/歌词翻译独立定制、CSS变量毫秒级热更与原子持久化）；
  - 全场景覆盖液态玻璃微光滑动条 (`.liquid-scrollbar`)。
- **性能专项: P1 阶段渲染隔离与视窗裁剪完备 [已完成]**:
  - `MechanicalGear`、`WallpaperLayer`、`SpectrumVisualizer`、`SidebarCapsule` 全量 `React.memo` 隔离；
  - `App.tsx` 状态心跳实施同曲引用稳定化，阻断下游组件链式失效；
  - `handlePlaySong` 与 `handleAddToQueue` 固化为 `useCallback`；
  - `ArtistDrawer.css` 补齐现代 GPU 视窗裁剪 `content-visibility: auto`。
- **性能专项: P2 阶段 MPD TCP 长连接与状态按需广播 [待开启]**:
  - MPD TCP Client 短连接改造为连接池 / Keep-Alive 复用套接字，消除每小时 7200 次握手开销；
  - 结合 MPD `idle` 事件机制实现按需推送。
- **M2-3 阶段: 主工作区居中液态玻璃面板 (`GlassPanel`) / 页面切换与黑胶大舞台 [待开启]**:
  - 舞台中央半透明液态玻璃容器，配合播放器各页面（当前播放大封面与黑胶旋转动效、歌单列表、全屏歌词面板、系统设置面板）的无缝平滑切换。

### 音频响应滞后与平滑过渡决策结论 (已完结)
- **方案 A**: 前端不干预 `<audio>`（已淘汰，残留 3.2s 滞后）；
- **方案 B**: MPD 本地硬件输出（已否决，前端拿不到流导致 M2-1 无法实现）；
- **方案 C**: 自建 `fetch` + WebAudio PCM 流式管道（**已于 2026-09-10 成功落地，3~4s 滞后彻底根除**）；
- **方案 C 增强**: 双级增益平滑淡出淡入 + 配置文件热重载（**已于 2026-09-10 成功落地**）；
- **方案 C 杂音根治**: 流世代独立 GainNode + 连续平铺无裂隙调度防线（**已于 2026-09-10 彻底消除杂音**）；
- **方案 C 动态采样率**: MPD 原生透传 + WebAudio 动态采样率感知自适应（**已于 2026-09-10 彻底消除 48kHz 曲目背景爆破音**）。



### 4.23 字号托底的「渲染值」验收纪律：声明值 ≠ 渲染值 (2026-09-11)

悬浮面板 12px 托底中沉淀的验收教训：

1. **grep 声明值只能算施工清单，不能算验收**: `font-size: 11px` 改完后 grep 零残留，但 `calc(var(--font-size-hint, 11px) - 2px)` 这类声明在变量注入前渲染值仅 9px，且变量默认值（hint=11）本身就是渲染链一环。验收必须以浏览器 **computed font-size 扫描**为准（TreeWalker 遍历真实文本宿主，跳过 `visibility:hidden`/收起态隔离节点）。
2. **e2e 断言会随设计基线漂移，需同步更新**: 重置默认值 hint `11→12` 后，Step 9 的 `hintSizeVar === '11px'` 与落盘 `fontSize === 11` 断言立即变红 —— 这是设计变更的正常连带，不是回归。改默认值时必须同步 grep 测试文件中的旧基线期望。
3. **首次全量扫描的「3 行夹行」是探针误报**: 首轮 CDP 探针报 3 行标题被夹（21px vs 行高 19px），但该探针在抽屉未展开（0 行）与虚拟化中途（索引越界）两种状态下都跑过；重载后在正确抽屉态重扫 436 行夹行=0。教训：探针必须先断言「行数符合预期」（如曲库 436 行），再谈行盒结论，否则就是在对空集合/错位索引做诊断。

### 4.24 分层映射三纪律：语义层 × 无残留 × 自证联动 (2026-09-11)

全文字受控改造中沉淀的施工纪律：

1. **按语义分层，不按原像素值分层**: 同是 12px，徽标/副行归 HINT（跟 hint 走），按钮/输入框归 HINT（跟 hint 走），卡片名/分组标题归 TITLE/MODAL（跟 ui 走）。原值只决定它是小字还是标题，不决定它跟哪个滑条。
2. **硬编码清零必须含 font-family 与简写/内联**: 光改 `font-size` 不够，同块缺 `font-family` 必须补 var 族；另须 grep `font:` 简写与 TSX 内联 `fontSize/fontFamily`（本次仅 SVG 装饰数字，不管）。否则字号联动了字形仍不受控。
3. **联动必须由设置页自身实测自证**: Step 12 直接拖动设置页内两根滑条，断言设置页自身三处 computed 同步放大且可恢复基线 —— 设置页自己就是联动的第一证人，不依赖跨抽屉展开状态。

### 4.25 整洁化删减四纪律：只删展示 × 计数保留 × 签名兼容 × 先断言行数 (2026-09-11)

UI 整洁化（去专辑名 + 删三级描述 + 删底部提示）中沉淀的施工纪律：

1. **只删展示拼接，不动数据与计数**: `歌手 - 专辑` 三元分支整段去掉，但搜索过滤 `s.album`、封面 `alt` 兜底、艺人分组 `albums` 统计、`N 首·N 张专辑` 文案全部保留 —— 专辑数据仍在内存，只是不渲染。`See-Saw` 这类艺人名内连字符不得误判为拼接残留，验收分隔符必须用严格模式 ` - `/` · `（带前后空格）。
2. **计数徽标与专辑名严格区分**: L1/Hero/工具栏的 `N 位/N 组/共 N 首/N 张专辑/时长` 属计数非专辑名，全部保留；本次 `albumSpans=0` + 严格分隔符零残留即达标，不追求文本字符级零 `专辑`（计数文案含“专辑”二字是正确的）。
3. **删渲染留签名**: `SettingsModuleMeta.desc` 字段与 `SliderControl/FontPickerControl` 的 `desc?` prop 只删渲染分支、保留类型签名，调用处 17 处传参暂留 —— 零类型涟漪，typecheck 一次通过；后续清理传参另开小会话，不在本轮扩大改动面。`desc` 置空后若 `noUnusedLocals` 报未使用变量（如 `hardwareSampleRate/mpdConnected`），先查他用再删，本次两者均有他用（kHz 直通读数/状态徽标），保留。
4. **探针先断言行数再谈结论（§4.23 纪律复用）**: 本轮复现两例 —— 按钮索引错位（btn1 实为队列非曲库，首轮误报 `rowCount=0`）与抽屉态未就绪（歌单 L2 需先点歌单卡，添加面板需先点“添加单曲”，直接扫 `pl=0` 是空集合误报）。教训：先打印按钮映射/行数基线（曲库 436/队列 10/艺人 L1 238/歌单 L2 10/添加面板 436），对齐后再谈 `sep=0` 结论。另：`queue-track-grip`（absolute 覆盖序号）与 `capsule-rail <> capsule-subpanel`（动静分离裁剪宿主）系已知预期重叠，非回归。

### 4.29 开关无响应双因：旧主进程 × saveConfig 回填 (2026-09-12)

用户报“点击开关没反应”，排查出两层原因：

1. **旧主进程吞键**：运行中 Electron（14:32）早于构建（15:01），`config.get` 返回 `lyrics keys=[body,translation]` 无 `showTranslation`；旧 `parseTypographyConfig` 把开关值丢掉再回写覆盖本地 state。修法只有重启（`pnpm start`，窗口按铁律经用户确认后 kill+重起）。注意 renderer 与 main 过期是两类问题：上次是 renderer 旧（`Page.reload` 即解），这次是 main 旧（必须重启）。
2. **`saveConfig` 回填污染**：`deepMerge(current, partial)` + `parseTypographyConfig` 用 DEFAULT 回填，导致未携带开关的普通写入（如探针 OFF→ON）也把 `showTranslation:true` 写盘。修法：`saveConfig` 覆写只认 partial 显式携带（`'showTranslation' in partial.lyrics`），未携带从 `currentTypo` 继承，缺省不写盘 —— 与 `parseTypographyConfig` 的读侧缺省回退对称。
3. **探针判据要认“零挂载”**：关闭走 `showTranslation &&` 短路，译文节点是 `count=0`（不是 `hidden=count`）；首版探针误判 FAIL。正确判据：OFF=`count=0 && persisted=false`，ON=`count=6 && persisted=true`。附带纪律：探针若写了用户 config，跑完必须 `cp` 备份恢复并 `diff` 自证零漂移。

### 4.28 歌词翻译显隐开关二纪律：严格布尔 × 重载后验 (2026-09-12)

歌词翻译开关（`typography.lyrics.showTranslation`，默认 true）中沉淀的验证纪律：

1. **开关解析只认严格布尔，非布尔一律回 true**：`'false'` 字符串、`0`、`null` 都不误关 —— 开关语义下误关比误开更伤（译文整站消失用户以为丢数据）。缺省回退不写盘，老用户无感升级。
2. **CDP 探针改了 CSS 必须先重载再断言**：本轮首跑 `S2 off-hidden` 失败（`hidden=0`），因探针连的是旧 renderer 包（构建产物已更新但页面未重载）；`Page.reload` 后 6/6 全隐、重开恢复，4/4 全绿。教训：任何涉及 CSS/产物变更的探针，`Page.reload` 是前置步骤不是可选项；且先断言 `base secondary count` 符合预期（本轮 6，另一首 10）再谈显隐结论（§4.23/§4.25 纪律复用）。

### 4.27 统计抽屉三纪律：库内 sticker × 纯函数转译单测 × 常驻主进程 (2026-09-11)

统计信息抽屉（MPD sticker 计数 + 主进程状态机）中沉淀的验证纪律：

1. **sticker set 只认库内 file，幽灵回退分支 e2e 不覆盖**: `sticker set song "__ghost__/x.flac"` 报 `ACK No such song`（set 要求 file 在库内），而 `find` 输出天然只含库内 file —— 残留回退（文件名 + `未知歌手`）是防脏数据兜底，e2e 用三首真歌（A=7/B=3/C=5 → 摘要 15/3 → 降序 7>5>3）覆盖主链路即可，不硬造库外 sticker。另：e2e 必须删三条测试 sticker 恢复零残留（`find` 尾 `OK` 即干净）。
2. **mpd.ts 纯函数单测走 esbuild 转译 + 双 stub**: `mpd.ts` 顶 `import { app } from 'electron'` 与无扩展名 `./config` 无法被原生 node ESM 直载；`scripts/build-playstats-test-stub.mjs` 将两处替换为桩（单测函数均为纯逻辑零运行时依赖）后 esbuild 转译落盘 `/tmp`，`test-playstats-unit.mjs` 导入产物。勿用 TS 7 Go 版 `typescript.transpileModule`（新拆包 `unstable/sync` 无转译导出）。
3. **改 src/main 必须重启 dev，e2e 前备份 config**: 本轮复现 §4.26 两纪律 —— 常驻主进程不随 `touch` 更新（改 `mpd.ts/index.ts` 后杀旧 PID 重起 `pnpm dev`，当心 9222 残留）；统计功能虽零配置键，仍按惯例开测前 `cp config.json /tmp`、全绿后 diff 零漂移再提交。

### 4.26 滚轮预览 e2e 三纪律：可信事件 × 常驻主进程 × 配置零漂移 (2026-09-11)

歌词滚轮预览+单击确认跳转中沉淀的验证纪律：

1. **React 合成 onWheel 只收可信事件，合成 dispatch 测不出**: `wrap.dispatchEvent(new WheelEvent(...))` 能触发原生 `addEventListener('wheel')` 探针，但到不了 React `onWheel`（isTrusted 门控）—— 合成事件断言 `moved=false` 是探针假阴性，不是功能回归。e2e 滚轮必须用 CDP `Input.dispatchMouseEvent {type:'mouseWheel'}` 可信滚轮；断言行索引用 `data-lyric-index` 真实下标，不用窗口内序号（滑动窗口起止随展示索引漂移）。
2. **dev 主进程常驻，改 src/main 后必须重启**: `touch src/main/config.ts` 不会刷新 `out/main/index.js`（electron-vite dev 的主进程包是启动时构建）；`config.get()` 持续返回旧解析结果时，先查出盘时间戳，重启 `pnpm dev` 解决。另注意重启后旧 Electron 可能因 9222 占用残留（`bind() failed/ Cannot start http server`），需按 PID 逐个杀旧进程再起新实例。
3. **e2e 会污染用户 config.json，断言前后必须比对恢复**: 设置滑条拖动/`config.update` 落盘都会把新键（如 `audio.lyricPreview`）写进 `~/.config/lpip-player/config.json`。开测前 `cp` 到 `/tmp/lpip-config-bak.json`，全绿后 diff，漂移键剔除恢复并复验 `CONFIG-UNCHANGED` 再提交 —— 缺省回退（1500）语义下，不写盘即是最干净的默认。
