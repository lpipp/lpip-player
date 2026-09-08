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

## 2. git 状态（截至 3c37db1）

```
3c37db1 后端配置: MPD 用户级 mpd.conf 带注释; 配置清除前端 window/theme
ba936b0 配置约定: XDG ~/.config/lpip-player/config.json + 仓库模板
ab01b3d 项目改名 lpip-player, 迁移至 ~/Project
844f21a M0-1: 空窗口骨架 (electron-vite + React + TS)
```

- 工作区**干净**，无未跟踪文件
- `out/`（构建产物）不在仓库、可随时重建；`pnpm build` 产物在 `out/`

---

## 3. 源码现状（纯空壳，M0-1）

```
src/
├─ main/index.ts                  窗口骨架: FRAME_MODE='system' 常量, createWindow()
├─ preload/index.ts              空实现 export {}, M1 填 IPC
└─ renderer/
   ├─ index.html                 CSP + #root
   └─ src/
      ├─ main.tsx                React 挂载入口
      ├─ App.tsx                 仅 <div className="stage" />, 无组件
      ├─ styles/global.css       reset + 深色 #0a0a0f + .stage 渐变
      └─ vite-env.d.ts           vite/client 类型
```

- 全 src 无 `GlassPanel` / `mpd-glass` / TODO / FIXME / console.log 残留（已扫描确认）
- 构建配置：`electron.vite.config.ts`（main/preload 空配置、renderer 有 react 插件 + `@` → `src/renderer/src` 别名）
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
- 音频输出：httpd 流 `:8000`，vorbis 320kbps，`44100:16:2`，**无本地输出**（防双声，前端出声）
- **httpd 输出块用 `bind_to_address`，不是 `host`**（host 会报 not recognized）
- systemd 模式忽略 `pid_file` 行（无害，可留可删）

### 实测行为（务必遵守，不要重新探测）

- **httpd 流惰性绑定**：空闲（从未播放）不监听 8000；播放时自动监听；stop 后端口保持监听不释放
- → 前端拉流逻辑**按 MPD `state=play` 判断**，不要依赖端口是否监听
- `wildmidi` 解码器警告无害（系统缺 timidity）
- 系统级 `mpd.service` 是 disabled，勿启用（避免与用户级抢 6600）

### 免装客户端的协议调试法

```bash
exec 3<>/dev/tcp/127.0.0.1/6600 && printf 'outputs\nstatus\n' >&3 && timeout 2 cat <&3 && exec 3>&-
# 常用命令: status / outputs / add "music_1/xxx.flac" / play / stop / clear
```

### 拉流验证

```bash
# 播放中: curl -s --max-time 3 -o /dev/null -w "%{http_code} %{content_type}" http://127.0.0.1:8000/
# 期望: HTTP 200 audio/ogg (~320kbps)
```

---

## 5. 运行时配置

- `~/.config/lpip-player/config.json`（**与仓库 `config.example.json` 逐字节一致**）：

```json
{
  "window": {
    "immersive": false,
    "mica": {
      "enabled": false,
      "style": "default",
      "grainOpacity": 0.035,
      "tintOpacity": 0.05,
      "edgeHighlight": 0.08,
      "border": false
    }
  },
  "mpd": { "host": "127.0.0.1", "port": 6600, "streamPort": 8000 }
}
```

- `window.immersive` 控制沉浸式效果开关（默认 `false` 保留系统原生边框，`true` 为无边框沉浸式窗口，无最小化/最大化按钮控件）
- `window.mica` 控制云母效果（支持布尔值或包含 `style`, `grainOpacity`, `tintOpacity`, `edgeHighlight`, `border` 的微调对象）
- **格式特性**：内置零依赖注释解析，完全支持 **JSONC**（允许自由添加 `//` 与 `/* */` 中文注释，`config.example.json` 已提供全中文注释示例）
- 主题配置（theme）留待后续 UI 阶段再引入
- ⚠️ electron 每次运行会向 `~/.config/lpip-player/` 写 Chromium 缓存（Cache/GPUCache 等 20+ 项），
  属可再生成内容，删了不心疼；以后可考虑把 userData 重定向到 `~/.cache`

---

## 6. 运行环境（KDE Wayland）

- 会话：KDE Plasma Wayland（XDG_SESSION_TYPE=wayland, XDG_CURRENT_DESKTOP=KDE）
- electron 44 启动有 Wayland/Vulkan 兼容警告 → **非致命**，冒烟测试已过
- 截图：`spectacle -b -f -o /tmp/x.png`（无 xdotool/xwd/gnome-screenshot）
- **当前 AI 模型不支持读图**：看到截图需用像素分析（ImageMagick/脚本）替代
- 进程清理：`pkill -f "electron/dist/electron"`（路径含 `.pnpm`，旧模式匹配不上）

---

## 7. 验证命令（开发中随时可用）

```bash
pnpm typecheck   # tsc --noEmit（TS 7）
pnpm build       # electron-vite build → out/（main/preload/renderer 三产物）
pnpm dev         # 开发模式热更新
```
