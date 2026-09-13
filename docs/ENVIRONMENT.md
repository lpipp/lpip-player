# 环境与配置快照（新会话免检手册）

> **用途**：后续开发**分功能、分会话**进行。新会话接手时先读本文档 + `docs/STYLE.md`，
> **不要重新检查环境、不要重新探测端口/服务/配置**——以下全部为 2026-09-08 实测验证过的状态。
> 若某条信息与实际不符，更新本文档并提交，而不是改行为。

---

## 1. 项目与工具链

| 项 | 值 |
|---|---|
| 项目路径 | `/home/lpipwei/Project/lpip-player` |
| 包管理器 | pnpm 11.25.0（fnm multishell 环境） |
| Node | v24.20.0 |
| git 用户 | lpipwei / lpipwei@local |
| 依赖目录 | `node_modules`（1.2G，**保留**；删了要重下 electron 二进制 200M+） |

### 锁定版本（勿随意升级）

| 包 | 版本 | 说明 |
|---|---|---|
| electron | 44.2.0 | 已装，二进制可用 |
| electron-vite | 5.0.0 | peer 要求 vite ^5-^7 |
| vite | 7.3.6 | **勿升 8**（electron-vite 5 不支持） |
| @vitejs/plugin-react | 5.2.0 | **必须 ^5**（6.x 依赖 vite 8 的 `./internal` 子路径） |
| react / react-dom | 19.2.8 | 运行时依赖 |
| typescript | 7.0.2 | Go 版，**无 baseUrl**，paths 用相对路径 `./` |
| @types/node | 26.4.1 | + @types/react / @types/react-dom |

### 依赖现状

- 运行时：仅 `react` / `react-dom`（**暂无多余依赖**）
- 未装但计划：`zustand`（M1 阶段再装，勿提前引入）
- pnpm 构建授权：`pnpm-workspace.yaml` 用 `allowBuilds: { electron: true, esbuild: true }`
  （旧 `onlyBuiltDependencies` 字段 pnpm 11 已移除，不要改回）
- 若 electron 二进制缺失：`cd node_modules/electron && node install.js` 手动补

---

## 2. git 状态（截至 854ab3f）

```
854ab3f fix(ui): 彻底移除机械齿轮、歌词、列表单曲行与卡片上的无意义悬浮提示框
6fcfb70 docs: 更新 P1 性能优化 项目全量文档
a0204ef perf(renderer): React 组件重渲染阻断隔离与艺人抽屉 GPU 视窗裁剪 (P1)
c3d03b5 chore(lock): package.json 钉死精确版本后的锁文件 specifier 同步
d56e64d docs: P0/P1/P2 全量并行修复批量落地实机验收文档同步 (PROGRESS §4.30, SESSION_PROMPT 置顶)
6a8af86 fix(review): P0/P1/P2 全量并行修复批量落地
d724098 docs: 更新开关无响应双因项目全量文档
096135c fix(config): saveConfig 缺省回退不写盘, 未携带 showTranslation 不回填默认值
3300ec0 feat(settings): 增加歌词翻译显隐开关, 配置与排印设置闭环
ccc5ba7 fix(lyrics): 歌词行内双语拆分 U+2009 THIN SPACE
c7cbd35 feat(stats): 悬浮胶囊第五按键重构为统计信息抽屉, MPD sticker playCount 排行+累计播放时长
3977194 docs: 歌词滚轮预览交付文档同步 (PROGRESS §2.23+§4.26, SESSION_PROMPT 置顶)
39a1842 feat(lyrics): 滚轮预览+单击确认跳转, 确认延迟可配置默认1.5s
8afd258 feat(ui): 整洁化隐藏专辑名与冗余说明文字
f53d23f docs: 更新 音频与性能深度体检 项目全量文档
a6d5fe1 docs: 更新 字体输入基线修复与 git 快照 项目全量文档
7641beb fix(settings): 字体输入基准字形改用 useEffect 同步 ref，修复渲染期写 ref 在外部 prop 变更后 Escape 回退失效
4cc3d1e test: fix e2e Step 10 sidebar collapse after Step 8 Escape navigation
2a2f849 fix+docs: MPD 连接测试 callback 并发守卫改用 ref 避免 effect 重跑冲刷；补全文档 typography 字段与 Linux 字体回退链
f3405cb docs: 更新 胶囊按键横向位移修复 项目全量文档
f9ccf9d fix(sidebar): 修复子元素获焦引发容器横向滚动导致胶囊按键被移出视窗缺陷
04e4c00 docs: 更新 偏好设置字体与字形设置 项目全量文档
5075cfc feat(settings): 偏好设置增加字体设置卡片并支持三类文本字形字号全局热联动
9d71c08 docs: 更新 偏好设置与无边框热重构 项目全量文档
ee53e14 docs: 更新 无边框沉浸式模式切换与拖拽热区 项目全量文档
f7d81b8 fix(window): 修复无边框沉浸式模式设置切换未即时生效缺陷并增加顶部拖拽热区
9d5b5d3 docs: 更新 M2-2 偏好设置 项目全量文档
25b7d54 feat(settings): 完成悬浮胶囊第六按键偏好设置抽屉与双级钻取画册流全套闭环
93925d4 docs: 更新 悬浮胶囊歌单抽屉(PlaylistDrawer) 项目全量文档
5689d7a feat(playlist): 完成悬浮胶囊第四按键歌单抽屉与双级钻取画册流全套闭环
9c3c501 refactor(artist): 删除切换排序方式按键并统一采用A-Z排序
719c5c8 feat(ui): 为曲库中心、播放队列与艺人分类添加统一液态玻璃微光滑动条
b4f99d5 feat(artist): 悬浮胶囊第三按键重构为艺人分类并实现双级钻取画册流排版
ad00c9f feat(sidebar): 将悬浮胶囊展开状态向右侧扩大100px至460px
65585ee refactor(queue): 删除播放队列中的红心收藏功能
9914be0 feat(queue): 曲库队列按键重构为二态开关(+添加/-移出)并支持双向实时同步
c4adfc1 fix(queue): 播放队列防重复添加并增加该歌曲已在队列提示
10a422a fix(queue): 修复键盘移除/收藏冒泡切歌缺陷、空队列时长00:01异常及冗余标题与IPC重连
```

- 工作区**干净**，无未跟踪文件
- `out/`（构建产物）不在仓库、可随时重建；`pnpm build` 产物在 `out/`

---

## 3. 源码现状（M2-2 抽屉体系完备）

```
src/
├─ main/
│  ├─ index.ts                  窗口生命周期与启动配置 (remote-debugging-port 9222, 启动自动去重, 歌单与配置持久化 IPC handler 注册, recreateWindow 沉浸式窗口热重构)
│  ├─ config.ts                 XDG 统一配置中心 (~/.config/lpip-player/config.json, 支持 JSONC、saveConfig 原子持久化与热重载)
│  ├─ mpd.ts                    纯文本原生 TCP 6600 MPD 客户端 (零第三方库，状态轮询、防重追加、安全移除、歌单全套指令、协议注入防护、统计 sticker playCount 计数/排行 + observePlaySession 阈值状态机)
│  ├─ wallpaper.ts              app-media:// 安全协议流式直驱本地动静态壁纸
│  ├─ mica.ts                   云母背景材质图层计算
│  └─ ipc-channels.ts           统一 IPC 通道常量集中管理 (含队列信道、歌单 9 条专属信道、MPD_GET_PLAY_STATS 统计信道与 CONFIG_UPDATE)
├─ preload/
│  └─ index.ts                  contextBridge 暴露安全的 window.electronAPI (含队列操作 API、歌单操作 API、mpd.getPlayStats 统计 API 与 config.update)
├─ types/
│  ├─ music.ts                  全局歌曲模型、播放模式、MPD 状态、歌词行、队列返回结果、MpdPlaylist 与统计模型 (PlayStats/PlayStatsEntry/PlaySessionState) 定义
│  └─ config.ts                 应用配置模型、字体排印配置 (TypographyConfig) 与防注入清洗、频谱律动配置、JSONC 注释解析器与 DeepPartial 定义
└─ renderer/
   ├─ index.html                CSP 策略与 DOM 挂载入口
   └─ src/
      ├─ main.tsx               React 19 根挂载
      ├─ App.tsx                全局主视图控制器、快捷键调度与状态桥接中心 (含 .window-drag-bar 顶部 28px 沉浸式拖拽热区, 同曲状态引用稳定化与 useCallback 回调固化)
      ├─ styles/global.css      全套 CSS 变量体系、reset 与深色黑曜石主题、.window-drag-bar 拖拽样式与无边框微调
      ├─ utils/
      │  └─ typography.ts       字体族预设清单 (UI_FONT_PRESETS 等) 与全局 DOM CSS 变量注入 (applyTypographyToDOM)
      ├─ services/
      │  └─ pcmPlayer.ts        Model B / 方案 C WebAudio PCM 流式管道 (自适应硬件采样率/流世代淡入淡出/防抖调度)
      └─ components/
         ├─ SidebarCapsule.tsx  左侧悬浮长条胶囊伸缩抽屉 (React.memo 隔离, 多抽屉切换，导轨锁定 56px 零抖动；第 5 键统计信息 + StatsIcon)
         ├─ StatisticsDrawer.tsx 悬浮抽屉统计信息 (单级展示：摘要卡累计时长/总次数/曲目数 + playCount 降序排行 + 空态，前三翡翠高亮)
         ├─ StatusBar.tsx       底部磨砂玻璃状态栏 (.css 动静分离液态流动按键、等宽数字防抖进度条)
         ├─ LyricsOrbit.tsx     极坐标星盘歌词天文钟 (.css 擒纵阻尼齿轮跳齿、三级游标分划、全视窗暗角渐变)
         ├─ MechanicalGear.tsx  右侧精密机械表机芯 (React.memo 隔离, .css 蓝图矢量纯线条、多级减速齿轮与摆轮游丝)
         ├─ SpectrumVisualizer.tsx 高级制表蓝图纯线条频谱律动 (React.memo 隔离, .css Canvas 2D 零内存分配/自适应休眠)
         ├─ MusicLibraryList.tsx 悬浮抽屉曲库管理 (.css 二态开关 +/-、60fps 模糊检索列表、content-visibility: auto)
         ├─ QueueDrawer.tsx     悬浮抽屉播放队列管理 (.css 原生拖拽重排/单曲移除/一键清空/content-visibility: auto)
         ├─ ArtistDrawer.tsx    悬浮抽屉艺人分类 (.css 双级钻取画册流/圆形微棱头像/作品统计/单曲二态开关/content-visibility: auto)
         ├─ PlaylistDrawer.tsx  悬浮抽屉歌单管理 (.css 双级钻取画册流/歌单创建重命名删除/单曲增删/二态开关/MPD歌单协议闭环/content-visibility: auto)
         ├─ SettingsDrawer.tsx  悬浮抽屉偏好设置 (.css 双级钻取画册流/6大模块精细控件包含字体与字形/液态玻璃开关滑块分段单选/配置原子持久化热重载)
         └─ WallpaperLayer.tsx  动态视频/静态图片壁纸图层 (React.memo 隔离, .css 硬件加速流式循环播放)
```

- 全 src 零 any 逃逸，严格符合 TypeScript strict 要求
- 构建配置：`electron.vite.config.ts`（main/preload 空配置、renderer 包含 react 插件 + `@` → `src/renderer/src` 别名）
- tsconfig：`strict`、`moduleResolution: bundler`、`paths: { "@/*": ["./src/renderer/src/*"] }`

---

## 4. 已就绪的后端（MPD，勿重复配置/探测）

### 配置文件

| 文件 | 说明 |
|---|---|
| `~/.config/mpd/mpd.conf` | 用户级配置（全中文注释） |
| `~/.config/systemd/user/mpd.service` | 用户级服务单元，**已 enable --now**，开机自启 |

### 服务管理（XDG_RUNTIME_DIR 缺失时先 export）

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)   # 非登录 shell 可能需要
systemctl --user status mpd      # 状态
systemctl --user restart mpd     # 改 mpd.conf 后重载
systemctl --user stop mpd
journalctl --user -u mpd -f      # 日志
```

### MPD 配置要点（已实测）

- 曲库：`music_directory = ~/Music`（已有真实 flac 曲库，`auto_update yes`）
- 控制协议：`bind_to_address 127.0.0.1` + `port 6600`
- 音频输出：httpd 流 `:8000`，**`encoder "wave"` 未压缩 PCM**，**`format "*:16:2"` 原生自适应采样率**，**无本地输出**（防双声，前端出声）
  - ⚠️ **2026-09-09 变更**：原为 `encoder "vorbis"` + `bitrate "320"`，改为 `wave`（约 1.41 Mbps / 176 KB/s）。
    原因：同样字节数的服务端队列，PCM 只装 vorbis 约 1/4.4 的时长，是音频卡顿归零的关键因素之一。
  - ⚠️ **2026-09-10 变更**：原写死 `format "44100:16:2"`，现已升级为 **`format "*:16:2"`**，并引入 **`resampler { plugin "soxr" quality "very high" }`**。
    原因：当曲库出现 48000 Hz / blocksize 1024 音频（如《灰色轨迹》、《钟无艳》、《喜帖街》）时，硬编码 44100 会迫使 MPD 回退至内置劣质 `internal` 算法，导致高频折叠失真、推流块在 3696/3700 字节间撕裂并伴随 42ms 偶发骤停；改为 `*:16:2` 后原汁原味透传 44.1k/48k 原声，输出块严格锁定 4096 字节均匀发送（备份见 `~/.config/mpd/mpd.conf.modelB.bak`）。
  - `wave` 模式下**不要写 `bitrate`**（PCM 无此概念）；前端按 `RIFF/WAVE` 头部动态解析 `sampleRate`。
- **httpd 输出块用 `bind_to_address`，不是 `host`**（host 会报 not recognized）
- **httpd 输出无 mixer**：`status` 不返回 `volume` 字段，`setvol` 不改变流内容
  （曾误以为可用 `setvol 0` 作为流内容标记物来测服务端延迟，该探针无效）
- systemd 模式忽略 `pid_file` 行（无害，可留可删）

### 实测行为（务必遵守，不要重新探测）

- **httpd 流惰性绑定**：空闲（从未播放）不监听 8000；播放时自动监听；stop 后端口保持监听不释放
- → 前端拉流逻辑**按 MPD `state=play` 判断**，不要依赖端口是否监听
- `wildmidi` 解码器警告无害（系统缺 timidity）
- 系统级 `mpd.service` 是 disabled，勿启用（避免与用户级抢 6600）

### 免装客户端的协议调试法

```bash
# ⚠️ 默认 shell 是 fish/zsh, 它们没有 /dev/tcp 虚拟设备 —— 必须显式套一层 bash -c
bash -c 'exec 3<>/dev/tcp/127.0.0.1/6600 && printf "status\nclose\n" >&3 && timeout 2 cat <&3; exec 3>&-'
# 常用命令: status / outputs / add "music_1/xxx.flac" / play / stop / clear / seek <秒>
```

- 另注：`bc` 命令**未安装**，脚本里做换算请用 `awk` 或 node
- 复杂探测（抓流分析、时序测量）建议直接写 `.mjs` 用 node 跑，比 shell 管道可靠

### 拉流验证

```bash
# 播放中: curl -s --max-time 3 -o /tmp/x.wav -w "%{http_code} %{content_type}" http://127.0.0.1:8000/
# 期望: HTTP 200 audio/wav; 头部应为 RIFF....WAVE (xxd -l 64 /tmp/x.wav)
# 速率应约 176 KB/s (44.1k PCM) 或 192 KB/s (48k PCM); 3 秒约收到 528~576KB
```

### CDP 调试（Electron 已开 `--remote-debugging-port=9222`）

```bash
# 在 renderer 页面内求值 (探针脚本见会话历史, 约 30 行)
# fetch http://127.0.0.1:9222/json/list 取 webSocketDebuggerUrl → WebSocket → Runtime.evaluate
```

- ⚠️ **Model B / 方案 C WebAudio PCM 流式管道出声验证**：
  - 前端已彻底废弃 HTML5 `<audio>` 标签黑盒预缓冲，由 [`src/renderer/src/services/pcmPlayer.ts`](file:///home/lpipwei/Project/lpip-player/src/renderer/src/services/pcmPlayer.ts) 接管 `fetch` 实时流并在 WebAudio 中调度 `AudioBufferSourceNode`；
  - 核心指标 1：`window.__pcmPlayer.activeSources.size`（活跃音频源数量，正常播放通常为 3 ~ 6 个）；
  - 核心指标 2：`leadMs = (window.__pcmPlayer.nextPlayTime - window.__pcmPlayer.audioCtx.currentTime) * 1000`（抗抖前瞻量，稳定在 70 ~ 110ms 为绝对健康出声）；
  - 核心指标 3：`window.__pcmPlayer.getSampleRate()`（动态识别到的当前流采样率，如 44100 或 48000）。

---

## 5. 运行时配置

- `~/.config/lpip-player/config.json`（**与仓库 `config.example.json` 结构一致**）：

```json
{
  "window": {
    "immersive": false,
    "background": {
      "mode": "default",
      "wallpaper": {
        "path": "",
        "blur": 0,
        "overlayOpacity": 0.5,
        "fit": "cover"
      },
      "mica": {
        "style": "default",
        "grainOpacity": 0.035,
        "tintOpacity": 0.05,
        "edgeHighlight": 0.08,
        "border": false
      }
    },
    "sidebar": {
      "enabled": true,
      "closeBuffer": 40,
      "closeDelay": 300,
      "animationDuration": 280,
      "animationEasing": "cubic-bezier(0.16, 1, 0.3, 1)",
      "width": 460,
      "verticalExtension": 50,
      "opacity": 0.3
    }
  },
  "audio": {
    "fade": {
      "enabled": true,
      "duration": 120
    }
  },
  "visualizer": {
    "enabled": true,
    "height": 160,
    "opacity": 0.85,
    "style": "blueprint"
  },
  "mpd": { "host": "127.0.0.1", "port": 6600, "streamPort": 8000 },
  "typography": {
    "ui": { "fontFamily": "system-ui, -apple-system, \"Segoe UI\", Roboto, \"PingFang SC\", \"Microsoft YaHei\", sans-serif", "fontSize": 13 },
    "hint": { "fontFamily": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"JetBrains Mono\", monospace", "fontSize": 11 },
    "lyrics": {
      "body": { "fontFamily": "'Playfair Display', 'DejaVu Serif', 'Liberation Serif', 'Noto Serif CJK SC', 'Noto Serif SC', 'Source Han Serif SC', Georgia, serif", "fontSize": 18 },
      "translation": { "fontFamily": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif", "fontSize": 12 }
    }
  }
}
```

- `window.immersive` 控制沉浸式效果开关（默认 `false` 保留系统原生边框，`true` 为无边框沉浸式窗口，无最小化/最大化按钮控件）
- `window.background` 统一管理窗口背景效果（`mode`: `'default'` 经典深色舞台、`'mica'` 云母材质、`'wallpaper'` 自定义壁纸；支持旧版 `window.mica` 平滑向下兼容）
- `window.background.wallpaper` 控制自定义壁纸（支持本地路径/`~` 展开、高斯模糊度 `blur`、暗色遮罩透明度 `overlayOpacity` 与填充模式 `fit`）
- `window.background.mica` 控制云母效果（包含 `style`, `grainOpacity`, `tintOpacity`, `edgeHighlight`, `border` 微调项）
- `window.sidebar` 控制左侧悬浮长条胶囊伸缩抽屉（包含开关 `enabled`、透明度 `opacity`、移出关闭距离 `closeBuffer`、移出收起延迟 `closeDelay`、动画时长 `animationDuration`、缓动函数 `animationEasing`、展开宽度 `width` 与上下延伸幅度 `verticalExtension`）
- `audio.fade` 控制切歌与歌词跳转时的平滑淡出淡入过渡（包含总开关 `enabled`、过渡时长 `duration`，支持热更即时生效）
- `visualizer` 控制音频频谱可视化律动（包含开关 `enabled`、画布高度 `height`、整体不透明度 `opacity` 与渲染风格 `style: 'blueprint' | 'wave' | 'bars'`，支持热重载即时生效，设为 `false` 立即休眠 RAF 循环）
- `typography` 控制全局文字排印与字体系统（含 UI 界面、提示文本、歌词正文、歌词翻译四类字形与字号，通过 CSS 变量毫秒级热更；旧版配置可使用 `font` 字段作为 `typography` 别名，已向下兼容但建议迁移至 `typography`）
- **格式特性**：内置零依赖注释解析，完全支持 **JSONC**（允许自由添加 `//` 与 `/* */` 中文注释，`config.example.json` 已提供全中文注释示例）
- 主题配置（theme）支持 `mode: "dark" | "light"`, `brightness`, `contrast` 微调
- ⚠️ electron 每次运行会向 `~/.config/lpip-player/` 写 Chromium 缓存（Cache/GPUCache 等 20+ 项），
  属可再生成内容，删了不心疼；以后可考虑把 userData 重定向到 `~/.cache`

---

## 6. 运行环境（KDE Wayland）

- 会话：KDE Plasma Wayland（XDG_SESSION_TYPE=wayland, XDG_CURRENT_DESKTOP=KDE）
- electron 44 启动有 Wayland/Vulkan 兼容警告 → **非致命**，冒烟测试已过
- 截图：`spectacle -b -f -o /tmp/x.png`（无 xdotool/xwd/gnome-screenshot）
- **当前 AI 模型不支持读图**：看到截图需用像素分析（ImageMagick/脚本）替代
- 进程清理：`pkill -f "electron/dist/electron"`（路径含 `.pnpm`，旧模式匹配不上）
  - ⚠️ `pgrep -f` / `pkill -f` 的模式会匹配到**自己所在的命令行**导致自杀；
    清理时用精确 PID（先 `pgrep -f "electron/dist/electron \." | head -1` 存进变量再 `kill`）
  - `pgrep -f "electron/dist/electron \."`（末尾 ` \.`）只匹配无 `--type=` 的**主进程**
  - 查 GPU 进程务必用 electron 完整路径过滤，否则会抓到用户开着的系统 Chrome 进程
- 重启应用（生产构建版，更贴近真实；dev 模式有 jsxDEV 校验开销，renderer 约多 10%）：

```bash
nohup env XDG_SESSION_TYPE=wayland XDG_CURRENT_DESKTOP=KDE XDG_RUNTIME_DIR=/run/user/1000 \
  WAYLAND_DISPLAY=wayland-0 DISPLAY=:0 pnpm start > /tmp/lpip-player-start.log 2>&1 &
```

- CPU 测量：**勿用 `ps %CPU`**（它是进程生命周期累计均值，短窗实验看不出变化）；
  用 `/proc/<pid>/stat` 的 `utime+stime` 差分，`pct = Δticks / 秒数`（`CLK_TCK=100`）

---

## 7. 验证命令（开发中随时可用）

```bash
pnpm typecheck   # tsc --noEmit（TS 7）
pnpm build       # electron-vite build → out/（main/preload/renderer 三产物）
pnpm dev         # 开发模式热更新
```
