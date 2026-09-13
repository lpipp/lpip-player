# 开发风格约束与工作流

> 用途：**分功能、分会话**开发时的风格基准。每个新会话开始前读本文档 + `docs/ENVIRONMENT.md`。
> 本文档是约束，不是建议。拿不准时按本文档执行，确需例外先和用户确认。

---

## 1. 总则（工作方式）

1. **分功能、分会话**：一次会话只做一个功能。做完、验证、提交，再开新会话做下一个。
2. **一次只加一个组件**：不批量堆组件，每步能单独可视化验收。
3. **分阶段验收与保留窗口人工核验**：
   - 每步完成先进行自动化/像素分析验证；
   - 验证通过后，**必须调出应用窗口并持续保留在桌面上**，供用户亲自进行交互手感与视觉质感的人工验证；
   - 严禁在未经用户指示前擅自关闭或仅在后台跑完就退出；
   - 用户人工验证确认"通过"才算完成，方可进行下一步或提交。
4. **文档先行**：新功能涉及的架构/配置决策，先写进本文档族再动手（防止会话间信息丢失）。
5. **红线（任何时候）**：
   - 用户说"暂停开发"期间，**一律不动代码**。用户说"继续" ≠ 恢复开发，必须先确认。
   - 改用户的配置文件（`~/.config/...`）前**先问**，即使只是加注释。
   - 版本升级前查 `docs/ENVIRONMENT.md` 锁定表，不擅自升级 vite/plugin-react/TS。
   - 任务验收阶段**必须保留运行中的窗口在屏幕上供用户核验**，不得自动杀进程。

---

## 2. 代码风格

### 通用
- **全中文注释**：文件头写清职责；关键决策旁注释"为什么"，不只写"是什么"。
- TypeScript `strict` 全开，无 `any` 逃逸（特殊情况须注释说明）。
- 缩进 2 空格，无分号（与现有代码一致），单引号。

### React（renderer）
- 函数组件 + hooks，**不写 class 组件**。
- 组件文件 `PascalCase.tsx`（如 `GlassPanel.tsx`），样式同名单文件 `PascalCase.css`。
- 组件职责单一；状态尽量靠近使用处，全局状态（zustand）M1 再引入。
- 组件间用 props 传数据，不搞隐式全局。

### 主进程 / preload
- 主进程只做：窗口、MPD TCP 客户端、IPC 桥（M1 起）。
- preload 用 `contextBridge` 暴露最小 API 面，**不要直接暴露 `ipcRenderer` 裸对象**。
- IPC 通道名用常量（如 `mpd:command`），集中定义，防止字符串散落。

### CSS
- 颜色/尺寸用 CSS 变量集中定义（`:root`），不用魔法值。
- 类名用 kebab-case（如 `.glass-panel`），语义化。

---

## 3. UI 风格（液态玻璃，M0-2 起生效）

| 项 | 值 |
|---|---|
| 底色 | `#0a0a0f`（深空黑），可用 `radial-gradient` 做微渐变 |
| 玻璃质感 | `backdrop-filter: blur(...)` + `background: rgba(255,255,255,0.06~0.1)` |
| 玻璃边框 | `1px solid rgba(255,255,255,0.12)` + 圆角 `12~16px` |
| 强调色 | `#6ee7b7`（mint 绿），仅用于高亮/激活态，不滥用 |
| 文字 | 近白 `rgba(255,255,255,0.85)`，次要 `rgba(255,255,255,0.5)` |
| 字体 | 系统栈（global.css 已配），中文友好 |
| **滑动条 (Scrollbar)** | 严禁原生粗灰条；统一 `.liquid-scrollbar` 规范类；5px 药丸圆角，透明轨道，深色黑曜石半透 `rgba(255,255,255,0.18)`，Hover/Drag 激活 `#6ee7b7` 薄荷绿发光微扩至 6px |

- 玻璃层必须有内容可模糊（先有背景层次，再做面板），否则看不出玻璃效果。
- **每个组件单独验收**：单独渲染时视觉自洽，不依赖其他组件撑场面。

---

## 7. 界面整洁化设计原则（UI Declutter，2026-09-11 起生效）

> 目标：界面每一行只放用户决策需要的信息；说明性小字、调试性读数、技术黑话一律不渲染。
> 详见 `docs/PROGRESS.md` §2.22（落地记录）与 §4.25（施工纪律）。

1. **单曲行副文本只留歌手**：曲库 / 队列 / 艺人 L2 / 歌单 L2 / 添加面板五处统一 `标题 > 歌手` 双行；专辑名不拼接、不进悬停 `title`；`未知专辑` / `单曲` 兜底整段去掉（空歌手即空渲染，不拿占位符凑数）。但专辑数据仍在内存：搜索过滤 `s.album`、封面 `alt` 兜底、艺人分组 `albums` 统计保留。
2. **计数不是专辑名**：L1 / Hero / 工具栏的 `N 位 / N 组 / 共 N 首 / N 张专辑 / 时长` 属计数信息，全部保留；"零专辑字符"不是目标，`albumSpans=0` ＋ 严格分隔符（` - ` / ` · `，带前后空格）零残留即达标，艺人名内连字符（如 See-Saw）不得误判为拼接残留。
3. **设置页无三级小字**：模块卡 desc、L2 Hero desc、行级 control-desc 一律不渲染；label＋控件＋数值必须自明。类型签名可保留兼容（`SettingsModuleMeta.desc`、`SliderControl` / `FontPickerControl` 的 `desc?`），调用处传参暂留，后续另开会话清理，不扩大改动面。
4. **标签不加英文括号后缀**：中文 label 自明，不缀 `(Font Family)` / `(Control Port)` / `(Model B)` 这类技术后缀；分组标题精简（如 `星盘歌词排印→歌词排印`）；面向用户的文案不出现架构黑话（Model B / PCM / TCP 只出现在关于页规格表或代码注释）。
5. **胶囊底部无调试提示**：版本号 footer、移出距离读数、`M-B` 模型徽标一律不渲染；`capsule-status-dot` 状态呼吸点保留；`capsule-rail-bottom` 留空占位。被删 CSS 类名保留不动，零样式重构风险。
6. **只删展示，不动数据与逻辑**：删减仅限 JSX 展示分支；播放 / MPD / IPC / 配置持久化、行高与动静分离宿主一律不动。e2e 选择器（`.settings-control-label` / `.liquid-slider-value` / `.settings-group-title`）不得改名。
7. **验收纪律**：以 computed 渲染值为准，不以 grep 声明值为准；探针先断言行数基线（曲库 436 / 队列 10 / 艺人 L1 238 / 歌单 L2 10 / 添加面板 436）再谈 `sep=0` 结论；`queue-track-grip`（absolute 覆盖序号）与 `capsule-rail <> capsule-subpanel`（裁剪宿主）系已知预期重叠，非回归。
8. **严禁在非图标行级/背景元素上添加无意义的原生 HTML title 提示框**：原生 `title` 在 Linux/KDE 下表现为粗糙的实体方框且伴随延迟遮挡，与液态磨砂与精细线条语言格格不入；机械齿轮机芯、星盘歌词行、单曲列表行、艺人行、歌单卡片、设置分类卡片等直观交互元素严禁携带 `title` 提示；仅纯图标按钮（播放/暂停、上下曲、添加、移除、清空、返回等）保留必要的 `title` 或 `aria-label`。
9. **卡片标题栏无多余状态与英文徽标**：设置项各卡片标题右侧一律不渲染微缩状态或英文翻译徽标（`.settings-group-badge` 全删，如 `无边框` / `wallpaper` / `Wallpaper` / `Sidebar` 等）；控件（开关/单选/滑块）自身已清晰表意，严禁标题右侧“状态回声”；仅保留硬件直通与 MPD 连接等具备真实脉冲微光的动态探针（`.liquid-status-badge`）。
10. **抽屉无冗余副顶栏与重复分类徽标**：抽屉顶栏由容器统一权威展示，子面板严禁重复渲染无控件的副顶栏（如 `.settings-overview-toolbar` 的 `• 播放器偏好设置` 与 `实时热重载`）；二级详情导航条严禁在返回键右侧渲染分类名徽标（`.settings-toolbar-badge`），分类大标题由下方 Hero 权威承载，绝不套娃复读。
11. **非交互读数元素纯文字化（去除外部图形边框与填充）**：艺人数量、歌单数量、各类滑动条数值读数、统计信息播放次数等不可交互读数，严禁套用带有背景和边框的图形容器（如 `.artist-count-badge`、`.playlist-count-badge`、`.liquid-slider-value`、`.stats-count-badge`）；统一去除 `background`、`border` 与 `border-radius`，保留微内边距（`0 2px`），以轻量纯文本形式融入界面；严格保留 `font-variant-numeric: tabular-nums` 防止数值刷新时产生任何横向布局抖动（Layout Shift）；保留原有 CSS 类名与 DOM 结构确保选择器兼容。

---

## 4. git 提交规范

- 信息格式：`<阶段/功能>: 简述`（如 `M0-1: 空窗口骨架`、`后端配置: ...`）。
- 一次提交一个逻辑变更，不混提交。
- 提交前 `git status` 确认无杂物；构建产物/缓存不提交（.gitignore 已覆盖）。

---

## 5. 新会话启动清单（每次开发前）

1. 读 `docs/ENVIRONMENT.md`（环境现状，**勿重新检查**）+ 本文档。
2. `git log --oneline -5` 看上次进度。
3. 确认后端：`systemctl --user is-active mpd`（一般不查，除非涉及 MPD 功能）。
4. 与用户确认本次要做的功能（一个），做之前先讲清"做什么、怎么验收"。

## 6. 里程碑路线（当前进度）

```
[x] M0-1 空窗口骨架 (844f21a)
[x] M0-2 液态玻璃系统 (沉浸式窗口/多模背景引擎/视频壁纸/悬浮胶囊伸缩抽屉)
[x] M1-1 MPD 控制协议体系 (纯文本 TCP 6600 原生客户端 + 磨砂底栏 + 全量曲库检索)
[x] M1-2 极坐标星盘歌词与 Model B 原生音频管线:
    - 极坐标星盘天文钟歌词轨道 (LyricsOrbit) + 机械齿轮机芯 (MechanicalGear)
    - 方案 C WebAudio PCM 直送管道 (pcmPlayer: 80ms 抖动缓冲彻底根除 3~4s 滞后)
    - 双级解耦增益淡出淡入过渡系统 (FadeConfig, 配置文件热重载)
    - 动态采样率感知与全格式自适应 (MPD *:16:2 透传 + SoX 专业重采样 + 48kHz 背景爆破音根除)
[x] M2-1 WebAudio FFT 频谱分析与蓝图工程律动图层 (SpectrumVisualizer: 零分配 Canvas 2D/RAF 自适应休眠 + 纯线条散点微光 + 动态配置热更)
[x] M2-2 悬浮胶囊抽屉体系完备: 展开宽度460px、曲库管理 (MusicLibraryList)、播放队列 (QueueDrawer)、艺人分类画册流 (ArtistDrawer)、歌单管理 (PlaylistDrawer)、统计信息 (StatisticsDrawer: 摘要卡 + playCount 降序排行，MPD sticker 计数 + stats.playtime 累计时长，c7cbd35) 与偏好设置 (SettingsDrawer, 含外观/音频/频谱/MPD/关于/字体与字形全闭环)；UI 整洁化已落地（五处单曲行仅歌手 + 设置三级描述全删 + 胶囊底部提示全删呼吸点保留，8afd258）
[x] 性能优化 P1: React 核心组件 memo 隔离 (MechanicalGear/WallpaperLayer/SpectrumVisualizer/SidebarCapsule)、状态心跳引用稳定化 (currentSong)、操作回调 useCallback 固化、艺人抽屉全量 GPU 视窗裁剪 (content-visibility: auto, a0204ef)
[x] UI 纯净化: 彻底移除机械齿轮、歌词行、曲库/队列单曲行与抽屉卡片上的无意义原生 HTML title 提示框 (854ab3f)
[x] UI 纯净化: 移除偏好设置各分组卡片标题栏冗余的徽标提示 (b909301)
[x] UI 纯净化: 移除偏好设置一级总览副顶栏与二级导航分类徽标 (04ef167)
[x] UI 纯净化: 将艺人数量、各类滑动条数值与统计播放次数等非交互读数去除外部边框改为纯文字 (e009ee9)
[ ] 性能优化 P2: MPD TCP Client 短连接改造为连接池 / Keep-Alive 复用套接字，结合 idle 减少轮询
[ ] M2-3 主工作区居中液态玻璃面板 (GlassPanel) / 页面切换与黑胶大舞台
```

- **音频架构约束 (Model B / 方案 C 铁律)**:
  - 严禁倒退使用 HTML5 `<audio>` 标签拉取流媒体（会导致不可控的 3.5s 黑盒预缓冲并引发严重切歌/寻道滞后）；
  - 严禁引入任何第三方重型音频库，坚守纯原生 WebAudio 直驱架构；
  - 必须保持双级增益解耦（流世代独立 `activeFadeGainNode` -> 主音量 `masterGainNode` -> `analyserNode` -> `destination`）；
  - 音频流采样率必须从 WAV 头部动态提取自适应，严禁在 WebAudio 缓冲区创建中硬编码。
