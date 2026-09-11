# lpip-player

本地音乐播放器 — Electron(出声) + React + 手写 MPD 客户端，液态玻璃 UI。

## 文档导航

- **`docs/ENVIRONMENT.md`** — 环境与配置快照（新会话免检手册：版本锁定、MPD 后端、实测行为）
- **`docs/STYLE.md`** — 开发风格约束与分会话工作流
- **`docs/SESSION_PROMPT.md`** — 新会话开场提示词（复制粘贴即用）

## 配置文件

- **运行时配置**：`~/.config/lpip-player/config.json`（XDG 约定，应用真正读取的位置）
- **模板**：`config.example.json`（随项目版本化，同步 schema）
- **格式支持**：全面支持 **JSONC**（可自由添加 `//` 单行中文注释与 `/* */` 块级中文注释）

字段说明：

| 键 | 默认值 | 说明 |
|---|---|---|
| `window.immersive` | `false` | 沉浸式效果开关：`false` 为常规系统边框，`true` 为无边框沉浸式窗口 |
| `window.theme.mode` | `'dark'` | 主题模式：`dark`（深色黑曜石）/ `light`（浅色白玉霜雪） |
| `window.theme.brightness` | `0` | 明暗度微调偏移量（`-0.2` ~ `+0.2`） |
| `window.theme.contrast` | `1.0` | 对比度微调系数（`0.8` ~ `1.2`） |
| `window.background.mode` | `'default'` | 窗口背景模式：`default`（纯净黑曜石）/ `mica`（云母晶体）/ `wallpaper`（动静态壁纸） |
| `window.background.wallpaper.path` | `''` | 壁纸绝对路径或以 `~` 开头路径，支持图片与视频格式（`.mp4`, `.webm` 等） |
| `window.background.wallpaper.overlayOpacity`| `0.5` | 暗色遮罩层不透明度（`0.0` ~ `1.0`，压低壁纸亮度保真视频与文字对比） |
| `window.background.wallpaper.blur` | `0` | 壁纸高斯模糊半径（px，`0` ~ `50`） |
| `window.background.wallpaper.fit` | `'cover'` | 缩放填充模式：`cover` / `contain` / `fill` |
| `window.sidebar.enabled` | `true` | 左侧悬浮长条胶囊抽屉总开关 |
| `window.sidebar.opacity` | `0.78` | 悬浮胶囊与抽屉背景不透明度（`0.0` ~ `1.0`，实测推荐 `0.3` 通透质感） |
| `window.sidebar.width` | `360` | 抽屉展开后的总宽度（px） |
| `window.sidebar.verticalExtension` | `50` | 抽屉展开时上下各延伸的像素幅度（px） |
| `window.sidebar.closeBuffer` | `40` | 鼠标离开抽屉触发收起的安全距离（px） |
| `window.sidebar.closeDelay` | `300` | 移出安全距离后的收起倒计时时长（ms） |
| `audio.fade.enabled` | `true` | 切歌与歌词跳转时的平滑淡出淡入总开关（`true` / `false`） |
| `audio.fade.duration` | `120` | 淡出淡入过渡时长（ms，推荐 `80` ~ `200`，范围 `20` ~ `1000`） |
| `visualizer.enabled` | `true` | 音频频谱可视化律动总开关（`false` 时彻底停止 RAF 渲染循环并隐藏画布） |
| `visualizer.height` | `160` | 频谱画布高度（px，范围 `40` ~ `600`） |
| `visualizer.opacity` | `0.85` | 频谱画布整体不透明度（`0.0` ~ `1.0`） |
| `visualizer.style` | `'blueprint'` | 频谱渲染风格：`'blueprint'`（高级制表纯线条蓝图工程风+散点微光）/ `'wave'`（正弦工程波形包络）/ `'bars'`（精密刻度柱状频段） |
| `mpd.host` / `mpd.port` | `127.0.0.1` / `6600` | MPD 纯文本 TCP 控制协议地址（原生 Client 零依赖） |
| `mpd.streamPort` | `8000` | MPD httpd wave/PCM 音频流端口（WebAudio 零拷贝直接拉流） |
| `typography.ui.fontFamily` | `system-ui, ...` | UI 界面通用字体族（主工作区、抽屉导航、曲库列表等） |
| `typography.ui.fontSize` | `13` | UI 界面基准字号（px，范围 11~20，默认 13） |
| `typography.hint.fontFamily` | `ui-monospace, ...` | 提示与辅助文本字体族（等宽时间指示器、音质徽标等） |
| `typography.hint.fontSize` | `11` | 提示文本基准字号（px，范围 9~16，默认 11） |
| `typography.lyrics.body.fontFamily` | `'Playfair Display', ...` | 歌词正文字体族（史诗衬线或现代黑体） |
| `typography.lyrics.body.fontSize` | `18` | 歌词正文基准字号（px，范围 14~36，默认 18） |
| `typography.lyrics.translation.fontFamily` | `-apple-system, ...` | 歌词翻译字体族（清晰易读的黑体栈） |
| `typography.lyrics.translation.fontSize` | `12` | 歌词翻译基准字号（px，范围 10~22，默认 12） |
| `typography.fontFamily` / `typography.fontSize` | — | 旧版别名 `font` 字段已被接受但建议迁移至 `typography` |

> 详细配置项与注释范例见 `config.example.json` 与 `docs/PROGRESS.md`。
> MPD 自身的配置见 `~/.config/mpd/mpd.conf`。

## 里程碑路线

- [x] **M0-1 空窗口骨架**：electron-vite + React 19 + TypeScript 7 + 纯净黑曜石舞台
- [x] **M0-2 液态玻璃材质系统**：
  - [x] 沉浸式窗口（`window.immersive` 无边框与系统窗框自由切换）
  - [x] 多模背景引擎（深色黑曜石 / 云母矿物晶体微光 / 动态视频壁纸图层，NVDEC 硬件加速流式循环播放）
  - [x] 左侧悬浮长条胶囊伸缩抽屉（`SidebarCapsule`，双态自适应、Clip Reveal 视窗遮罩展开、动静分离防拉伸抖动）
- [x] **M1-1 MPD 控制协议与状态栏交互**：
  - [x] 纯文本 TCP 客户端连接 MPD 6600（零第三方库依赖，支持播放/暂停/切歌/寻道/音量/模式切换）
  - [x] 底部通透磨砂状态栏（`StatusBar`，动静分离液态流动播放按键、等宽数字防抖进度条、黑胶唱片占位符）
  - [x] 悬浮胶囊本地全量曲库中心（`MusicLibraryList`，400+ 曲目 GPU 视窗裁剪快速检索与状态同步）
- [x] **M1-2 极坐标星盘歌词与 Model B 原生音频管线**：
  - [x] 极坐标星盘天文钟歌词轨道（`LyricsOrbit`，三级同心刻度圈、擒纵阻尼齿轮联动切行、滑动窗口防堆叠、滚轮与点击快速跳转）
  - [x] 右侧精密机械表机芯系统（`MechanicalGear`，纯线条蓝图工程风、多级传动齿轮与摆轮游丝）
  - [x] **Model B / 方案 C WebAudio PCM 流式管道**：废弃 `<audio>` 黑盒缓冲，采用 `fetch` + `AudioBufferSourceNode` 直送，将 3~4 秒滞后降低至 35ms 极速响应
  - [x] **切歌与歌词跳转平滑淡出淡入**：独立流世代 GainNode 架构，配置文件动态热生效，彻底根除交叠爆音
  - [x] **动态采样率感知与全格式支持**：MPD 原生透传 `*:16:2` + SoX 高阶重采样 + WAV 头动态解析 + 硬件自适应，彻底根治 48kHz 特殊曲目背景爆破音
- [x] **M2-1 WebAudio FFT 蓝图工程频谱律动图层**：
  - [x] 原生复用 `pcmPlayer.getAnalyserNode()`，零性能损耗提取 60fps 频域与时域特征
  - [x] 高级制表纯线条蓝图工程风（`SpectrumVisualizer`，基准标尺分划刻度、十字准星、对数拉伸样条曲线、延时衰减冷青虚线、散点微光粒子）
  - [x] 严格图层层级（壁纸 < 频谱图层 `bottom: 80px, z-index: 5` < 机械齿轮 < 状态栏，`pointer-events: none` 全透传）
  - [x] 极致性能与防劣化（零 React State 循环、预分配对象池零 GC 分配、暂停/停止/静音自适应 RAF 休眠）
  - [x] 完整运行时配置支持与 IPC 热重载（`visualizer.enabled`, `height`, `opacity`, `style`）
  - [x] 星盘歌词暗角层硬边消除（`inset: 0` 全视窗自然向外平滑消散，根治纵向色差分层）
- [ ] **M2-2 悬浮胶囊第二按键“播放队列”管理 (`QueueDrawer`)**
- [ ] **M2-3 主工作区居中液态玻璃面板 (`GlassPanel`) / 页面切换与黑胶大舞台**

## 开发

```bash
pnpm install       # 安装依赖 (依赖锁定: node 24 + pnpm 11)
pnpm dev           # 开发模式 (热更新)
pnpm build         # 构建到 out/ (主进程/预加载/渲染层产物)
pnpm typecheck     # TS 类型检查 (tsc --noEmit)
pnpm start         # 运行生产构建版
```

## 目录结构

```
src/
├─ main/           主进程: 窗口生命周期、配置管理、MPD TCP 客户端、特权流协议
├─ preload/        contextBridge 安全桥: 暴露最小安全 electronAPI
├─ types/          共享类型定义: 歌曲模型、MPD 状态、配置模型 (config.ts)
└─ renderer/       React 前端:
   ├─ components/  UI 组件 (胶囊抽屉、磨砂底栏、星盘歌词、机械机芯、频谱律动、曲库列表、视频壁纸)
   ├─ services/    核心驱动 (pcmPlayer: WebAudio PCM 流式播放、流世代淡入淡出、动态采样率)
   ├─ styles/      全局视觉风格与重置样式
   └─ App.tsx      主舞台逻辑与状态驱动中心
```
