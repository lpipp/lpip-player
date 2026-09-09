# lpip-player 开发进度记录 (Progress Log)

> 更新时间: 2026-09-09
> 当前阶段: M0-2 (状态栏进度条、精密机械表机芯齿轮与往复摆轮游丝系统完整实现，准备推进下一步)

---

## 1. 架构与环境核心快照

- **架构方案**: Model B（MPD 仅负责本地音频解码并推流至 `:8000` httpd，Electron 前端通过 `<audio>` 播放并预留 WebAudio AnalyserNode 频谱分析；播放控制走 MPD 6600 纯文本 TCP 协议，手写原生 Client）。
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
      "width": 360,
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

---

## 5. 下一步开发计划 (Next Milestone)

- **主工作区居中液态玻璃面板 (`GlassPanel`) / 页面切换**:
  - 舞台中央半透明液态玻璃容器，配合播放器各页面（当前播放大封面与黑胶旋转动效、歌单列表、歌词面板、设置面板）的无缝切换；
- **状态栏辅助控制扩展**:
  - 音量控制弹出滑块、当前曲目信息展示（歌曲名、歌手、码率与音质徽标）；
- **M1 阶段**:
  - 手写 MPD 客户端（纯文本 TCP 6600 连接、状态机指令流交互、真实播放控制与曲库同步）。
