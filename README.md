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
| `mpd.host` / `mpd.port` | `127.0.0.1` / `6600` | MPD 控制协议地址 |
| `mpd.streamPort` | `8000` | MPD httpd 音频流端口 |

> 详细配置项与注释范例见 `config.example.json` 与 `docs/PROGRESS.md`。
> MPD 自身的配置见 `~/.config/mpd/mpd.conf`。

## 里程碑路线

- [x] M0-1 空窗口（骨架跑通，当前）
- [ ] M0-2 液态玻璃面板组件 + 假数据 UI
- [ ] M1 手写 MPD 客户端 + 真实播放控制（附 mpd.conf 模板）
- [ ] M2 httpd 音频流（Electron 出声）+ AnalyserNode 预留
- [ ] M3 全屏 shader 背景 + 透明无边框模式打磨

## 开发

```bash
npm install
npm run dev        # 开发模式 (热更新)
npm run build      # 构建到 out/
npm run typecheck  # TS 类型检查
```

## 目录结构

```
src/
├─ main/       主进程: 窗口创建
├─ preload/    contextBridge 安全桥 (M1 填充)
└─ renderer/   React 前端
```
