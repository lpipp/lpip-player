# 新会话开场提示词

> **用法**：新会话开始开发时，将下方代码块完整内容粘贴给新会话（或作为系统指令输入），然后说明本次目标。
> 提示词已高度浓缩核心事实与关键铁律，开发细节配合 `docs/ENVIRONMENT.md`、`docs/PROGRESS.md` 与 `docs/STYLE.md` 使用。
> 每次完成功能交付并更新文档后，同步更新本文件中的最新开发进度。

```text
你是 lpip-player 本地音乐播放器的开发会话。以下信息均为已实测验证的事实，
按此执行，不要重新检查环境、端口、服务、版本。细节见 docs/ENVIRONMENT.md、docs/PROGRESS.md 与 docs/STYLE.md。

【项目与环境锁定】
- 路径 /home/lpipwei/Project/lpip-player；git: lpipwei/lpipwei@local；pnpm 11.25 + Node 24；KDE Plasma 6 (Wayland)
- 锁定版本（严禁升级）：Electron 44.2.0 / React 19.2.8 / TS 7.0.2（无 baseUrl，paths 用相对 ./）/
  electron-vite 5.0.0 / vite 7.3.6（勿升 8）/ @vitejs/plugin-react 5.2.0（勿升 6，依赖 vite 8）
- 依赖现状：运行时仅 react/react-dom，零多余依赖，严禁私自引入第三方重型 UI/音频/拖拽库；node_modules(1.2G) 保留
- 授权配置：pnpm-workspace.yaml 锁定 allowBuilds: { electron: true, esbuild: true }

【架构 Model B / 方案 C WebAudio 直驱】
- MPD 仅负责本地解码推流至 :8000 (wave/PCM "*:16:2" 原生自适应采样率透传 + soxr 黄金重采样备用，备份 mpd.conf.modelB.bak)；
  用户级服务 systemctl --user status/restart mpd 开机自启；httpd 惰性绑定，前端拉流按 MPD state=play 判断勿赖端口
- 前端通过 fetch + WebAudio 原生 PCM 管道直送 (pcmPlayer.ts) 驱动扬声器，严禁倒退使用 HTML5 <audio> 标签；
  双级解耦增益拓扑 (流世代独立 activeFadeGainNode -> masterGainNode -> analyserNode -> destination)，平滑淡出淡入；
  WAV 头 24..27 字节动态提取采样率，自适应硬件 (44.1k/48k)，~80ms 极低抗抖前瞻，切歌寻道秒播零杂音
- 控制走 MPD 6600 纯文本 TCP 协议（手写原生 Client，零第三方库依赖）；运行时配置 ~/.config/lpip-player/config.json (支持 JSONC)

【当前开发进度（最新进展置顶，倒序排列）】
- [已完备] M2-2 悬浮胶囊第四按键"歌单 (PlaylistDrawer)"双级钻取画册流与 MPD 歌单协议全套闭环:
  1. 纯线条制表风矢量歌单图标 (PlaylistIcon)，胶囊第 4 项无缝展开 460px 专属歌单抽屉；
  2. 层级 1 歌单总览层: 模糊检索/新建歌单/卡片画册 (封面预览/歌单名/曲目数/时长/一键播放/重命名/删除确认)；
  3. 层级 2 歌单详情层: 极简返回/Hero 头部/全部播放/全部入队/添加单曲挑选面板/单曲列表 (序号/封面/标题/音质徽标/等宽时长)；
  4. 单曲二态开关 (+/-) 与 MPD 播放队列实时双向同步；歌单单曲移出 (playlistdelete)；
  5. MPD 歌单指令全链路: listplaylists/listplaylistinfo/playlistadd/playlistdelete/save/rm/rename + escapeMpdString 协议注入防护；
  6. 液态玻璃微光滑动条 (.liquid-scrollbar) 与动静分离铁律完整覆盖。
- [已完备] M2-2 曲库中心、播放队列与艺人分类统一液态玻璃微光滑动条 (Liquid Glass Scrollbar):
  1. 彻底根除系统原生粗灰滚动条，全局抽象 .liquid-scrollbar 标准类与 WebKit 伪元素族；
  2. 5px 极细胶囊药丸圆角，透明轨道，黑曜石半透常态，Hover/Drag 激活 #6ee7b7 薄荷翡翠微发光并平滑微扩至 6px；
  3. 全场景覆盖曲库中心 (400+长列表)、播放队列 (动态增删) 与艺人分类 (238位艺人总览 + 单曲详情)；
  4. 解构 SidebarCapsule 全局通配抑制，采用精确排除名单放行，卡片定格 380px 严格防抖防重排。
- [已完备] M2-2 悬浮胶囊第三按键“艺人分类 (ArtistDrawer)”双级钻取画册流排版完备:
  1. 纯线条瑞士制表风矢量人像图标 (ArtistsIcon)，胶囊第 3 项无缝展开 460px 专属抽屉；
  2. 彻底删除冗余排序切换按键，统一严格按照首字母与中文拼音 A-Z 升序排列，搜索框更舒展；
  3. 方案 A 双级钻取 (Drill-Down): 艺人总览层 (44px 圆形微棱头像/作品统计/一键播放) ⟷ 艺人详情层 (Hero 头部/全部播放/全部入队/单曲列表)；
  4. 单曲列表无缝集成 + / - 队列二态开关，与 MPD 队列全局毫秒级双向同步；纯内存极速聚合零额外 IPC。
- [已完备] M2-2 悬浮胶囊播放队列管理 (QueueDrawer，精简移除红心收藏) 与曲库二态开关 (Toggle Switch):
  1. 播放队列抽屉 (QueueDrawer) 与曲库抽屉: 胶囊展开宽度向右扩增 100px 至 460px (子面板 404px 宽阔舒展)，导轨锁定 56px 零抖动；
     全量呈现 MPD 实时队列，当前播放 `#6ee7b7` 翡翠高亮与微型跳动均衡器条，一键居中定位 (Locate)，
     单击即时切歌，单曲移除，一键清空队列，原生 HTML5 拖拽排序 (无外部依赖)，纯净等宽时长展示；
  2. 曲库队列二态开关 (Toggle Switch): 曲库列表中每首歌右侧按键根据当前 MPD 队列呈现二态——
     未在队列显示为 + 号（点击添加），已在队列显示为 - 号与翡翠微光（点击移出）；
     双向全局实时响应式联动（队列清空或增删时实时互通）；
     乐观锁 syncSeqRef 防乱序与 clickLockRef 连击防护；按钮阻断 onKeyDown 冒泡防误触切歌；
  3. MPD 队列底层防重拦截 (addToQueue) 与启动自动存量去重修剪 (deduplicateQueue)。
- [已完备] M2-1 高级制表蓝图音频频谱律动图层 (SpectrumVisualizer):
  底栏正上方 Canvas 2D 零内存分配、自适应 RAF 休眠、对数频段样条曲线、延时衰减虚线、基准标尺刻度与散点微光，支持热重载。
- [已完备] M1-2 极坐标星盘歌词天文钟 (LyricsOrbit) 与右侧精密机械机芯 (MechanicalGear):
  左侧天文钟星盘弧形轨道 (R=360px)，2 齿/行 (-12°) 擒纵超调跳齿，26px 特大衬线焦点，全视窗径向暗角；
  右侧高级制表全 fill:none 矢量纯线条减速齿轮与阿基米德螺线摆轮游丝，下延穿入底栏形成蓝宝石水晶夹板景深。
- [已完备] M1-1 MPD 协议控制体系与底部磨砂玻璃状态栏 (StatusBar):
  贴底 80px 贯通磨砂玻璃，动静分离液态流动按键 (dY=0px 绝对零抖动)，tabular-nums 等宽数字防抖滑轨，黑胶封面，播放模式/音量全闭环。
- [已完备] M0 沉浸式窗口与多模背景引擎:
  无边框与原生边框自由切换 (window.immersive)；动态视频壁纸 (WallpaperLayer, app-media:// 零拷贝流式读取硬件加速播放)；
  深色云母晶体材质 (window.background.mica)；左侧悬浮胶囊伸缩抽屉 (SidebarCapsule, Clip Reveal 视窗裁剪防拉伸折行)。
- [待开启] M2-3 主工作区居中液态玻璃面板 (GlassPanel) / 页面切换与黑胶大舞台。

【关键避坑与架构铁律】
1. 音频铁律：严禁 <audio> 标签；坚守 WebAudio 直驱与双级增益解耦；流采样率自适应硬件；
   CDP 验证健康度：window.__pcmPlayer.activeSources.size 与 leadMs 维持 70~110ms。
2. 动静分离铁律：凡涉及 scale() 缩放或形变动效，宿主容器定格整像素网格，由 ::before/::after 承载形变投影，文字图标提升至 z-index: 2。
3. 布局防抖铁律：时间指示动态数字强制 font-variant-numeric: tabular-nums；底栏顶栏用 box-shadow 内棱线代替 border-top 避免奇数亚像素。
4. 交互防护铁律：行内子按钮必须显式拦截 onKeyDown 阻止冒泡，杜绝键盘回车触发整行切歌；乐观更新配合序号防乱序；按文件移除队列必须安全阻断防误删 0 号歌曲。

【文档更新格式与工作流规范】
每次功能或修复开发完成并通过实机验证后，必须同步更新以下全套文档，并作为独立提交推送：
1. docs/PROGRESS.md:
   - 顶栏更新时间与当前阶段状态；
   - 在 §2 按序号追加新功能小节：包含功能定位、设计哲学、动静分离、性能保障与通信链路；
   - 若有架构决策或重大修复，在 §4 追加踩坑纪律小节（症状、根因分析、解决方案与实测数据）；
   - 更新 §5 下一步开发计划状态。
2. docs/ENVIRONMENT.md:
   - 更新 §2 git 状态快照（同步最新 commit 哈希与简述）；
   - 更新 §3 源码树结构，记录新增/修改的文件与组件职责。
3. docs/STYLE.md:
   - 更新 §6 里程碑路线状态，将完成项标记为 [x]，标注下一阶段 [ ]。
4. docs/SESSION_PROMPT.md:
   - 将最新开发进度倒序置顶更新至【当前开发进度】第一条，保持高信息密度与事实准确。
5. Git 提交格式规范：代码与文档分阶段独立提交，文档统一格式为 `docs: 更新 <阶段/功能> 项目全量文档`。

【工作方式红线（严格遵守）】
1. 分功能分会话：一次会话只做一个功能；开工前先说清"做什么、怎么验收"。
2. 一次只加一个组件/逻辑变更；每步构建验证；全中文注释，TS strict 零 any，液态玻璃 #0a0a0f + blur + #6ee7b7 强调色。
3. 绝对红线：验证通过后必须保留运行窗口在桌面上供用户亲手实机体验核验，不得自行退出或杀掉窗口。
4. 用户说"暂停开发"期间一律不动代码；用户说"继续"≠恢复开发，须先确认；改配置前先备份（.bak）；版本锁定勿擅升。

开始前：读 docs/ENVIRONMENT.md + docs/PROGRESS.md + docs/STYLE.md，然后等我确认本次功能。
```
