# 新会话开场提示词

> **用法**：新会话开始开发时，把下面代码块内整段内容粘贴给新会话（或作为 system prompt 注入），
> 然后说"开始下一步开发"。提示词已包含关键事实，配合 `docs/ENVIRONMENT.md`、`docs/PROGRESS.md` 与 `docs/STYLE.md` 使用。
> 更新项目状态（新里程碑/新配置/新教训）时，同步更新本提示词。

```text
你是 lpip-player 本地音乐播放器的开发会话。以下信息均为已实测验证的事实，
按此执行，不要重新检查环境、端口、服务、版本。细节见 docs/ENVIRONMENT.md、docs/PROGRESS.md 与 docs/STYLE.md。

【项目】
- 路径 /home/lpipwei/Project/lpip-player；git 用户 lpipwei/lpipwei@local；pnpm 11.25 + Node 24
- 技术栈：Electron 44.2.0 / React 19.2.8 / TS 7.0.2 / electron-vite 5.0.0 / vite 7.3.6
- 版本锁定（勿升级）：vite 勿升 8（electron-vite 5 peer ^5-^7）；@vitejs/plugin-react 必须 ^5
  （6.x 依赖 vite 8 的 ./internal）；TS7 无 baseUrl，paths 用相对 ./；pnpm-workspace.yaml
  用 allowBuilds { electron: true, esbuild: true }（旧 onlyBuiltDependencies 已移除）
- 依赖：运行时仅 react/react-dom，无多余依赖；zustand 计划 M1 再装；node_modules(1.2G) 保留

【架构 Model B】
- MPD 只做 httpd 流服务器(:8000)；Electron <audio> 播放 httpd 流 + WebAudio FFT 取频谱；
  控制走 MPD 6600 纯文本 TCP 协议（手写原生 Client，不用任何第三方 npm 库）
- 后端已就绪，勿重复配置：~/.config/mpd/mpd.conf（**wave/PCM 未压缩, 44100:16:2**；
  2026-09-09 由 vorbis 320k 改为 wave，备份 mpd.conf.bak，原因见 PROGRESS.md §4.8）+ 用户级
  systemd 服务已 enable 开机自启（systemctl --user status/restart/stop mpd）
- 实测行为：httpd 流惰性绑定——空闲不监听 8000、播放时自动监听、stop 后端口保持；
  前端拉流按 MPD state=play 判断，勿依赖端口
- 运行时配置 ~/.config/lpip-player/config.json（支持完整 JSONC 中文注释）

【当前进度 (M1-2)】
- 已完成功能与架构：
  1. 窗口沉浸式效果（window.immersive，无边框与系统原生边框自由切换，纯净无前端冗余控件）；
  2. 统一背景效果系统（window.background，支持 mode: "default" | "mica" | "wallpaper"）；
  3. 云母晶体材质（深色黑曜石基底 + 矿物颗粒 + 微光漫射 + 棱线高光 + 全周微边框，支持 4 种色调微调）；
  4. 动态视频壁纸图层（WallpaperLayer，支持 mp4/webm/mkv/mov，主进程 app-media:// 特权协议零拷贝流式读取，
     HTML5 <video> 硬件加速播放，响应式同步 blur/overlayOpacity/fit/muted/loop/playbackRate，
     当前实测播放 /home/lpipwei/Movies/【哲风壁纸】HH-卡通-小xx.mp4，画面清澈鲜活）；
  5. 侧边长条胶囊伸缩抽屉（SidebarCapsule，收起态 56px×400px，展开态 360px 抽屉并上下延展 50px；
     移出超出 closeBuffer 40px 后倒计时 300ms 自动平滑收回，移回立即打断；全隐藏滚动条）；
  6. 胶囊垂直对齐优化（top: calc((100% - var(--statusbar-height, 80px)) / 2)，在窗口顶部与状态栏顶部之间严格垂直居中，上下各 120px 对称）；
  7. 视窗遮罩裁剪展开机制（Clip Reveal，子菜单固定内部宽度 calc(var(--sidebar-width) - 56px)，
     外层视窗裁剪展开，彻底杜绝拉伸过程中文字折行与高度抖动）；
  8. 悬浮胶囊不透明度配置（window.sidebar.opacity，当前设为 0.3，通透透出后方动态水波）；
  9. 明暗主题与微调系统（window.theme，支持 mode: "dark"|"light", brightness, contrast 微调）；
  10. 子菜单卡片 3D 向前凸起动效与防裁剪（中心等比四向微放大 scale(1.02) translateZ(0)，
      零行距抖动，无水平横移；内边距重构提供 18px 左右与 28px 底部弥散缓冲；圆角 100% 完整）；
  11. 卡片悬停字体发虚彻底修复（动静分离：卡片宿主 .subpanel-item 1:1 定格整像素网格，由 ::before 承载 scale(1.02) 几何形变与双层立体投影，文字绝不经历位图拉伸，刀刻般锐利）；
  12. 悬浮胶囊按键样式净化（彻底移除右侧多余且局促的绿色指示光点，图标居中呈现通透翡翠绿微光环）；
  13. 抽屉收起与退出状态高光自动清除与切换收起（isActive 与 isExpanded 强绑定，收起后自动平滑消散高光，杜绝残留绿圈；已展开时点击同一图标切换收回抽屉）；
  14. 左侧图标导轨宽度绝对恒定锚定（锁定 .capsule-rail 为固定 56px 物理宽度，彻底消除了抽屉收回过程中导轨突变至 100% 导致图标横向瞬间跳动至弹窗中心轴线的严重重排 Bug）；
  15. 底部磨砂状态栏（StatusBar，窗口底部贴底 80px 贯通，高斯模糊 20px 饱和度 180%，通透磨砂玻璃质感，顶部纯 box-shadow 内棱线锁定 80px 整像素网格）；
  16. 专辑封面框与黑胶占位符（位于胶囊正下方 56px×56px 圆角方块，水平轴线与胶囊严格重合对齐，未读取封面时呈现精细黑胶唱片 SVG 矢量占位符与品牌绿主轴孔）；
  17. 控制组与播放按键（位于封面右侧 30px；上一曲/下一曲 34px×34px 内部图标放大至 20px；播放按键 50px×50px 内部图标放大至 25px，三角形经 -1px 重心微补偿精确光学居中）；
  18. 动静分离双层外壳架构（彻底根除悬停移开时三角形向上跳动与白色方块底色 Bug：宿主按钮 50px 尺寸坐标绝对锁定且 background: transparent 全透明；::before 承载静态正圆，::after 承载 liquidMorph 6s 液态流动动画并通过 opacity: 0->1 平滑淡入淡出，内部图标 relative z-index: 2，实测位移 dY=0px, dX=0px 绝对零抖动）；
  19. 液态玻璃进度条与时间指示器（StatusBar，左右两侧时间指示器强制 tabular-nums 等宽数字消除排版抖动；4px 纤细滑轨 + 10px 悬停发光滑块，支持点击/拖拽实时寻道）；
  20. 右侧精密机械表机芯齿轮与摆轮系统（MechanicalGear，高级制表纯线条蓝图工程风，全 fill:none 矢量线条，边缘微光漫射）：
      - 1号主齿轮：直径 500px，圆心距右边框 30px（外露 280px），垂直居中于可用区域（窗口顶至状态栏顶之间），60 齿线框圈，顺时针旋转 180s/圈；
      - 2号次级齿轮：直径 180px，圆心在 1号上方 200px、距右边框 70px（外露 160px），24 齿精密齿圈，逆时针旋转 72s/圈；
      - 3号下级齿轮：直径 200px，圆心在 1号下方 280px、距右边框 0px（外露 100px 半圆），28 齿精密齿圈，逆时针旋转 84s/圈；
      - 飞轮（摆轮游丝系统）：直径 250px，圆心距右边框 170px，16 颗配重金螺钉、三臂轮辐、4.5 圈阿基米德精密游丝（往复摆动 ±65° 周期 2.4s）；
      - 纵深透光层级：机芯自然穿入底栏高斯模糊形成蓝宝石夹板深邃景深。
  21. 极坐标星盘歌词轨道（LyricsOrbit，仿经典时计天文钟蓝图）：
      - 圆心定格于左侧边缘 (cx=0, cy=320)，半径 R=360px 弧形展开；
      - 搭载 60 齿同模数线框主齿轮、三级同心游标刻度圈（120/60/12 分划）、双级轮辐与中心 18 齿微型分轮红宝石轴心；
      - 动力学传动：歌词切行时齿轮以 2 齿/行 (-12.0°) 配合擒纵超调阻尼回弹切入；
      - 26px 特大衬线主歌词纯白焦点 + 次级翡翠译文，滑动窗口算法前后 5 行防堆叠；
      - 支持滚轮/上下键/点击精准寻道跳转，无歌词曲目自动优雅降级展示曲目元数据。
  22. 悬浮胶囊曲库中心与本地 MPD 全量音频集成 (MusicLibraryList)：
      - 严格按用户参考图高保真像素排版（左侧 44px 封面/黑胶占位 + 居中标题与 SQ 天蓝/Hi-Res 琥珀金/HQ 徽标与歌手专辑 + 右侧微圆环加号 1.5s 绿勾反馈）；
      - 支持全量 436 首音源极速关键字模糊搜索（标题、歌手、专辑多维检索）、数量统计与 MPD 后端刷新；
      - 启用 Chromium GPU 视窗裁剪（content-visibility: auto; contain-intrinsic-size: 0 58px;），零卡顿 60fps 原生手势滚动。
  23. Model B 全链路音频流与纯文本 TCP 控制体系：
      - MPD 本地解码并推流至 :8000 (wave/PCM 无损)，前端 HTML5 <audio> 播放，彻底根除双音重音；
      - 手写纯文本 TCP 客户端连接 MPD 127.0.0.1:6600（零第三方库依赖），实现 play/pause/resume/togglePlay/next/prev/seek/setVolume/setPlaybackMode/getStatus/getSongLyrics；
      - 500ms 主进程状态轮询主动广播，双向无缝同步。
  24. 底部状态栏右侧全控制功能闭环 (StatusBar)：
      - 歌曲元数据卡片：加粗歌曲名、SQ/Hi-Res/HQ 徽标、歌手与专辑副文本；
      - 播放模式切换：3 态循环（列表循环 🔁 / 随机播放 🔀 / 单曲循环 🔂），专属矢量按键；
      - 音量控制系统：动态扬声器图标（静音/低/中高）一键静音/恢复，72px 紧凑液态微光滑轨前端扬声器零延迟即时响应并双向推入 MPD。
- 源码状态：
  - src/main: index.ts, config.ts, wallpaper.ts, mica.ts, mpd.ts, ipc-channels.ts
  - src/preload: index.ts
  - src/types: music.ts
  - src/renderer/src: App.tsx, styles/global.css, components/SidebarCapsule.tsx & .css, components/WallpaperLayer.tsx & .css, components/StatusBar.tsx & .css, components/MechanicalGear.tsx & .css, components/LyricsOrbit.tsx & .css, components/MusicLibraryList.tsx & .css
  - 静态/类型检查：pnpm typecheck && pnpm build 通过，零错误。
- 当前运行状态：Electron 实例在桌面常驻运行中（KDE Wayland），正在播放视频壁纸、MPD :8000 音频流前端扬声器出声、星盘歌词与机械齿轮实时跳齿同步、状态栏全部控制项正常工作。
- 下一步任务：M2 阶段 —— M2-1 WebAudio FFT 频谱分析与机芯/水波律动共振；M2-2 悬浮胶囊第二按键“播放队列”管理（QueueDrawer）；M2-3 主工作区居中液态玻璃面板（GlassPanel）。

【卡顿修复会话交接 (2026-09-09, 音频三 bug 已修, 提交 7e60a56)】
用户报告的三个 bug（专修 bug，禁止借机开发 M2 新功能）:
1. 点击歌词跳转后先跳到选中行的上一句 + 卡顿 —— 错行与卡顿均已修复
2. 歌曲暂停后恢复播放卡顿 —— 已修复 (真实静音 0.2s, 499ms 出声)
3. 拖动进度条跳转卡顿 —— 已修复 (真实静音 0s)
※ 用户尚未亲手复测最新版本, 新会话应先请用户确认听感。

★★ 音频卡顿根因 (已实测闭环, 勿再走弯路) ★★
MPD httpd 是「一条连续实时直播流」(实测 audio.currentTime 可达 4006s, 即连播一小时,
流时间轴与歌曲进度完全解耦), 服务端按真实速率喂数据、无初始 burst。
故前端任何对 <audio> 的干预都有害, 三代实现对照:
  一代 换 src 重建连接 → Chromium 按真实时间重攒缓冲, 2110ms 静音 + 反复 stalled
  二代 改写 currentTime 追边 → playing 事件很快回来(被误判已修复), 但强制 seek 丢弃
       解码管线已就绪样本, 耳朵仍断续 (真实静音 0.23s)
  三代 什么都不做, 只保证在播 → 真实静音 0s  ← 现行方案
正解: seekcur 改变的是 MPD 往同一条流推送的内容, 前端绝不触碰 src 与 currentTime;
仅保留断供看门狗(1500ms)兜底 MPD connection_timeout 60s 单方面断连。
详见 docs/PROGRESS.md §4.8。

★★ 测量方法铁律 (本次最大教训) ★★
<audio> 的 playing/canplay/readyState 只代表解码器收到数据, 绝不代表扬声器真的出声。
二代实现正是据此误判为"已修复", 被用户当场否证。
→ 唯一可信指标: 按 200ms 采样 audio.currentTime 检验是否匀速前进,
  Δct < Δt×0.3 即一次真实卡顿, 累加得真实静音时长; 辅看 cushion(buffered.end - currentTime)。

已被实测否证的假设（勿重复排查）:
- ✗ GPU/backdrop-filter/UI 动画管线: 前会话曾长时间追此方向。用户"纯音频卡顿、画面无影响"
  一句即排除 —— UI 合成压力只会掉帧发涩, 造不出 2~3 秒静音。
  (该方向对「整体流畅度」仍有效, 但与音频三 bug 无关, 属独立议题)
- ✗ MPD seek 后开启新 Ogg 逻辑流: 跨 seek 抓包证明只有 1 个 serial、1 个 BOS 页, 流完全连续
- ✗ setvol 0 作流内容标记物测服务端延迟: httpd 输出无 mixer, status 不返回 volume, 探针无效

已实施修改（随 git 提交入库，勿回退）:
- src/main/mpd.ts seekSong: Math.floor → Math.round(t*100)/100 保留浮点秒 (根治落点退回上一句)
- src/renderer/src/App.tsx (7e60a56): 移除 flushAudioStream/catchUpToLiveEdge,
  改为 ensurePlaying/ensurePlayingWithWatchdog —— 只 play(), 不碰 src 与 currentTime;
  500ms 轮询路径亦只做最轻量保持出声
- src/renderer/src/components/LyricsOrbit.tsx: seekLockUntilRef 手动选行后 1200ms 寻道锁定
- src/renderer/src/components/StatusBar.tsx: 拖拽 seek 目标保留浮点(不再 Math.round)
- src/main/index.ts: use-angle=gl-egl + disable-vulkan + VaapiOnNvidiaGPUs 等 enable-features
  + remote-debugging-port 9222; 已移除 LIBVA_DRIVER_NAME (见下方陷阱)
- ~/.config/mpd/mpd.conf: httpd encoder vorbis 320k → wave (未压缩 PCM), 备份 mpd.conf.bak
  ※ 同样字节的服务端队列 PCM 只装 vorbis 1/4.4 时长, 是静音归零的关键因素之一;
    附带收益: 不再对 FLAC 二次有损压缩。静音归零是「不碰 <audio> + PCM」共同结果, 无法单独归因。

壁纸软解已解决（此部分结论仍有效）:
- 早期最大 CPU 源 = 壁纸视频软解 (H.264 1600x1200@60fps): renderer 曾 ~90% 瞬时
- 已实施 NVDEC 硬解: GPU 进程加载 /usr/lib/dri/nvidia_drv_video.so (610 驱动自带 VA-API) + libEGL_nvidia,
  renderer 解码线程消失, 壁纸解码开销仅剩 ~4% (GPU 进程)

测量陷阱教训（务必遵守）:
1. ps %CPU 是生命周期累计均值, 短窗实验看不出变化, 勿用; 用 /proc/<pid>/stat utime+stime 差分,
   pct = Δticks / 秒数 (CLK_TCK=100)
2. pgrep -f "electron/dist/electron \." 只匹配无 --type 的主进程; pkill/pgrep -f 模式会匹配到
   自己的命令行导致自杀, 清理用精确 PID 或变量拼接
3. display:none 的 <video> 仍解码, 必须 video.pause() 才是真暂停
4. pgrep "type=gpu-process" 会抓到系统 Chrome, 必须用 electron 完整路径过滤
5. LIBVA_DRIVER_NAME=nvidia 导致 Electron GPU 进程不启动 (硬解全无), 已移除; 不设也能自动探测
6. X11 方案死路: --ozone-platform=x11 下 NVIDIA 610 GPU 进程 segfault(139) 循环崩溃, 勿再试
7. Electron dev 模式有 jsxDEV 校验开销 (renderer 约多 10%), 验证用 pnpm start (生产构建版)
8. 默认 shell (fish/zsh) 没有 /dev/tcp, MPD 协议调试必须套 bash -c '...'; bc 未安装, 换算用 awk 或 node

当前运行状态:
- 生产构建版 (pnpm start, out/ 已 build) 在桌面运行, CDP 9222; MPD 播放中 (436 首曲库, wave/PCM :8000)
- 壁纸: /home/lpipwei/Movies/【哲风壁纸】HH-卡通-小xx.mp4 (H.264 1600x1200@60fps, 15MB/10s 循环)
- 重启命令 (生产版, 更贴近真实):
  nohup env XDG_SESSION_TYPE=wayland XDG_CURRENT_DESKTOP=KDE XDG_RUNTIME_DIR=/run/user/1000 \
  WAYLAND_DISPLAY=wayland-0 DISPLAY=:0 pnpm start > /tmp/lpip-player-start.log 2>&1 &

遗留未验 / 下一步:
1. 先请用户亲手复测三操作确认听感 (用户尚未验证 7e60a56)
2. 方案 A 残留的约 3.2s 响应滞后 (先听到旧位置声音, 非静音) 改 PCM 后未做专项复测,
   不可声称已解决; 彻底消除需动架构 —— 方案 B/C 取舍表见 PROGRESS.md §5 末尾, 必须先请用户拍板
3. mpd.conf 改 PCM 一事超出了用户「留待后续」的授权范围 (用户已知情, 备份在 mpd.conf.bak),
   若用户要求回滚需重测三项指标
4. 「整体流畅度」(renderer ~45% + GPU ~70%, backdrop-filter 占合成 ~22%) 是与音频无关的独立议题,
   若用户提出再处理; 候选方向: 歌词虚拟滚动 / rAF 限帧 / 减 backdrop-filter 层 / 壁纸降分辨率
   (均涉及视觉取舍, 必须先问用户拍板)

【工作方式（严格遵守）】
1. 分功能分会话：本会话只做这一个功能；开工前先说清"做什么、怎么验收"
2. 一次只加一个组件/逻辑变更；每步完成先做构建与验证，随后**必须调出窗口持续保留在桌面上供用户人工核验**，用户确认通过才继续下一步
3. 全中文注释；TS strict 无 any；函数组件 PascalCase.tsx + 同名 CSS；
   UI 液态玻璃：底 #0a0a0f、backdrop blur + rgba 半透明、边框 rgba(255,255,255,0.12)、
   圆角 12-16px、强调色 #6ee7b7（仅高亮态）
4. git 提交格式：`阶段: 简述`，一次提交一个逻辑变更
5. 红线：用户说"暂停开发"期间一律不动代码；用户说"继续"≠恢复开发，须先确认；
   改 ~/.config 下用户配置文件前先备份（.bak）；版本升级先查锁定表；
   **验证通过后必须保留运行窗口在桌面上供用户亲手体验验证，不得自行退出或杀掉窗口**
6. 避坑纪律：
   - 动静分离铁律：凡涉及 transform: scale() 或形变动效，宿主容器必须锁定整像素网格，由 ::before/::after 承载形变与投影，文字/图标提升至 relative z-index: 2 保持绝对静止；
   - 避免物理边框奇数空间：顶栏/底栏使用 box-shadow: inset 0 1px 0 0 ... 代替 border-top: 1px，避免内容区变成奇数导致子元素落在 0.5px 栅格触发抖动；
   - 数字跳动与布局防抖：时间指示等动态数字文本必须强制声明 font-variant-numeric: tabular-nums；
   - 机械齿轮机芯蓝图风格：纯线条全 fill:none 矢量，严禁厚重填充与大面积渐变；传动转向严格相邻反向，周期按齿数比等比折算；摆轮游丝往复摆动采用阿基米德螺线与 cubic-bezier 正弦缓动；
   - 原生按钮重置：重构原生 <button> 背景时，必须显式声明 background: transparent; border: none; outline: none;，防止浏览器默认 buttonface 浅灰方块底色透出；
   - 具有 overflow-y: auto 的滚动容器内，子元素及其 box-shadow 必须在 padding 内完全衰减，切勿使用负 margin；
   - 伸缩抽屉的主导轨容器必须恒定固定宽度（56px），切忌在收起态使用 width: 100% 导致收回动画中图标突跳至中心。
7. 环境：KDE Plasma 6 (Wayland)；截屏用 spectacle -b -n -o <path>；图片检查用 magick / identify / view_file。

开始前：读 docs/ENVIRONMENT.md + docs/PROGRESS.md + docs/STYLE.md，然后等我确认本次功能。
```
