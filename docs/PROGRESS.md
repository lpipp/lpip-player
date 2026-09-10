# lpip-player 开发进度记录 (Progress Log)

> 更新时间: 2026-09-10
> 当前阶段: M2-2 (悬浮长条胶囊展开抽屉宽度扩增至 460px，曲库与队列视觉空间全面舒展，红心功能收敛，零报错稳定常驻)
> 最新进展: 将悬浮胶囊展开抽屉向右侧扩大 100px（360px -> 460px），子面板宽度增至 404px，排版空间大幅提升（详见 §2.12）

---

## 1. 架构与环境核心快照

- **架构方案**: Model B（MPD 仅负责本地音频解码并推流至 `:8000` httpd，Electron 前端通过 `<audio>` 播放并预留 WebAudio AnalyserNode 频谱分析；播放控制走 MPD 6600 纯文本 TCP 协议，手写原生 Client）。
- **流编码 (2026-09-09 变更)**: httpd `encoder` 已由 `vorbis` 320k 改为 **`wave`（未压缩 PCM，44100:16:2，约 1.41 Mbps / 176 KB/s）**，备份见 `~/.config/mpd/mpd.conf.bak`。原因见 §4.8：同样字节数的服务端队列，PCM 只装 vorbis 约 1/4.4 的时长，是音频卡顿归零的关键因素之一；附带收益是不再对 FLAC 源做二次有损压缩，全程无损。localhost 传输对该码率毫无压力。
- **运行平台**: Arch Linux (Linux 6.x) + KDE Plasma 6 (Wayland) + AMD GPU。
- **技术栈**: Electron 44.2.0 + React 19.2.8 + TypeScript 7.0.2 + electron-vite 5.0.0 + Vite 7.3.6。
- **用户配置文件**: `~/.config/lpip-player/config.json`（支持全量 JSONC 单行/块级中文注释）。
- **当前常驻运行**: Electron 实例在桌面上持续运行中（PID 43684），实时响应配置、动态壁纸与控制交互。

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

---

## 5. 下一步开发计划 (Next Milestone)

- **M2-1 阶段: WebAudio FFT 蓝图频谱律动图层 (SpectrumVisualizer) [已完成]**:
  - 原生复用 `pcmPlayer.getAnalyserNode()`，零性能损耗提取 60fps 频域与时域特征；
  - 采用高级制表纯线条工程蓝图风，底栏正上方定格，自适应休眠与配置热重载完备。
- **M2-2 阶段: 悬浮胶囊第二按键“播放队列”管理 (`QueueDrawer`) 与曲库二态开关 (`Toggle Switch`) [已完成]**:
  - 悬浮胶囊第 2 个图标（播放队列）子菜单平滑展开收起，左侧导轨锁定 56px 零抖动；
  - 展示当前 MPD 实时播放队列（441+ 首巨量队列无感秒开，GPU 视窗裁剪）；
  - 正在播放翡翠绿高亮与封面动态微跳频谱条，支持一键精准定位视口；
  - 即时切歌、单曲移除、一键清空、原生 HTML5 拖拽重排与红心收藏闭环落地；
  - 曲库中心按键升级为二态开关（`+` 未在队列添加 / `-` 已在队列移出），实现全全局双向毫秒级实时响应式同步。
- **M2-3 阶段: 主工作区居中液态玻璃面板 (`GlassPanel`) / 页面切换与黑胶大舞台 [待开启]**:
  - 舞台中央半透明液态玻璃容器，配合播放器各页面（当前播放大封面与黑胶旋转动效、歌单列表、全屏歌词面板、系统设置面板）的无缝平滑切换。

### 音频响应滞后与平滑过渡决策结论 (已完结)
- **方案 A**: 前端不干预 `<audio>`（已淘汰，残留 3.2s 滞后）；
- **方案 B**: MPD 本地硬件输出（已否决，前端拿不到流导致 M2-1 无法实现）；
- **方案 C**: 自建 `fetch` + WebAudio PCM 流式管道（**已于 2026-09-10 成功落地，3~4s 滞后彻底根除**）；
- **方案 C 增强**: 双级增益平滑淡出淡入 + 配置文件热重载（**已于 2026-09-10 成功落地**）；
- **方案 C 杂音根治**: 流世代独立 GainNode + 连续平铺无裂隙调度防线（**已于 2026-09-10 彻底消除杂音**）；
- **方案 C 动态采样率**: MPD 原生透传 + WebAudio 动态采样率感知自适应（**已于 2026-09-10 彻底消除 48kHz 曲目背景爆破音**）。


