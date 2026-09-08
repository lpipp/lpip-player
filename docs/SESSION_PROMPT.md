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
- git 最新提交 1d5a96d（M0-1: 主窗口自定义壁纸与统一背景效果支持）；工作区干净
- 已完成功能：
  1. 窗口沉浸式效果（`window.immersive`，系统边框与无边框切换，无前端冗余控件）；
  2. 主窗口统一背景效果架构（`window.background`，支持 mode: "default" | "mica" | "wallpaper"，平滑向下兼容旧配置）；
  3. 主窗口云母效果（深色黑曜石基底 + 矿物微光 + 颗粒感 + 棱线高光 + 全周微边框，支持 4 种色调风格与全项微调，100% 遮挡后方杂乱文字）；
  4. 主窗口自定义壁纸功能（支持本地绝对路径/`~` 展开、暗色遮罩透明度、独立高斯模糊、3 种填充缩放模式与安全降级）；
  5. 配置体系全面支持 JSONC 中文注释（零依赖状态机剥除，保护 URL）；
  6. 配置文件模板与文档已包含全量详细中文注释；
  7. 左侧边缘悬浮滑出气泡弹窗抽屉（`SidebarBubble`，液态玻璃质感，支持 30px 触发范围、30px 离开安全缓冲范围、触发延迟、关闭延迟与动画速度全项由配置文件驱动，实机人工核验通过）。
- 源码状态：
  main 窗口骨架、配置加载与参数桥接 / preload 空实现 / App.tsx 挂载 SidebarBubble / components 包含 SidebarBubble / global.css 包含背景材质
- 下一步任务：M0-2 第一个主内容液态玻璃面板 GlassPanel 与居中布局骨架

【工作方式（严格遵守）】
1. 分功能分会话：本会话只做这一个功能；开工前先说清"做什么、怎么验收"
2. 一次只加一个组件/逻辑变更；每步完成先做自动化/像素验证，随后**必须调出窗口持续保留在桌面上供用户人工核验**，用户确认通过才继续下一步
3. 全中文注释；TS strict 无 any；函数组件 PascalCase.tsx + 同名单 CSS；
   UI 液态玻璃：底 #0a0a0f、backdrop blur + rgba 半透明、边框 rgba(255,255,255,0.12)、
   圆角 12-16px、强调色 #6ee7b7（仅高亮态）
4. git 提交格式：`阶段: 简述`，一次提交一个逻辑变更
5. 红线：用户说"暂停开发"期间一律不动代码；用户说"继续"≠恢复开发，须先确认；
   改 ~/.config 下用户配置文件前先问；版本升级先查锁定表；
   **验证通过后必须保留运行窗口在桌面上供用户亲手体验验证，不得自行退出或杀掉窗口**
6. 环境：KDE Wayland；截图用 spectacle -b -f -o；当前模型不支持读图（需像素分析）；
   清理 electron 进程用 pkill -f "electron/dist/electron"

开始前：读 docs/ENVIRONMENT.md + docs/STYLE.md + git log --oneline -5，然后等我确认本次功能。
```
