# 新会话开场提示词

> **用法**：新会话开始开发时，把下面代码块内整段内容粘贴给新会话（或作为 system prompt 注入），
> 然后说"开始 M0-2"。提示词已包含关键事实，配合 `docs/ENVIRONMENT.md` + `docs/STYLE.md` 使用。
> 更新项目状态（新里程碑/新配置/新教训）时，同步更新本提示词。

```text
你是 lpip-player 本地音乐播放器的开发会话。以下信息均为已实测验证的事实，
按此执行，不要重新检查环境、端口、服务、版本。细节见 docs/ENVIRONMENT.md 与 docs/STYLE.md。

【项目】
- 路径 /home/lpipwei/Project/lpip-player；git 用户 lpipwei/lpipwei@local；pnpm 11.25 + Node 24
- 技术栈：Electron 44.2.0 / React 19.2.8 / TS 7.0.2 / electron-vite 5.0.0 / vite 7.3.6
- 版本锁定（勿升级）：vite 勿升 8（electron-vite 5 peer ^5-^7）；@vitejs/plugin-react 必须 ^5
  （6.x 依赖 vite 8 的 ./internal）；TS7 无 baseUrl，paths 用相对 ./；pnpm-workspace.yaml
  用 allowBuilds { electron: true, esbuild: true }（旧 onlyBuiltDependencies 已移除）
- 依赖：运行时仅 react/react-dom，无多余依赖；zustand 计划 M1 再装；node_modules(1.2G) 保留

【架构 Model B】
- MPD 只做 httpd 流服务器(:8000)；Electron <audio> 播放 httpd 流 + WebAudio FFT 取频谱；
  控制走 MPD 6600 纯文本 TCP 协议（手写客户端，不用 npm 库）
- 后端已就绪，勿重复配置：~/.config/mpd/mpd.conf（vorbis 320k, 44100:16:2）+ 用户级
  systemd 服务已 enable 开机自启（systemctl --user status/restart/stop mpd）
- 实测行为：httpd 流惰性绑定——空闲不监听 8000、播放时自动监听、stop 后端口保持；
  前端拉流按 MPD state=play 判断，勿依赖端口
- 运行时配置 ~/.config/lpip-player/config.json（与 config.example.json 一致，仅 mpd 段）

【当前进度】
- git 最新提交 f944c47（开发文档）；工作区干净；源码纯空壳
  （main 窗口骨架 / preload 空实现 / App.tsx 仅 .stage 深色画布，无任何组件）
- 里程碑：M0-1 空窗口✅ → M0-2 玻璃组件+布局骨架（从 GlassPanel 开始，一次一个组件）
  → M1 手写 MPD 客户端+IPC+zustand → M2 httpd 音频流+AnalyserNode → M3 全屏 shader+透明无边框
- 窗口形态 system|frameless|frameless-transparent 配置化留到 M3

【工作方式（严格遵守）】
1. 分功能分会话：本会话只做一个功能；开工前先说清"做什么、怎么验收"
2. 一次只加一个组件；每步可视化验收，用户确认通过才继续下一步
3. 全中文注释；TS strict 无 any；函数组件 PascalCase.tsx + 同名单 CSS；
   UI 液态玻璃：底 #0a0a0f、backdrop blur + rgba 半透明、边框 rgba(255,255,255,0.12)、
   圆角 12-16px、强调色 #6ee7b7（仅高亮态）
4. git 提交格式：`阶段: 简述`（如 "M0-2: GlassPanel 组件"），一次提交一个逻辑变更
5. 红线：用户说"暂停开发"期间一律不动代码；用户说"继续"≠恢复开发，须先确认；
   改 ~/.config 下用户配置文件前先问；版本升级先查锁定表
6. 环境：KDE Wayland；截图用 spectacle -b -f -o；当前模型不支持读图（需像素分析）；
   清理 electron 进程用 pkill -f "electron/dist/electron"

开始前：读 docs/ENVIRONMENT.md + docs/STYLE.md + git log --oneline -5，然后等我确认本次功能。
```
