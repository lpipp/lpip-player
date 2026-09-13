# lpip-player 开发进度记录 (Progress Log)

> 更新时间: 2026-09-13
> 当前阶段: M2-2（界面交互与操控体验深度优化：当前播放歌曲信息移至状态栏封面右侧，播放控制紧随其后；背景漂浮几何多面体晶体彻底清除；歌词滚轮滑动反向滞后与动量积压 Bug 彻底根除；所有滑条两侧配备 - / + 物理微调按键；左侧星盘齿轮机芯与歌词轨道统一同心模块化并支持 XY 轴调节；底部状态栏音量调节控件与业务逻辑彻底移除；非交互数值读数去框转纯文字；歌词旁圆弧型同心进度条与底栏极简化）
> 最新进展: 构建 Arch Linux pacman 安装包并正式发布 GitHub Release v0.0.1（提交 d90d31e 与 Release 标签 v0.0.1）：编写原生 packaging/PKGBUILD 与 lpip-player.desktop，通过 makepkg 与 @electron/asar 将 Electron 44 独立运行时、app.asar、全阶 hicolor 图标序列与启动器无缝封装为标准 Arch Linux 安装包（lpip-player-0.0.1-1-x86_64.pkg.tar.zst，102.77MB）；通过 GitHub CLI (gh) 创建 v0.0.1 正式发布版本并挂载 pacman 附件包，支持用户一键 sudo pacman -U 安装运行，详见 §2.41 与 §4.47。

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

### 2.29 非交互读数去除图形框转纯文字 (Non-Interactive Readings Pure Text) - 2026-09-13 完成

> **结论先行：非交互读数与可点击徽标在视觉上彻底解耦，去除图形方框容器，以纯文本自然融入界面。** 用户提供 Klipper 截图明确圈出艺人分类抽屉右上角的 `238 位` 徽标，要求将无法交互的元素（如艺人数量、各类滑动条数值读数、统计信息播放次数等）去除外部图形框，改为纯文字元素。施工团队对四个核心非交互统计与读数类（`.artist-count-badge`、`.playlist-count-badge`、`.liquid-slider-value`、`.stats-count-badge`）进行了精准样式重构，剥离 `background`、`border` 与 `border-radius`，保留极细水平内边距 `0 2px` 与 `tabular-nums` 等宽特性。通过 CDP 9222 实机验证所有目标元素的 computed `borderTopWidth === '0px'`、`borderStyle === 'none'`、`backgroundColor === 'rgba(0, 0, 0, 0)'` 全量达标，界面视觉更显克制透气。

- **重构范围与样式精炼**:
  1. **艺人数量 (`.artist-count-badge`)**: 剥离原 `background: rgba(110, 231, 183, 0.1); border: 1px solid rgba(110, 231, 183, 0.2); border-radius: 10px; padding: 2px 7px;`，改为纯文字 `padding: 0 2px; color: rgba(110, 231, 183, 0.85);`；
  2. **歌单数量 (`.playlist-count-badge`)**: 同步去除背景与边框，改为纯文字 `padding: 0 2px; color: rgba(110, 231, 183, 0.85);`；
  3. **各类滑动条数值显示 (`.liquid-slider-value`)**: 剥离原 `background: rgba(110, 231, 183, 0.1); border: 1px solid rgba(110, 231, 183, 0.22); border-radius: 5px; padding: 1px 6px;`，改为纯文字 `padding: 0 2px; color: #6ee7b7;`；
  4. **统计信息播放次数 (`.stats-count-badge`)**: 剥离原边框与背景，改为纯文字 `padding: 0 2px; color: rgba(110, 231, 183, 0.85);`；
  5. **设置导航备用徽标 (`.settings-toolbar-badge`)**: 同步去框去底，保持规范一致。
- **等宽防抖与兼容性保证**:
  - 四处类名与 JSX 结构完全保留，确保测试选择器与外部自动化 100% 稳定；
  - 核心属性 `font-variant-numeric: tabular-nums` 全量保留，确保数值动态更新与滑条拖拽时字符宽度恒定，彻底避免父容器横向跳动与重排（Layout Shift）。
- **实机自动化验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 错误；
  - `pnpm build`：成功构建；
  - CDP 实机探测：
    - `artistBadge`: text `"238 位"`, `borderTopWidth: "0px"`, `borderStyle: "none"`, `backgroundColor: "rgba(0, 0, 0, 0)"`, `fontVariantNumeric: "tabular-nums"`;
    - `playlistBadge`: text `"1 组"`, `borderTopWidth: "0px"`, `borderStyle: "none"`, `backgroundColor: "rgba(0, 0, 0, 0)"`, `fontVariantNumeric: "tabular-nums"`;
    - `sliderValue`: text `"0px"`, `borderTopWidth: "0px"`, `borderStyle: "none"`, `backgroundColor: "rgba(0, 0, 0, 0)"`, `fontVariantNumeric: "tabular-nums"`;
    - `statsBadge`: text `"8 次"`, `borderTopWidth: "0px"`, `borderStyle: "none"`, `backgroundColor: "rgba(0, 0, 0, 0)"`, `fontVariantNumeric: "tabular-nums"`;
  - 桌面应用窗口持续保留在桌面上，呈现整洁通透的艺人抽屉界面供用户核验。

### 2.30 底部状态栏音量调节功能与 UI 彻底移除 (Volume Control & UI Removal) - 2026-09-13 完成

> **结论先行：剥离软件层重复音量控制，权利完全交还系统全局音频架构。** 用户明确要求“删除音量调节的功能和ui”。在现代 Linux/KDE Plasma 桌面环境（PipeWire/ALSA/WirePlumber）下，全局硬件音量快捷键、多媒体旋钮与系统托盘已提供权威的音量调控通道；且播放器底层 Model B / 方案 C 的 WebAudio 直驱架构追求最高保真度的原音透传（Bit-Perfect Passthrough），过多的播放器软件级音量调节容易引入不必要的数字衰减与界面杂质。施工团队将底部状态栏右侧的音量控制组与前端全链路音量业务逻辑彻底剥离，右侧扩展区仅保留歌曲元数据与播放模式切换，视觉极度空灵通透。

- **清理范围与代码重构**:
  1. **状态栏组件 (`StatusBar.tsx`)**:
     - 彻底删除 `VolumeMuteIcon`、`VolumeLowIcon`、`VolumeHighIcon` 三组 SVG 矢量图标组件；
     - 属性定义 `StatusBarProps` 与函数参数中彻底剔除 `volume`、`isMuted`、`onVolumeChange`、`onMuteToggle` 四项属性；
     - 清除 `isVolDragging`、`dragVolPercent`、`volThrottleRef`、`pendingVolRef`、`volTrackRef` 等全部滑动拖拽、16ms 节流与卸载清理定时器；
     - 清除 `calcVolPercentFromEvent` 与 `handleVolMouseDown` 事件处理函数；
     - JSX 结构中彻底删除 `.status-bar-volume-block`（含 `.status-bar-btn-volume` 与 `.status-bar-volume-slider` 轨道、滑块与填充层）。
  2. **样式重构 (`StatusBar.css`)**:
     - 右侧扩展区标题注释更新为 `(Track Meta + Mode Toggle)`；
     - 剥离 `.status-bar-btn-volume` 相关规则，`.status-bar-btn-mode` 独立维持 34px × 34px 规整几何网格；
     - 彻底删除 `.status-bar-volume-block`、`.status-bar-volume-slider`、`.status-bar-volume-rail`、`.status-bar-volume-fill`、`.status-bar-volume-thumb` 及其 hover、dragging 与浅色主题适配规则（净减少 100+ 行 CSS）。
  3. **应用根组件与业务逻辑 (`App.tsx`)**:
     - 彻底删除 `volume` 与 `isMuted` 本地状态，删除 `isVolDraggingRef` 引用防抖守卫；
     - `syncFromMpdStatus` 中清除对 `status.volume` 的检测、同步与 `pcmPlayer.setVolume(...)` 冗余触发；
     - 彻底删除 `handleVolumeChange`（包含 MPD `setvol` IPC 调用）与 `handleMuteToggle` 回调；
     - 状态栏调用处移除 `volume`、`isMuted`、`onVolumeChange`、`onMuteToggle` 传递；
     - `pcmPlayer` 全局常驻保持默认的 `currentVolume = 1.0`（unity gain 零数字衰减原生输出）。
- **实机自动化验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 错误；
  - `pnpm build`：成功构建；
  - CDP 实机探测：
    - `volumeBlock: false`、`volumeBtn: false`、`volumeSlider: false`、`volumeRail: false`、`volumeFill: false`、`volumeThumb: false`；
    - `modeBtn: true`、`metaBlock: true`；
    - 右侧扩展区子节点数量从 3 缩减为 **2**（`status-bar-meta-block` 与 `status-bar-btn-mode`）；
  - 桌面应用实机截图确认：底栏右侧空间大幅释放，与居中进度条、左侧封面播放组形成极佳的视觉留白与平衡。

### 2.31 左侧星盘机芯齿轮与歌词轨道统一同心模块化与 XY 轴设置调节 - 2026-09-13 完成

> **结论先行：左侧机械齿轮与极坐标歌词绝对同心绑定，以左侧边框为基准提供高帧率自由微调。** 用户提出“将左侧齿轮与歌词视为一个模块，并可以在设置中调节x轴和y轴，并将左侧边框视为基准，注意歌词需要与齿轮同圆心”。工程团队将分立的左侧 60 齿天文钟机芯与极坐标歌词轨道统一封装至 `.astrolabe-module-container` 刚性容器内，旋转中心与圆心绝对锁死在 `(cx=0, cy=320)`，切行跳齿保持 52px 黄金安全间距；水平 X 轴以左侧边框为基准（`left: var(--astrolabe-x, 0px)`），垂直 Y 轴以可用区域中轴线为基准（`top: calc(50% + var(--astrolabe-y, 0px)); transform: translateY(-50%)`）；设置抽屉的外观与排印双板块同步挂载 X 轴（-300~600px）与 Y 轴（-300~300px）滑动调节条与恢复默认基准操作；CDP 9222 实机全量验证同心度与位移一致性。

- **模块统一与几何同心锁定 (Concentric Rigid Binding)**:
  1. **背景层彻底解耦 (`.astrolabe-ambient-svg`)**:
     - 将漂浮多面体晶体层提取为全屏背景 SVG，不再附着于机芯局部坐标系，确保无论模块如何移动，背景环境呼吸感依然均匀铺满全视窗。
  2. **统一机芯与歌词刚体容器 (`.astrolabe-module-container`)**:
     - 尺寸锁定为固定物理像素 `720px × 640px`（`pointer-events: none; overflow: visible;`）；
     - 水平定位严格以左侧边框为基准：`left: var(--astrolabe-x, 0px)`；
     - 垂直定位以中轴线为基准居中微调：`top: calc(50% + var(--astrolabe-y, 0px)); transform: translateY(-50%)`；
     - 齿轮 SVG 锁定 `viewBox="0 0 720 640" width="720" height="640"`，旋转中心为 `(cx=0, cy=320)`；
     - 歌词轮盘 `.lyrics-orbit-wheel` 放置于同容器内，原点锁定在 `left: 0px; top: 320px`，以 `0 0`（即容器内的 `0, 320`）为旋转原点；
     - **同心验证结论**: 无论窗口如何缩放或 X/Y 轴在设置中如何调节，主表盘齿轮与歌词轮盘在像素级严格共轴同心，相对几何距离恒定为 0。
- **全链路类型定义与配置持久化**:
  1. **类型契约 (`src/types/config.ts`)**:
     - 增加 `AstrolabeConfig { x: number; y: number }` 与默认值 `DEFAULT_ASTROLABE_CONFIG = { x: 0, y: 0 }`；
     - 扩展 `WindowConfig` 挂载 `astrolabe: AstrolabeConfig`；
     - 实现 `parseAstrolabeConfig(raw)` 严格校验，边界钳位 `x: [-300, 600]`，`y: [-300, 300]`，阻断非法输入与 NaN。
  2. **主进程配置桥接 (`src/main/config.ts` & `src/main/index.ts`)**:
     - `loadConfig` 与 `saveConfig` 完整承载 `astrolabe` 的反序列化与互斥链安全持久化；
     - `applyConfigToWindow` 动态向 `:root` 注入 `--astrolabe-x` 与 `--astrolabe-y`，实现热更新零延迟生效。
  3. **渲染层与设置面板联动 (`SettingsDrawer.tsx` & `App.tsx`)**:
     - 在「外观与窗口」以及「字体与排印」两大核心模块各挂载「星盘机芯与歌词模块布局」卡片；
     - 提供「X 轴位置 (左侧边框基准)」与「Y 轴位置 (垂直中线微调)」两根滑动条，以及「恢复居中基准」重置按钮；
     - 滑动时直接同步 `document.documentElement.style.setProperty` 实现 60fps 零重绘延迟即时响应，并配合 50ms 累加防抖写入磁盘。
- **实机自动化测试 (CDP 9222 探针)**:
  - `pnpm typecheck`：0 错误；
  - `pnpm build`：成功构建；
  - CDP 9222 实机抓轨断言：
    - 初始基准态：`container = (0, 0)`, `gear = (0, 0)`, `wheel = (0, 320)`，`--astrolabe-x = 0px`, `--astrolabe-y = 0px`；
    - 动态偏移态（注入 `x=60, y=30`）：`container = (60, 30)`, `gear = (60, 30)`, `wheel = (60, 350)`，两者的旋转同心圆心（gear: `60+0, 30+320 = 60, 350` 与 wheel: `60, 350`）几何距离差值**严格为 0px**；
    - 重置态：点击恢复居中后，容器与齿轮瞬间重置回 `(0, 0)` 基准，歌词轮盘重置回 `(0, 320)`；
    - 设置抽屉交互：卡片与滑块渲染完整无报错，设置卡片在抽屉收起后界面干净无残留。

### 2.32 全量滑条两侧 - / + 物理微调按钮与长按连续步进支持 - 2026-09-13 完成

> **结论先行：彻底解决鼠标拖拽滑条难以精确微调的痛点。** 用户反馈“使用鼠标难以对滑条进行微调，在所有滑条两侧加上-、+按钮”。由于高分辨率显示屏与紧凑抽屉布局下，鼠标按像素拖拽 range 滑块往往难以精确落点在目标整数（如 14px、18px）或微密浮点（如 0.05、0.005）上。工程团队对全局通用的 `SliderControl` 组件进行了全面增强，在滑轨左右两侧分别无缝内嵌液态玻璃风格的 `-` 与 `+` 微调按键，支持单步微调与长按平滑步进，手感极其细腻精准。

- **组件架构与布局重构 (`SettingsDrawer.tsx`)**:
  1. **左右对称微调按键布局 (`.liquid-slider-row`)**:
     - 在 `.liquid-slider-block` 内部，将 `<input type="range">` 包装进 `.liquid-slider-row` flex 容器中，左右两侧分别置入 22px × 22px 圆角方块微调按钮（`.liquid-slider-step-btn.minus` 与 `.liquid-slider-step-btn.plus`）；
     - 中间 `<input type="range" className="liquid-slider-input">` 自动弹性撑满剩余横向空间（`flex: 1; min-width: 0;`），视觉比例极具秩序感。
  2. **高精度步进算法 (`stepSliderValue`)**:
     - 根据当前 `step` 与 `current` 的小数位数自动计算最大精度 `precision`，消除 JavaScript IEEE 754 浮点数加减可能引入的精度残留（如 `0.1 + 0.2 = 0.30000000000000004`）；
     - 无论是整数步长（`step=1`、`step=10`）还是高精度浮点步长（`step=0.05`、`step=0.01`、`step=0.005`），步进读数始终干净精准。
  3. **双态交互手感（单击微调 + 350ms/60ms 长按连续步进）**:
     - **鼠标单击**: 按下立即触发单次步进，立即更新对应状态并广播配置变更；
     - **长按平滑加速**: 按住 350ms 后自动以 60ms 间隔平滑连续步进；松开鼠标（`onMouseUp`）或移出按键区域（`onMouseLeave`）立即停表；
     - **边界自动熔断**: 当到达 `min` 或 `max` 极值时，对应按键自动呈现 disabled 状态（半透明、禁止点击指针），连续步进自动切断。
- **液态玻璃质感与样式规范 (`SettingsDrawer.css`)**:
  - 按键尺寸为精巧的 `22px × 22px`，带 `border-radius: 6px`，默认融入黑曜石背景；
  - Hover 态：激活 `#6ee7b7` 薄荷绿发光辉光（`box-shadow: 0 0 8px rgba(110, 231, 183, 0.25)`）与微放大效果（`transform: scale(1.05)`）；
  - Active 态：沉下微弹响应（`transform: scale(0.95)`）；
  - 无障碍设计：包含专属 `aria-label` 与 `tabIndex`，键盘 Space/Enter 可独立聚焦触发。
- **实机自动化验证 (CDP 9222)**:
  - 扫描「外观与窗口」全量 5 组滑条（高斯模糊、暗色遮罩、抽屉底色、X 轴位置、Y 轴位置），每组滑条的 `hasMinus` 与 `hasPlus` 严格为 `true`；
  - 整数步长测试（X 轴位置）：初始 0px → 单击 + 变为 1px（CSS 变量同步为 1px）→ 再次单击 + 变为 2px → 单击 - 减为 1px → 一键恢复居中恢复 0px；
  - 浮点步长测试（暗色遮罩不透明度，step=0.05）：初始 55% (0.55) → 单击 + 变为 60% (0.6) → 单击 - 恢复 55% (0.55)，读数与计算严格零误差；
  - 全量 11 项排印单元测试与构建全绿通过。

### 2.33 歌词旁圆弧型同心进度条与底栏极简化 (Curved Arc Progress Bar & Bottom Decoupling) - 2026-09-13 完成

> **结论先行：彻底摒弃传统底部横贯滑块，在星盘同心机芯体系内优雅构建极坐标圆弧进度条与纯文字时间显示。** 用户反馈“删除歌词旁边的弧形虚线，将其改为圆弧型进度条，在上方显示当前播放时间，下方显示结束时间，并删除原有进度条”。工程团队顺应极简制表工艺与动静分离架构，彻底移除了原 `r=360px` 的辅助虚线弧与微细刻度群，以星盘机芯同心圆点 `(cx=0, cy=320)` 为共心原点，在 `r=350px`、跨度 `-52° ~ +52°`（总行程 104°）的自然扇区内构建出优雅的圆弧型音频播放进度条，实现视觉与交互的全面飞跃。

- **同轴同心刚体架构 (`LyricsOrbit.tsx`)**:
  1. **旧弧线与刻度线清空**:
     - 彻底删除原 `r=360px` 的 `strokeDasharray="3 4"` 导轨虚线与 `orbit-ticks-group`（包含 `generateArcTicks` 与 `orbitTicks` 数组）；
  2. **圆弧进度条几何体系**:
     - 半径设定为 $r = 350\text{px}$，位于机芯最外圈 60 齿齿尖（$r=308\text{px}$）与歌词文本首字（$r=374\text{px}$）之间的 66px 宽裕安全空隙正中，与两端分别保持 42px 与 24px 的精密黄金空隙，通透不压抑；
     - 扇面跨度从上方 `-52°` 顺时针延伸至下方 `+52°`，总跨度 104°；
     - **底轨弧线 (`.astrolabe-progress-rail`)**: `fill: none; stroke: rgba(255, 255, 255, 0.15); stroke-width: 3.5px; stroke-linecap: round;`；
     - **已播进度高亮弧 (`.astrolabe-progress-fill`)**: 薄荷绿霓虹柔光 `stroke: #6ee7b7`，外带 `drop-shadow(0 0 6px rgba(110, 231, 183, 0.55))` 呼吸光晕；
     - **微晶游标滑珠 (`.astrolabe-progress-thumb`)**: 纯白高亮内珠（$r=5\text{px}$，悬停/拖拽微扩至 6.5px），薄荷绿双层微发光描边；
     - **隐形交互触控热区 (`.astrolabe-progress-hitarea`)**: 26px 宽透明扇弧（`stroke: rgba(0,0,0,0.001); pointer-events: stroke; cursor: pointer;`），极宽容的点击与拖拽寻道手感；
  3. **上方当前时间与下方结束时间纯文字展示**:
     - **上方当前时间 (`.astrolabe-progress-time-current`)**: 严格切线对齐圆弧顶端垂直中轴线（$x=215.5, y=28$），展示当前播放时间（`mm:ss`，薄荷绿高亮纯文字）；拖拽寻道期间实时展示滑动手感预览时间；
     - **下方结束时间 (`.astrolabe-progress-time-duration`)**: 严格切线对齐圆弧底端垂直中轴线（$x=215.5, y=620$），展示曲目总时长（`mm:ss`，半透明近白纯文字）；
     - 严格遵循 §7.11 纯文字设计原则，彻底杜绝任何外框或胶囊容器，等宽字体（`font-variant-numeric: tabular-nums`）排布，绝对零布局抖动。
  4. **极坐标拖拽寻道与防抖安全锁**:
     - 支持鼠标在圆弧热区任意位置单击直接跳转与拖拽连续平滑滑动；
     - 基于 `Math.atan2(dy, dx)` 精确逆算当前几何角度，在 `[-52°, +52°]` 范围内钳位映射为百分比，手感即时跟手；
     - 抬起鼠标时提交 `onSeek(targetTime)`，并施加 1200ms 的 `seekLockUntilRef` 保护期，阻断 MPD 轮询回灌导致的瞬时回弹。
  5. **刚体联动与 XY 轴自适应平移**:
     - 整个圆弧进度条连同顶底时间文字均驻留在 `.astrolabe-module-container` 内部；
     - 当用户在偏好设置中微调 `--astrolabe-x` 或 `--astrolabe-y` 时，机芯、歌词、圆弧进度条三者 100% 作为单一刚体整体同步平移，永不脱轨。

- **底栏进度条彻底移除与空间留白 (`StatusBar.tsx` & `StatusBar.css`)**:
  - 彻底移除原 `.status-bar-progress-section` DOM 节点及所有关联的直线滑轨、滑块手柄、时间文本；
  - 清理 StatusBar 内部已过时的进度计时器与拖拽状态；
  - 底栏布局自然收敛为：左侧极简封面与控制按键组（`[Cover + Prev + Play/Pause + Next]`），右侧歌曲元数据卡片与播放模式切换（`[Meta + Mode]`），中央区域完全通透留白，背景视频动态水波完全展现。

- **实机全量验证 (CDP 9222 & 自动化验证)**:
  - CDP 实机探测：`hasOldBar === false`，`hasArcGroup === true`，`hasRail === true`，`hasThumb === true`，`hasOldDashedTicks === false`；
  - 时间读数验证：顶部当前时间精确呈现 `00:18`，底部总时长精确呈现 `04:22`；
  - 极坐标寻道验证：向圆弧正中（$x=350, y=320$）分发模拟点击，音频精准寻道跳转至 50% 进度（$131\text{s} = 02:11$），顶部时间即时刷新为 `02:11`，MPD 状态流完美同频响应；
  - `pnpm typecheck` 与 `pnpm build` 0 错误通过。

### 2.34 歌词滚轮滑动反向滞后与动量积压 Bug 根治 - 2026-09-13 完成

> **结论先行：彻底根除歌词滚轮滑动中“积压动量债务”导致的方向反转失效与单向锁死 Bug。** 用户反馈“使用鼠标滚轮滑动歌词时有点bug,上划一段距离后无论使用上划还是下划都被视作为上划，而下划一段距离后也同理”。工程团队深入分析滚轮事件动力学与残量累加流水线，精准定位并根治了这一严重影响滚轮预览手感的核心缺陷。

- **缺陷深度根因分析**:
  1. **方向判定严重倒置**: 原代码采用 `const dir = wheelRemainderRef.current > 0 ? 1 : -1`。当用户单向连续滚动一段距离后，`wheelRemainderRef.current` 累积为庞大的绝对值（例如 $+500$ 或 $-600$）。当用户突然改变方向滚动时，新的相反事件 `e.deltaY` 只是微弱减少了这个数值（如从 $+500$ 变为 $+400$），由于符号仍为正，系统**依然被判定为原方向**！用户必须用力往反方向滚多次才能“还清历史债务”，造成极其严重的“反向仍沿旧方向走”假象；
  2. **离散滚轮刻度与连续触控板未作区分**: 桌面端物理鼠标滚轮的一格（notch）通常产生 $100\text{px}$ 或 $120\text{px}$ 的离散大 delta，原代码单次只扣除 $18\text{px}$，导致单次滚动产生高达 $82\text{px}$ 的多余残量，越滚积压越多；
  3. **触碰极值边界后动量悬挂**: 当滚动到达首行（$index=0$）或尾行（$index=N-1$）时，因 `next === base` 直接 `return`，未对残量做任何处理，用户在边界处的无意义推墙操作转变为巨额动量积压，随后反向滚动时产生极长的无响应死区；
  4. **缺乏停手自动归零回收**: 用户停手后，未消费完的残量永久残留在 ref 中，数分钟后再滚动依然受到历史残量干扰。

- **系统性重构方案 (`LyricsOrbit.tsx`)**:
  1. **物理事件权威裁定真实方向**:
     - 严格以当前物理事件自身符号 `const eventDir = e.deltaY > 0 ? 1 : -1` 裁定方向，绝不让累加残量的旧符号劫持当前意图；
  2. **转向保护 (Direction Reversal Guard)**:
     - 每次事件到达时，检测 `(eventDir > 0 && wheelRemainderRef.current < 0) || (eventDir < 0 && wheelRemainderRef.current > 0)`；
     - 一旦检测到用户反向滚动，**立即将异号残量彻底清零**（`wheelRemainderRef.current = 0`），反向响应毫无拖泥带水，零延迟即刻生效；
  3. **离散滚轮与触控板双模自适应**:
     - 离散物理滚轮（$|\text{rawDelta}| \ge 24\text{px}$）：单刻度精确步进一行，残量直接归零，杜绝任何残量积压；
     - 触控板平滑微滚动（$|\text{rawDelta}| < 24\text{px}$）：平滑累加，满 $24\text{px}$ 扣减并钳位至 $[-24, 24]$，防止超额发散；
  4. **极值边界即刻灭尽动量**:
     - 当 `next === base`（已在最前行或最后一行）时，立即执行 `wheelRemainderRef.current = 0` 并退出，杜绝“撞墙积压动量”；
  5. **150ms 停手自动复位与生命周期清理**:
     - 增设 `wheelResetTimerRef`，用户停止滚动 $150\text{ms}$ 后自动清空残量；
     - 组件卸载与 `clearPreview` 时彻底销毁定时器并清零。

- **实机全量自动化验收 (CDP 9222)**:
  - **测试场景 1（连续上划转下划）**: 连续上划 4 刻度后，首个下划刻度**即刻响应下移一行**（`afterFirstDown === afterUp + 1`，断言 SUCCESS）；
  - **测试场景 2（连续下划转上划）**: 连续下划 6 刻度后，首个上划刻度**即刻响应上移一行**（`afterFirstUpFromDown === afterManyDown - 1`，断言 SUCCESS）；
  - **测试场景 3（触底连续撞墙转上划）**: 触碰末行边界后连续下划 15 次，首个反向上划刻度**即刻响应退回倒数第二行**（`afterReverseFromBottom === atBottom - 1`，断言 SUCCESS，零动量积压）；
  - `pnpm typecheck` 与 `pnpm build` 0 错误通过。

### 2.35 背景漂浮几何多面体晶体彻底清除与纯净视觉重构 (Ambient Geometry Declutter) - 2026-09-13 完成

> **结论先行：彻底消除多余几何线条干扰，还动态壁纸与星盘机芯纯净通透。** 用户提供 Klipper 截图要求“删除背景中的这些图形”（圈出画面中散落漂浮的绿色微线框轴测微立方体、透视菱形与立体三角面）。工程团队深入审查渲染树，精确定位并彻底删除了 `LyricsOrbit.tsx` 中作为全屏背景装饰的 `.astrolabe-ambient-svg` 及其内部的 `.astrolabe-floating-crystals` 图形组；同步从 `LyricsOrbit.css` 中完全清除针对该图层的样式规则及持续占用 GPU 合成周期的 16s 无限循环动画 `@keyframes floatingCrystals`。实机全量验证表明背景干扰完全清零，CPU/GPU 开销进一步降低，壁纸通透度与制表机芯质感全面释放。

- **问题排查与元素定位**:
  - 用户提供的截图文件（`/home/lpipwei/.local/share/klipper/data/4f3ac38447522a6bd9b2a52256e559af37b9ae82/4f3ac38447522a6bd9b2a52256e559af37b9ae82`）圈出了屏幕背景中悬浮的淡绿色几何图形；
  - 经精确检索与视觉比对，该图形为早期版本中为营造“星空空灵感”添加的全屏 SVG 装饰层：
    1. 右上方透视菱形：`points="780,110 820,90 840,130 800,150"`（虚线线框）；
    2. 右中侧立体三角面：`points="860,380 920,350 890,440"`；
    3. 右下方轴测微立方体：`points="630,490 655,475 680,490 655,505"` 及 4 根垂直连接线；
  - 在后续引入动态水波壁纸（`HH-卡通-小xx.mp4`）与精密天文钟齿轮后，这些孤立的多面体线框反而成为了画面中的视觉杂质与干扰项。
- **施工范围与彻底净化**:
  1. **组件模板彻底清除 (`LyricsOrbit.tsx`)**:
     - 彻底删除 `<svg className="astrolabe-ambient-svg" viewBox="0 0 1100 640">...</svg>` 这一整块全屏背景 SVG DOM 节点；
     - 容器结构保持极简，直接容纳核心 `.astrolabe-module-container` 统一刚体模块；
  2. **样式与动效深度清理 (`LyricsOrbit.css`)**:
     - 彻底删除 `.astrolabe-ambient-svg` 绝对定位全屏样式规则；
     - 彻底删除 `.lyrics-orbit-wrapper.is-animated .astrolabe-floating-crystals` 动画调用；
     - 彻底删除 `@keyframes floatingCrystals` 关键帧定义，彻底切断 16s 无限往复变换动画，释放 GPU 合成线程资源；
     - 严格保留 `.lyrics-orbit-wrapper::before` 径向暗角微光伪元素，确保护眼暗场与歌词对比度不受任何影响。
- **实机自动化验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 错误通过；
  - `pnpm build`：成功构建产出（55 模块，JS 911.23 kB，CSS 163.19 kB）；
  - CDP 实机探测：
    - `ambientSvg`: **false**（已从 DOM 树彻底注销）；
    - `floatingCrystals`: **false**（已从 DOM 树彻底注销）；
    - `orbitWrapper`: **true**（歌词宿主容器稳固运行）；
    - `gearSvg`: **true**（星盘机芯主齿轮完好无损）；
  - 实机全屏截图比对：画面背景中的所有几何微立方体与三角线框完全消失，背景壁纸与齿轮机芯、圆弧进度条相得益彰，沉浸质感达标。

### 2.36 状态栏当前播放歌曲信息移至封面右侧与播放控制紧随排布 (Status Bar Cover-Adjacent Meta & Control Flow) - 2026-09-13 完成

> **结论先行：封面与歌曲元数据合璧归位，控制流紧凑成团，底栏通透留白更具秩序感。** 用户反馈“将当前播放歌曲的信息移到状态栏歌曲封面的旁边”。在早期的四段式布局中，歌曲封面位于最左侧，而歌名与歌手信息却被孤立放置在最右侧，两者相隔数百像素，视觉层级割裂；工程团队通过 `ask_question` 与用户对齐了紧随排布方案，将 `.status-bar-meta-block` 从右侧扩展区移至 `.status-bar-cover` 紧邻右侧（间距 14px），排版重构为左对齐（标题上浮、音质 SQ 徽标与艺人下沉）；播放控制组（`.status-bar-controls`）紧随歌曲信息右侧（间距 28px），形成 [封面 + 歌曲信息 + 播放控制] 浑然一体的左侧核心操作集群；右侧仅保留 34px 极简播放模式按键，中央留出超 700px 的宽阔通透空间，完美呼应动态壁纸与星盘歌词机芯。

- **组件结构重构 (`StatusBar.tsx`)**:
  - 将 `.status-bar-meta-block` 从 `.status-bar-right-section` 彻底剪切并前移至 `.status-bar-cover` 与 `.status-bar-controls` 之间；
  - 维持 DOM 的自明性与优雅契约：封面（56px） $\rightarrow$ 歌曲元信息 $\rightarrow$ 播放控制（上一曲/主按键/下一曲） $\rightarrow$ 留白 $\rightarrow$ 右侧扩展区（播放模式切换）；
  - 保留纯文字无框体设计、`tabular-nums` 等宽防抖特性，以及音质徽标规范（SQ/Hi-Res/HQ/STD 统一着色与圆角微光）。
- **样式流与对齐重塑 (`StatusBar.css`)**:
  1. **元数据卡片左对齐流**:
     - `.status-bar-meta-block`: `margin-left: 14px; text-align: left; max-width: 220px; min-width: 100px; flex-shrink: 1;`；
     - `.status-bar-meta-title`: `text-align: left;`（标题长文本平滑 ellipsis 截断）；
     - `.status-bar-meta-sub`: `justify-content: flex-start;`（音质徽标与歌手文字左对齐排布）；
  2. **播放控制按键组间距自适应**:
     - `.status-bar-controls`: `margin-left: 28px; flex-shrink: 0;`（与歌曲元数据卡片保持 28px 规整物理间距，杜绝视觉拥挤）；
  3. **右侧扩展区极简收敛**:
     - `.status-bar-right-section`: `margin-left: auto;`（通过 flex 自动外边距牢牢推至底栏最右侧，子节点纯净收敛至 1 个 `.status-bar-btn-mode`）。
- **实机自动化验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 错误通过；
  - `pnpm build`：成功构建产出（55 模块，JS 911.15 kB，CSS 163.42 kB）；
  - CDP 实机硬件空间坐标（BoundingClientRect）采样：
    - `status-bar-cover`: left: 16px, right: 72px, width: 56px, height: 56px（与悬浮胶囊 left 16px 绝对对齐）；
    - `status-bar-meta-block`: left: 86px, right: 186px, width: 100px, height: 36px, `textAlign: "left"`, `justifyContent: "flex-start"`；
    - `status-bar-controls`: left: 214px, right: 356px, width: 142px, height: 50px；
    - `status-bar-right-section`: left: 1144px, right: 1178px, width: 34px, height: 34px, `childrenCount: 1`；
    - 中央留白区间：`356px ~ 1144px`（净宽 788px），通透空灵；
  - 实机全屏截图比对：封面、歌名“孤独患者”、SQ 徽标、歌手“陈奕迅”、控制按键浑然一体，排版极为雅致平衡。

### 2.37 播放模式切换按键移至播放控制组右侧与底栏右侧彻底纯净留白 (Playback Mode Button Integration & Right Side Full Frost Void) - 2026-09-13 完成

> **结论先行：播放模式与播控集群浑然一体，底栏右侧彻底释放，通透美学达标。** 用户提出“将控制播放模式的按钮也移到右边”，经 `ask_question` 对齐确认其意图为将播放模式按钮紧随播放控制组右侧排布。此前重构将歌曲信息移至封面右侧后，右侧仅孤立悬挂着一枚 34px 的播放模式按钮，与主要交互区域相隔 800px，操作孤立且存在割裂感。施工团队将 `.status-bar-btn-mode` 从底栏右侧抽离，直接迁入 `.status-bar-controls` 控制组内，紧随下一曲按键右侧（间距 12px 标准弹性网格），形成 `[封面 (56px)] → (14px) → [歌曲信息] → (28px) → [上一曲 (34px)] → (12px) → [播放/暂停 (50px)] → (12px) → [下一曲 (34px)] → (12px) → [播放模式 (34px)]` 一气呵成的高内聚核心集群。底栏右侧扩展区（`.status-bar-right-section`）彻底物理注销，右侧产生整整 792px 连贯通透的高斯磨砂玻璃留白区，让底层动态水波壁纸与星盘机芯完全舒展呈现。

- **组件结构重构 (`StatusBar.tsx`)**:
  - 将 `<button className="status-bar-btn status-bar-btn-mode ...">` 从独立右侧扩展容器剪切移入 `<div className="status-bar-controls">`，直接位于下一曲按键（`status-bar-btn-next`）之后；
  - 彻底注销 `<div className="status-bar-right-section">` 容器，状态栏顶层直接子节点纯净收敛至 3 个（`.status-bar-cover`、`.status-bar-meta-block`、`.status-bar-controls`）；
  - 保留循环模式说明与 `title`、无障碍 `aria-label` 及所有点击切换逻辑。
- **样式流与空间组织 (`StatusBar.css`)**:
  - 彻底清理 `.status-bar-right-section` 冗余样式规则；
  - 将 `.status-bar-quality-badge` 与 `.status-bar-meta-artist` 规范内聚归入歌曲元数据卡片区域；
  - `.status-bar-btn-mode` 融入 `.status-bar-controls` 的 12px Flex gap 网格，保持 34px × 34px 标准按键几何，并在深浅双主题下维持微光边框与动态缩放手感。
- **实机自动化验收 (CDP 9222 硬件抓轨与 E2E 测试)**:
  - `pnpm typecheck`：0 错误通过；
  - `pnpm build`：成功构建产出（55 模块，JS 911.04 kB，CSS 163.30 kB）；
  - CDP 实机硬件空间坐标（BoundingClientRect）物理采样：
    - `statusBarChildrenCount`: **3**（仅封面、歌曲卡片、控制组）；
    - `controlsChildrenCount`: **4**（上一曲、播放/暂停、下一曲、播放模式）；
    - `status-bar-cover`: left: 16px, right: 72px (width: 56px)；
    - `status-bar-meta-block`: left: 86px, right: 186px (width: 100px)；
    - `status-bar-btn-prev`: left: 214px, right: 248px (width: 34px)；
    - `status-bar-btn-play`: left: 260px, right: 310px (width: 50px)；
    - `status-bar-btn-next`: left: 322px, right: 356px (width: 34px)；
    - `status-bar-btn-mode`: left: 368px, right: 402px (width: 34px)；
    - `status-bar-right-section`: **null**（零残余）；
    - 物理单调递增断言：`16px → 72px < 86px → 186px < 214px → 248px < 260px → 310px < 322px → 356px < 368px → 402px` 全绿；
    - 右侧纯净高斯磨砂留白宽度：**792px**（`402px ~ 1194px`）；
  - 异步轮播交互验证：点击模式按键触发 IPC 与 MPD 循环，`mode-single` → `mode-sequence` → `mode-shuffle` 循环状态切换毫秒级响应。

### 2.38 状态栏歌曲信息卡片 140px 宽度物理锁定与控制按键零位移防御 (140px Track Meta Width Locking & Zero-Displacement Transport Stability) - 2026-09-13 完成

> **结论先行：歌曲信息卡片尺寸恒定锁死，控制按键物理网格坚如磐石，切歌连击零脱靶。** 用户反馈“给当前播放信息中的歌曲名和艺人名设置一个最大显示长度，避免歌名太长导致控制按键移位”。经 `ask_question` 对齐确认，采用了锁定 140px 固定宽度的最佳实践方案。此前由于 `.status-bar-meta-block` 为弹性宽度（`min-width: 100px; max-width: 220px`），当播放两字短歌名与数十个字超长交响乐名称切换时，右侧紧随的播控按键组（上一曲/播放/下一曲/模式）会在水平方向产生高达 120px 的剧烈位移，严重破坏连续点击上一曲/下一曲的手感。工程团队将 `.status-bar-meta-block` 严格重构为 `width: 140px; min-width: 140px; max-width: 140px; flex-shrink: 0;`；内部歌名与艺人名文本在 `140px` 处平滑以省略号（`ellipsis`）截断；通过 CDP 9222 实机长文本注入实测，无论歌曲名有多长，播控组 `left` 坐标始终恒定在 `254px`，位移严格为 **0px**。

- **样式与盒模型加固 (`StatusBar.css`)**:
  - `.status-bar-meta-block`: 明确设定 `width: 140px; min-width: 140px; max-width: 140px; flex-shrink: 0; overflow: hidden;`，阻断任何文本挤占或收缩；
  - `.status-bar-meta-title`: 明确 `width: 100%; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`，超长歌名平滑优雅截断；
  - `.status-bar-meta-sub`: 明确 `width: 100%; max-width: 100%; overflow: hidden;`；
  - `.status-bar-quality-badge`: 赋予 `flex-shrink: 0;`，确保音质徽标（SQ/Hi-Res/HQ/STD）在任何极端长文本下绝不变形；
  - `.status-bar-meta-artist`: 配置 `min-width: 0; flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`，彻底修复 Flexbox 规范下子元素默认 `min-width: auto` 导致 `text-overflow: ellipsis` 失效的潜在顽疾。
- **实机自动化验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 错误通过；
  - `pnpm build`：成功构建产出（55 模块，JS 911.04 kB，CSS 163.51 kB）；
  - CDP 实机硬件空间坐标（BoundingClientRect）物理采样：
    - 短歌名状态（“Close Your Eyes” / “孤独患者”）：`meta.width = 140px`，`controls.left = 254px`；
    - 超长交响乐名称注入（“这是一个长达几十个字的大型管弦乐协奏曲特别加长纪念版第三乐章”，字符宽度 420px）：`meta.width = 140px`，`controls.left = 254px`；
    - 空间位移差值检验：`deltaMetaWidth = 0px`，`deltaControlsLeft = 0px`；
    - 文本截断检验：`titleScrollWidth (420px) > titleWidth (140px)`，`artistScrollWidth (390px) > artistWidth (109px)`，省略号正常生效无溢出。

### 2.39 音频频谱蓝图律动组件迁移内嵌至状态栏右侧留白插槽 (SpectrumVisualizer StatusBar Slot Integration) - 2026-09-13 完成

> **结论先行：频谱律动告别全屏浮动，内嵌底栏右侧留白，动态美学与功能分区完美协同。** 用户提出“将频谱效果移动到状态栏上”，经 `ask_question` 对齐确认，采纳“仅放置在状态栏右侧留白区域（从控制按键右侧至窗口最右端约 700px 宽，左侧按键区保持纯净无频谱）”的精准定位方案。此前 `SpectrumVisualizer` 作为全屏绝对定位图层悬浮于状态栏正上方（`bottom: 80px`），跨越窗口全宽，会穿过左侧星盘齿轮与歌词轨道；同时底栏右侧拥有连续 750px 的空灵留白空间未被充分利用。施工团队在 `StatusBar.tsx` 尾部扩展了专用的 `.status-bar-spectrum-slot` 弹性插槽，将 `SpectrumVisualizer` 封装收敛至状态栏组件树内；画布高度自适应钳位至 80px 状态栏网格；全局维持 `pointer-events: none` 与 Canvas 2D 零内存分配；左侧播控核心操作区（封面+曲目+播控+模式）保持绝对纯净，右侧高斯磨砂玻璃区域呈现富有制表工艺质感的翡翠绿蓝图声浪律动。

- **组件拓扑重构 (`App.tsx` & `StatusBar.tsx`)**:
  - 从 `App.tsx` 顶层注销 `<SpectrumVisualizer>` 独立绝对图层，将其配置项 `visualizerConfig={visualizerConfig}` 向下透传给 `<StatusBar>`；
  - 在 `StatusBar.tsx` 尾部挂载 `<div className="status-bar-spectrum-slot" aria-hidden="true"><SpectrumVisualizer isPlaying={isPlaying} config={visualizerConfig} /></div>`；
  - 维持 `StatusBarProps` 契约完整性，实现状态栏右侧动态能力的高内聚组件化封装。
- **盒模型与图层适配 (`StatusBar.css` & `SpectrumVisualizer.css`)**:
  - `.status-bar-spectrum-slot`: 声明 `flex: 1 1 auto; min-width: 0; height: 100%; position: relative; overflow: hidden; pointer-events: none; margin-left: 20px; display: flex; align-items: flex-end;`；
  - `.spectrum-visualizer-container`: 移除旧的 `bottom: var(--statusbar-height, 80px)`，重构为 `position: absolute; left: 0; right: 0; bottom: 0; width: 100%;`，自然贴合插槽底部；
  - `SpectrumVisualizer.tsx`: 将渲染高度通过 `Math.min(config?.height ?? 80, 80)` 防御性钳位，杜绝过大配置值导致画布底部基准标尺线（`baseY = height - 4`）被状态栏 80px 容器截断丢失。
- **实机自动化验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 错误通过；
  - `pnpm build`：成功构建产出（55 模块，JS 911.18 kB，CSS 163.88 kB）；
  - CDP 实机硬件空间坐标（BoundingClientRect）物理采样：
    - `statusBarChildren`: `['status-bar-cover', 'status-bar-meta-block', 'status-bar-controls', 'status-bar-spectrum-slot']`（层级树严格对齐）；
    - `status-bar-controls`: `left: 254px, right: 442px, width: 188px`（完全锁定）；
    - `status-bar-spectrum-slot`: `left: 462px, right: 1148px, width: 686px, height: 80px`（与播控组右边缘保持 20px 间距，横跨右侧留白）；
    - `spectrum-visualizer-container`: `left: 462px, right: 1148px, top: 752px, bottom: 812px, width: 686px, height: 60px`（底部与底栏下边缘严丝合缝）；
    - 事件穿透检验：`slot.pointerEvents = 'none'`, `viz.pointerEvents = 'none'`, `canvas.pointerEvents = 'none'` 全绿，播控按钮交互零阻碍。

### 2.40 官方软件图标设计与跨平台全阶应用资产工程落地 (Official Application Icon Design & Multi-Platform Assets) - 2026-09-13 完成

> **结论先行：定制高级制表与液态玻璃美学图标，全阶尺寸构建，打通原生窗口与 Web 渲染容器。** 针对用户“绘制一个软件图标”指令，基于项目“黑曜石舞台 × 液态玻璃 × 高级制表机芯 × 翡翠绿声浪”视觉基因生成两套高精度图标方案（方案 A：星盘陀飞轮机芯 × 声浪黑胶唱片；方案 B：极简液态玻璃播放棱镜 × 表盘同心光环）。经 `ask_question` 对齐，用户确认采纳**方案 B**。施工团队进一步生成纯净资产母版，依托超椭圆连续边缘检测算法与透明度羽化抗锯齿，在 `resources/` 生成 16px 至 1024px 全规格 PNG 及 Windows 多分辨率 `.ico` 资产包；在 Electron 主进程 `BrowserWindow` 中配置原生窗口图标，在 `src/renderer/public` 与 `index.html` 中挂载应用级 favicon 与 apple-touch-icon；实机 CDP 抓轨验证资源链接加载无误。

- **图标设计与艺术提案 (`app_icon_proposals.md`)**:
  - 核心意象：中央高折射率液态玻璃播放三角棱镜、外围霓虹翡翠绿同心声浪律动光环、精密腕表 12 小时（12/3/6/9）刻度与圆润黑曜石 Squircle 边框；
  - 既传承了古典制表与黑胶唱片的同心旋转美学，又在小尺寸（16px~64px）下具备极高的几何剪影辨识度。
- **资产工程构建 (`resources/` & `src/renderer/public/`)**:
  - 母版提纯与透明通道合成：通过边缘种子泛洪与动态色度隔离剔除外部背景，保留圆角玻璃倒角与高光漫射；
  - 全尺寸产出：构建 `resources/icon-1024.png`、`resources/icon-512.png`、`resources/icon-256.png`、`resources/icon-128.png`、`resources/icon-64.png`、`resources/icon-48.png`、`resources/icon-32.png`、`resources/icon-16.png`；
  - 标准图标：根目录 `resources/icon.png` (512x512) 与 `resources/icon.ico`（内嵌 256/128/64/48/32/16 多分辨率）；
  - Web/渲染端资源：同步部署至 `src/renderer/public/icon.png` 与 `favicon.ico`。
- **应用链路集成 (`src/main/index.ts` & `src/renderer/index.html`)**:
  - `src/main/index.ts`: 新增 `getAppIconPath()` 模块，在 `createWindow` 与 `recreateWindow` 中注入 `icon: getAppIconPath()`，确保原生窗框模式与 Linux Wayland/X11 任务栏、窗口管理器以及 Alt+Tab 切换卡片正确加载软件图标；
  - `src/renderer/index.html`: 头部配置 `<link rel="icon" type="image/png" href="/icon.png" />` 与 `<link rel="apple-touch-icon" href="/icon.png" />`。
- **实机自动化验收 (CDP 9222 硬件抓轨)**:
  - `pnpm typecheck`：0 错误通过；
  - `pnpm build`：成功构建，静态资源与 chunks 完整无缺；
  - CDP 9222 真实运行时采样：`Page.reload` 后 `document.querySelector("link[rel='icon']").href` 严格解析为 `file:///.../out/renderer/icon.png`。

### 2.41 Arch Linux pacman 软件包构建与 GitHub Release v0.0.1 正式发布 (Arch Linux pacman Packaging & GitHub Release v0.0.1) - 2026-09-13 完成

> **结论先行：独立自包含架构，打通 Arch 原生包管理，v0.0.1 正式版全网发布。** 响应用户“再编译一个pacman包并发布”指令，构建了符合 Arch Linux 规范的原生打包体系与 Release 发布链路。通过 `packaging/PKGBUILD`、`packaging/lpip-player.desktop` 与 `@electron/asar`，将应用全栈（Electron 运行时、asar 压缩包、可执行启动器、全分辨率 `hicolor` 图标序列）组装打包为 `lpip-player-0.0.1-1-x86_64.pkg.tar.zst`（102.77 MB，zstd 压缩）。通过 GitHub CLI (`gh release create`) 成功创建 `v0.0.1` 初始正式版并将安装包挂载至 GitHub Release 资产库，实现用户通过 `sudo pacman -U` 即可一键完成系统级安装与菜单启动。

- **Arch Linux 原生规范打包体系 (`packaging/`)**:
  - `packaging/lpip-player.desktop`: 配置 XDG 桌面项（Name, GenericName, Comment, Exec, Icon, StartupWMClass, Categories: AudioVideo;Audio;Player;Music;）；
  - `packaging/PKGBUILD`: 声明 `pkgname=lpip-player`, `pkgver=0.0.1`, `pkgrel=1`, `arch=('x86_64')`, `license=('MIT')`, `depends=('gtk3' 'nss' 'alsa-lib')`；
  - 运行时自包含（Self-contained）：将 Electron 44 二进制及其动态链接库注入 `/usr/lib/lpip-player/`，摆脱系统 Electron 版本冲突；
  - 核心资产 asar 化：使用 `@electron/asar` 将 `out/`（编译后代码）、`resources/`（图标资源）以及 `package.json` 极速压缩至 `resources/app.asar`（仅 3.0MB）；
  - 全分辨率图标注入：覆盖 `/usr/share/icons/hicolor/{16,32,48,64,128,256,512,1024}x.../apps/lpip-player.png` 与 `/usr/share/pixmaps/lpip-player.png`。
- **打包执行与完整性校验**:
  - 运行 `makepkg -f` 完成环境检查、fakeroot 组装、元数据生成（`.PKGINFO`, `.BUILDINFO`, `.MTREE`）与 zstd 压缩；
  - `pacman -Qlp` 深度验轨：确认可执行启动器、动态库、pak 语言包、asar 资源与桌面快捷方式无一遗漏。
- **GitHub Release 发布**:
  - 标签版本：`v0.0.1`（Release 标题：`v0.0.1 - 初始发布版 (Initial Release)`）；
  - 发布链接：`https://github.com/lpipp/lpip-player/releases/tag/v0.0.1`；
  - 挂载附件：`lpip-player-0.0.1-1-x86_64.pkg.tar.zst`（SHA256 校验和自动生成，大小 102.77 MiB）。

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

### 4.47 跨平台桌面客户端自包含打包与发行版包管理工程纪律：独立运行时隔离 × 完整桌面规范 × 单一指令发布闭环 (2026-09-13)

在为 Linux 构建 pacman 安装包并实现 GitHub Release 发布中沉淀的工程纪律：

1. **运行时独立隔离与免依赖破坏原则（Self-Contained Runtime Isolation）**:
   - 依赖系统级全局 `electron` 包经常面临版本裂解（如发行版更新导致 Node ABI 不兼容、V8 特性差异、VA-API 硬件解码标志失效）；
   - 纪律：为发行版打包桌面客户端时，优先采纳独立自包含（Self-contained）模式，将经过严格验证的 Electron 运行时同捆封装至 `/usr/lib/<pkgname>/`；使安装包具备“开箱即用、系统升级零损毁”的工业级可靠性。
2. **Linux 桌面规范的严谨完整性（Desktop Integration Specification）**:
   - 很多自制安装包往往遗漏了图标或窗口类配置，导致在 GNOME/KDE 启动器中显示为通用齿轮图标，或在 Wayland 下无法关联任务栏图标；
   - 纪律：桌面应用包必须包含：
     1. 完整的多阶 `hicolor` 图标体系（覆盖 16px 至 1024px）；
     2. 规范的 `.desktop` 文件，且其 `StartupWMClass` 必须与 Electron `BrowserWindow` 的应用名严格一致；
     3. `/usr/bin/` 独立启动脚本，保证在终端直接输入程序名即可唤起。
3. **大文件产物隔离与源码仓库纯净性（Binary Artifact Exclusion）**:
   - 编译出的安装包（如 `*.pkg.tar.zst` 动辄上百兆），如果误被 Git 暂存追踪，将永久污染 `.git` 历史造成仓库体积膨胀；
   - 纪律：在执行打包之前，必须首先将 `*.pkg.tar.zst`、`packaging/pkg/`、`packaging/src/` 加入 `.gitignore`；源码仓库只管理构建脚本（`PKGBUILD`, `.desktop`），二进制分发完全交由 GitHub Release 资产库承载。

### 4.46 应用软件图标设计与全阶跨平台工程集成纪律：核心语义聚焦 × 小尺寸辨识度 × 全栈资源闭环 (2026-09-13)

在为播放器定制官方应用图标与打通全链路集成中沉淀的工程纪律：

1. **核心语义聚焦与小尺寸辨识度（Scalability & Silhouette Rule）**:
   - 许多华丽的 3D 渲染图在 1024px 下非常震撼，但一旦缩放到系统 Dock、任务栏托盘或文件管理器（16px / 32px / 48px），过多的细小齿轮或文字会瞬间沦为模糊的视觉噪点；
   - 纪律：优秀的桌面应用图标必须兼顾“大尺寸下的材质质感”与“微小尺寸下的几何轮廓”；中心清晰的三角播放棱镜与同心同轴声浪光环，赋予了图标在极小尺寸下依然一眼即知的特征辨识度。
2. **纯净资产与透明通道遮罩工程（Clean Alpha & Squircle Edge Isolation）**:
   - AI 生成的图标常常伴随微弱的桌面背景或底色渐变，绝不能直接作为透明图层的应用图标使用；
   - 纪律：必须通过边缘追踪与背景剔除提取精确的 Squircle（超椭圆）边缘，并在外围建立干净平滑的 Alpha 遮罩；绝不把未经提纯的矩形黑框图片直接当作 App Icon。
3. **主进程窗口与 Web 渲染容器的双重配置闭环**:
   - 在 Electron 生态中，应用图标存在两个独立的消费端：
     1. OS 宿主端（任务栏、窗口标题栏、Dock、窗口切换器）：依赖 `BrowserWindow({ icon })`；
     2. Web 渲染端（DevTools 标签、页面 favicon、缓存清单）：依赖 `index.html` 的 `<link rel="icon">`；
   - 纪律：添加图标资产时，必须同时在主进程与前端 HTML/public 中完成双重注册，避免出现“任务栏有图标但窗口网页无图标”或反向缺失的半成品状态。

### 4.45 动态频谱可视化容器从全局绝对浮动向组件化槽位收敛工程纪律：组件内聚性 × 弹性留白插槽 × 标尺基准防截断钳位 (2026-09-13)

在将音频频谱蓝图律动层从顶层悬浮迁移内嵌至状态栏右侧留白插槽中沉淀的工程纪律：

1. **从悬浮孤立图层向组件化插槽收敛（Component Cohesion & Slot Architecture）**:
   - 过去 `SpectrumVisualizer` 作为 `App.tsx` 顶层绝对定位图层悬浮于底栏上方（`bottom: 80px`），贯穿全屏 1200px 宽度。这种全局绝对浮动不仅打碎了 UI 组件树的职责边界，还会让波形横跨左侧星盘机芯与歌词轨道，导致视觉噪音与元素冲突；
   - 状态栏右侧存在约 700px 的纯净留白区域，天然适合作为声学律动的展示舞台；
   - 纪律：通过在 `StatusBar.tsx` 中开辟专门的弹性插槽（`.status-bar-spectrum-slot`），将可视化组件收敛为状态栏的一个内聚子部件；状态栏对外只接收 `visualizerConfig`，对内自主管理其布局与渲染，消除了父级容器中无谓的全局绝对悬浮图层。
2. **弹性插槽与自适应留白空间（Flex Elasticity & min-width Zero Defense）**:
   - 状态栏内部采用 Flexbox 布局。左侧封面、信息块和控制组均为刚性尺寸（`flex-shrink: 0`），而频谱插槽被赋予 `flex: 1 1 auto; min-width: 0;`；
   - 这种声明让插槽能够自动吞吐占满窗口剩余的所有水平物理空间（在 1200px 窗口下约为 686px），无论窗口如何缩放，频谱波形都能自适应延展与收缩，绝不挤压左侧交互按键；
   - 插槽设置 `overflow: hidden; pointer-events: none;`，既确保频谱渲染绝对不会溢出底栏破坏外部界面，又保障了底层背景壁纸与界面操作的绝对通透。
3. **坐标系基准标尺防截断钳位（Datum Baseline Clipping Defense）**:
   - 许多可视化组件在绘制时依赖公式计算基准线，如 `baseY = height - 4`；
   - 当可视化组件原本设计为 160px 或更高，一旦放入具有 `overflow: hidden` 的 80px 高度容器内，若不调整内部高度参数，计算出的 `baseY = 156px` 会直接跌落到容器可见范围（80px）之外，导致底部基准线与低频波谷全部被截断消失，造成“空白画布”假象；
   - 纪律：内嵌至固定高度槽位时，必须在组件内部对绘制高度进行硬性防御钳位（`const effectiveHeight = Math.min(config?.height ?? 80, 80)`），确保画布坐标系的原点与基准线始终落在父容器可视区域的有效几何范围内。

### 4.44 交互控制区网格绝对锁定与零位移防御工程纪律：点击目标稳定 × 弹性与刚性边界 × Flexbox 文本截断加固 (2026-09-13)

在锁定状态栏歌曲信息卡片宽度与杜绝播放控制按键位移中沉淀的工程纪律：

1. **点击目标的绝对稳定性（Fitts's Law & Spatial Stability）**:
   - 在高频交互控件（如上一曲、播放/暂停、下一曲）前面放置动态文本内容时，如果文本容器采用弹性宽度（`min-width ~ max-width`），每一次切歌都会导致后续所有按钮发生不可预期的像素偏移；
   - 费茨法则（Fitts's Law）与肌肉记忆：用户快速连击“下一曲”寻找心仪曲目时，鼠标通常停留在固定物理坐标；若按钮因前序歌名变长而右移数十像素，用户的下一次点击就会瞬间点空或误触其他按钮；
   - 纪律：所有前置于高频交互按键的动态文本容器，其外部网格必须具备刚性宽度（`width: 140px; min-width: 140px; max-width: 140px; flex-shrink: 0;`），确保交互按键的物理坐标永远绝对锁死（0px 位移）。
2. **Flexbox 内部文本截断防御（Flex Item Min-Width Zero Rule）**:
   - CSS Flexbox 规范中，flex 子元素的默认 `min-width` 为 `auto`，而非 `0`；
   - 当在 flex item 上设置 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` 时，若未显式指定 `min-width: 0`，该子元素在某些浏览环境下仍会计算其内容的 intrinsic width，导致卡片被长文本撑爆或截断失效；
   - 纪律：任何处于 Flexbox 容器内的可截断文本元素（如 `.status-bar-meta-artist`），必须显式声明 `min-width: 0;`，并给固定宽度容器赋予 `overflow: hidden`，形成绝对密封的防御性截断边界。
3. **固定宽度与信息密度的黄金折中**:
   - 140px 宽度在 13.5px 字体下可完整容纳 10 个中文字符或 18~20 个英文字符，覆盖了绝大部分华语流行音乐和常规单曲的完整标题；
   - 对于超长标题与联合艺人，依靠平滑的省略号截断（Tooltip 可查看全称），既保障了视觉界面的整洁度，又赋予了核心播控按键绝对静止的操作手感。

### 4.43 播放控制流向聚合与极简底栏通透工程纪律：操作集群一气呵成 × 消除孤立碎片 × 纯净留白呼吸感 (2026-09-13)

在重构播放模式切换按键并完全净化底栏右侧区域中沉淀的工程纪律：

1. **核心控制流向的天然聚合（Action Cohesion & Eliminating Island Controls）**:
   - 在底栏设计中，切歌、播放、暂停与播放模式（列表/随机/单曲）属于用户在听歌时的“连贯性心智模型”（Continuous Mental Model）；
   - 将播放模式按键单独孤立在 1200px 屏幕的最右侧不仅让用户的鼠标跨越整个屏幕大幅度移动，而且在视觉上形成了一个悬空的“孤岛按键”（Island Control），打破了界面的凝聚力；
   - 纪律：同一控制域（Control Domain）的按钮应聚合在一起，以 `[封面] → [信息] → [播放核心] → [播放辅助]` 的单向逻辑流排布，拒绝无谓的碎片化分布。
2. **底栏彻底留白与视觉呼吸感（The Power of Unbroken Glass Void）**:
   - 当右侧孤岛按键被移走后，底部磨砂玻璃栏右侧产生了从 402px 到 1194px（接近 800px）的连续无打扰视觉区域；
   - 这种连续性让底部的高斯漫射磨砂玻璃与背景中的动态水波壁纸无缝融为一体，消除了零碎按键对壁纸动态流光的切割与遮挡；
   - 纪律：不要为了“两端对齐”而强行在右侧摆放元素，极简的留白本身就是顶级的设计语言。
3. **微弹性间距与按钮层级秩序**:
   - 播控组内上一曲、播放、下一曲属于播放行进（Transport Controls），模式切换属于播放策略（Playback Strategy）；
   - 在统一放入 `.status-bar-controls` 后，保持统一的 12px Flex gap 网格，所有按键均继承统一的 34px/50px 物理几何尺寸与交互反馈动画，保证键盘与触控体验完全一致。

### 4.42 状态栏元数据与控制流排布工程纪律：视线天然汇聚 × 左对齐信息层叠 × 宽裕留白通透 (2026-09-13)

在重塑底部状态栏当前播放歌曲信息与控制流布局中沉淀的工程纪律：

1. **视线汇聚与封面元数据亲缘性（Proximity & Visual Affinity）**:
   - 传统设计中常犯将封面放在最左、歌名放在最右的“天各一方”错误，导致用户扫视封面时无法立即获知当前歌名，视线被迫在窗口两侧来回跳跃；
   - 亲缘性法则（Law of Proximity）：封面与歌曲信息（歌名、音质徽标、歌手）构成不可分割的“曲目身份单元”（Track Identity Unit），二者物理间距应紧密控制在 12px~16px 之间；
   - 纪律：封面卡片右侧第一顺位必须是歌曲元数据卡片，绝不将其他异构按键插入封面与标题之间。
2. **左对齐信息层叠与文字截断优雅防御**:
   - 当元数据位于右侧时，习惯使用 `text-align: right` 与 `justify-content: flex-end`；移至左侧后，必须彻底重构为自然的左对齐信息流；
   - 标题与副文本（音质徽标 + 歌手）必须各自配置 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`，并设定合理的 `max-width`（如 220px~240px）；
   - 纪律：绝不让超长歌名或超长歌手名挤占或推移右侧紧随的播放控制按键，保障控制按键的物理点击网格稳定。
3. **控制按键与元数据集群的黄金分隔与留白**:
   - 播放控制组（`status-bar-controls`）紧随在歌曲信息右侧时，应保持 24px~30px 的明确功能段落间距（本次设定为 28px），形成清晰的认知边界；
   - 留白是最高级的视觉空气：状态栏右侧通过 `margin-left: auto` 仅保留 1 枚播放模式切换键，中央保留超 700px 的纯净留白，既让界面通透舒展，又让底层的动态水波视频壁纸完全绽放。

### 4.41 背景环境装饰与内容呈现主次关系纪律：克制减法 × 零残发动效 × GPU 周期释放 (2026-09-13)

在彻底清除背景漂浮几何多面体晶体图层中沉淀的设计与工程纪律：

1. **背景环境装饰与前景主视觉的主次冲突**:
   - 界面视觉必须保持清晰的层级秩序（Hierarchy）：动态壁纸（底层氛围）→ 星盘精密机芯与圆弧进度条（制表工艺核心）→ 极坐标歌词（主内容交互）；
   - 孤立的抽象几何线框（如透视菱形、轴测微立方体）如果在主视觉与背景之间悬浮，不仅无法提供语义价值，反而会在动态水波壁纸或深色背景中形成“死角小斑点”或“屏幕脏污感”，严重干扰用户的视觉焦点；
   - 纪律：背景层遵循极致的克制减法，非功能性的孤立微装饰线框应坚决剔除，将舞台纯粹让渡给动态壁纸与核心机芯。
2. **切断无意义无限循环 CSS 动画以释放 GPU 周期**:
   - `animation: floatingCrystals 16s ease-in-out infinite alternate` 属于全屏持续运行的无限关键帧动画；
   - 即使图层处于 `pointer-events: none` 且透明度较低，Chromium 渲染引擎也会持续为其分配合成图层（Composited Layer）并在每个 VSync 节拍计算矩阵变换与触发局部重绘；
   - 纪律：删除无用视觉元素时必须连同其绑定的 `@keyframes` 规则一并物理铲除，决不能只隐藏 DOM 而在 CSS 中保留持续消耗 GPU 的幽灵动画。
3. **功能性暗角与伪装饰性线框严格隔离**:
   - `.lyrics-orbit-wrapper::before`（暗角微光伪元素）属于基础光学保障层（保证亮色/花哨壁纸下白色与薄荷绿歌词具备足够的 WCAG 可读对比度）；
   - 清理背景时必须严格区分“光学功能图层”与“伪装饰图形”，前者坚决保留，后者彻底铲除，实现安全精准演进。

### 4.40 滚轮交互动力学与动量积压工程纪律：真实事件裁向 × 转向即刻清零 × 离散与连续解耦 × 边界灭尽动量 (2026-09-13)

在歌词滚轮滑动反向滞后与动量积压修复中沉淀的核心工程纪律：

1. **真实事件裁决方向，严禁由历史残量主导方向**:
   - 累积残量（accumulator / remainder）的设计初衷是为触控板（trackpad）的微小像素步进提供积分平滑，它**只能作为触发阈值的能量计，绝不能作为运动方向的裁决者**；
   - 运动方向必须 100% 忠实于当前滚轮物理事件自身（`e.deltaY > 0 ? 1 : -1`）；无论历史上积压了多少正向能量，当用户发出负向事件时，其方向意图必须被视为负向。
2. **转向保护与历史动量即刻灭尽**:
   - 用户反向转动滚轮或手指往回滑动时，意味着上一阶段的运动意图已终止，新的相反运动意图已开始；
   - 纪律：任何异向输入事件到达时，必须第一优先级无条件清零相反方向的所有累积残量，决不能让用户去“偿还历史动量债务”。
3. **物理滚轮（离散大刻度）与触控板（连续微行程）必须解耦**:
   - 传统物理鼠标滚轮的一格通常产生 $100\text{px}$ 或 $120\text{px}$ 的巨大 delta；
   - 若对这种离散大刻度依然按触控板小步进（如 $18\text{px}$）逐次扣除，单次滚动就会遗留高达 $80\text{px}+$ 的巨额债务；
   - 纪律：当单次 delta 超过步进阈值时，直接判定为离散滚轮刻度，走一行且残量直接归零；仅当单次 delta 小于阈值时才进入触控板微行程累加池。
4. **到达物理极值边界必须即时清零**:
   - 当列表已滚动到第 0 行或最后一行时，进一步同向滚动的操作在物理世界中已经“撞墙”；
   - 撞墙时继续积累动量会导致用户回头时必须先“把撞墙积攒的假动量滚完”才能产生位移；
   - 纪律：一旦判定 `next === base`，必须立即清零残量，绝不储存撞墙动量。

### 4.39 极坐标同心圆弧进度条工程纪律：极坐标逆算钳位 × 隐形触控热区 × 刚体同轴约束 (2026-09-13)

在歌词星盘圆弧型进度条构建与底栏解耦中沉淀的工程纪律：

1. **极坐标逆算与全象限角度安全钳位**:
   - 当用户在 SVG 画布上按压或拖拽鼠标时，坐标差 `dx = mouseX - cx`, `dy = mouseY - cy`；
   - 使用 `Math.atan2(dy, dx) * 180 / Math.PI` 逆算角度；
   - 纪律：必须显式实施 `Math.max(startDeg, Math.min(endDeg, angleDeg))` 钳位。由于圆心在左边缘 `cx=0`，在 `[-52°, +52°]` 之外的左侧区域拖拽时，上方自然归入 0%（曲目开头），下方自然归入 100%（曲目结尾），手感平滑无任何角度突跳。
2. **SVG 路径交互的透明热区防线**:
   - 细线条（3.5px）在鼠标交互中极难点中；
   - 若将 hitarea 设为 `stroke="transparent"`，某些浏览器内核会判定为不参与拾取；若设为 `stroke="none"` 则完全失去 stroke hit test；
   - 纪律：采用 `stroke="rgba(0, 0, 0, 0.001)"` 配合 `strokeWidth="26px"` 与 `pointerEvents="stroke"`，既在视觉上 100% 不可见，又在 DOM 交互层提供高达 26px 的宽容触控带。
3. **刚体容器同轴约束（Concentric Rigid Body）**:
   - 进度条必须直接挂载在 `.astrolabe-module-container` 的 SVG 内，严禁在外部包裹分立的 absolute 容器；
   - 确保当用户在偏好设置中通过 `--astrolabe-x` 和 `--astrolabe-y` 调节机芯位置时，机芯齿轮、同心圆弧进度条、上下时间指示、极坐标歌词轮盘作为不可分割的单一刚体协同平移。

### 4.38 原生滑轨两侧微调按键工程纪律：通用组件下沉 × 浮点精度保护 × 长按节拍生命周期 (2026-09-13)

在为全量滑条添加 `-` / `+` 微调按键中沉淀的工程纪律：

1. **通用控件单一信源下沉（Single Source of Truth）**:
   - 播放器中全量 16 处滑条（涵盖机芯布局、排印字号、云母材质、壁纸遮罩、过渡延迟、频谱参数等）均统一下沉收敛于 `SliderControl`；
   - 严禁在各个业务面板重复写独立的微调按钮逻辑；只需在 `SliderControl` 内部对齐交互与视觉规范，全应用所有现在与未来的滑条均自动受益，架构零分叉。
2. **浮点步进的精度防护机制**:
   - 很多滑条具有小数步长（如 `step=0.05` 或 `step=0.005`），使用原生算术加减会导致无意义的末位浮点抖动；
   - 纪律：必须通过 `stepStr.split('.')[1].length` 动态感知步长精度，执行 `toFixed(precision)` 净化后再转为 `Number`，杜绝任何精度毛刺污染配置文件。
3. **长按步进与鼠标事件的无死角回收**:
   - 长按定时器不仅需要在 `onMouseUp` 中注销，更必须在 `onMouseLeave`、组件 `useEffect` 卸载钩子以及到达边界条件时一并注销；
   - 彻底防止用户按住鼠标拖出按钮范围后定时器悬空死循环。

### 4.37 齿轮歌词模块化同心与 XY 轴微调三纪律：统一容器同轴 × 避免 inline 属性覆盖 :root × 动态重构双通道 (2026-09-13)

在齿轮机芯与歌词轨道统一模块化以及设置调节中沉淀的工程纪律：

1. **统一容器同轴锁定，严禁分立计算**:
   - 齿轮与歌词轨道若分立在不同容器内各自根据 window 计算百分比，在窗口缩放与拖拽时极易产生亚像素舍入偏差导致的脱节；
   - 将二者合并在固定物理网格的 `.astrolabe-module-container` 内部，坐标原点统一锁定在 `(0, 320)`，所有位移与旋转天然共轴，彻底断绝几何脱靶。
2. **全局 CSS 变量分发切忌在子元素以 inline style 隐式覆盖**:
   - 当在设置面板滑动滑块需要 60fps 高性能响应时，操作 `document.documentElement.style.setProperty('--astrolabe-x', ...)` 依赖 CSS 变量继承；
   - 若子容器自身声明了 `style={{ '--astrolabe-x': ... }}` 内联样式，将导致 `:root` 变量被内联规则阻断遮蔽（Shadowing）；
   - 纪律：内联属性仅在必要时作为局部兜底，常规场景应让容器自然透传继承 `:root`，React 仅在配置初始挂载与受控同步时维护全局变量。
3. **主进程变更需协同构建，热更新与持久化闭环**:
   - 当在 `src/types/config.ts` 与 `src/main/config.ts` 新增顶层或子配置项时，主进程编译产物 `out/main/index.js` 必须在 preview/dev 启动时装载；
   - 同时在 `saveConfig` 中明确声明字段合并规则，避免主进程在 IPC `config:update` 阶段将新配置键作为未知属性丢弃。

### 4.36 桌面端系统级全局音量权责与播放器音量控件断舍离纪律 (2026-09-13)

1. **操作系统全局音频与播放器软件音量的权责冲突**:
   - 在现代桌面环境（尤其是 Linux/KDE Plasma 结合 PipeWire/ALSA）中，用户早已习惯使用键盘多媒体键、鼠标滚轮、外置 DAC 硬件物理旋钮或系统托盘托底控制全局音量；
   - 播放器内置的软件音量往往会引发双重缩放混乱（例如“系统开 100% 播放器开 30%”导致的信噪比与动态范围损失）；
   - 纪律：当用户明确要求剥离播放器端音量调节时，果断断舍离，不强求播放器层面的多余冗余控件。
2. **WebAudio 直通与零数字衰减原生输出 (Unity Gain)**:
   - 剥离播放器音量控制后，`pcmPlayer` 内部 `currentVolume` 锁定恒定为 `1.0`（0 dB 无损增益）；
   - 使得 MPD 解码的 16bit 44.1k/48k WAV PCM 数据通过 WebAudio 直送到硬件输出，彻底杜绝软件浮点运算乘法带来的舍入误差或动态压缩，实现最高纯净度的音频原声输出。
3. **底栏视觉平衡与右侧留白美学**:
   - 状态栏总高度固定 80px，居中为进度条与两端时间；
   - 移除音量滑动条与静音按钮后，右侧仅保留曲目元数据与 34px 圆角矩形播放模式键，彻底消除了右侧由于滑条宽度（72px）与间距产生的局部拥挤感，令整条状态栏的呼吸感与轻盈质感大幅提升。

### 4.35 非交互读数去框转纯文字三纪律：去框留文 × 等宽防抖 × 兼容保类 (2026-09-13)

1. **非交互读数不应套用操作型 Chip/Badge 容器**:
   - 带有背景填充与发光边框的圆角框体在现代 GUI 设计中具有强烈的“可点击/可筛选”意符（Affordance）；
   - 将数量（如 `238 位`、`1 组`）、滑动条当前数值（如 `40%`、`150ms`）以及播放次数（如 `8 次`）等纯信息展示套在图形框内，容易误导用户尝试点击，同时在视觉上增加了无意义的矩形色块与高频线条分割，破坏界面的通透性；
   - 纪律：纯读数统一去除 `background`、`border` 与 `border-radius`，保留微小的左右内边距（`0 2px`），以轻量文字形态融入标题或滑块对齐线中。
2. **等宽数字（tabular-nums）为防抖铁律**:
   - 纯文字化后，数字字形的物理宽度对布局的敏感度更高（尤其是变动频繁的滑动条数值与实时播放次数）；
   - 若缺失 `tabular-nums`，当数字由 `1` 变为 `8` 时字符宽度增加，会导致滑条右侧容器或右对齐行盒产生左右微跳（Layout Shift）；
   - 纪律：所有数值型展示类必须严格声明 `font-variant-numeric: tabular-nums`，确保等宽排版、零跳动。
3. **保留类名与 DOM 结构的重构安全原则**:
   - 在将 Badge 类转为纯文字时，直接在 CSS 中重写属性，严禁在 JSX 中擅自重命名或删除 span 节点；
   - 确保外部 e2e 探针、自动化测试与主题变量继承体系无缝平移，实现零破坏式演进。

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
