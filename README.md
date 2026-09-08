# lpip-player

本地音乐播放器 — Electron(出声) + React + 手写 MPD 客户端，液态玻璃 UI。

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
