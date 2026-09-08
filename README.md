# lpip-player

本地音乐播放器 — Electron(出声) + React + 手写 MPD 客户端，液态玻璃 UI。

## 配置文件

- **运行时配置**：`~/.config/lpip-player/config.json`（XDG 约定，应用真正读取的位置）
- **模板**：`config.example.json`（随项目版本化，同步 schema）

字段说明：

| 键 | 默认值 | 说明 |
|---|---|---|
| `window.frameMode` | `system` | `system` / `frameless` / `frameless-transparent` |
| `mpd.host` / `mpd.port` | `127.0.0.1` / `6600` | MPD 控制协议地址 |
| `mpd.streamPort` | `8000` | MPD httpd 音频流端口 |
| `theme.accent` / `theme.background` | `#6ee7b7` / `#0a0a0f` | UI 主题色 |

> MPD 自身的配置（`mpd.conf`）不在此列，见 M1 阶段的 `mpd.conf.example`。

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
