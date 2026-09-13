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
- [已完备] 左侧星盘机芯齿轮与歌词轨道统一同心模块化与 XY 轴设置调节 (2026-09-13):
  将左侧星盘 60 齿机械机芯与极坐标圆弧歌词轨道合并封装进统一容器 `.astrolabe-module-container`，旋转中心绝对锁定在 `(cx=0, cy=320)`，无论窗口大小如何变化或 X/Y 轴如何微调，二者 100% 同轴共心共步进，维持 52px 安全间距；
  X 轴以左侧边框为基准（`--astrolabe-x: 0px`），Y 轴以垂直中轴线为基准（`--astrolabe-y: 0px`）；
  偏好设置「外观与窗口」及「字体与排印」两大板块新增 X 轴（-300~600px）与 Y 轴（-300~300px）滑块调节及恢复居中基准按钮，60fps 即时响应与防抖持久化；
  CDP 9222 实机抓轨断言同心圆心重合度差值严格为 0px，动态位移 (+60, +30) 与重置全量通过（提交 33160c0）。
- [已完备] 彻底删除底部状态栏音量调节控件与业务逻辑 (2026-09-13):
  完全移除 StatusBar 右侧扩展区的静音按键（VolumeMuteIcon/VolumeLowIcon/VolumeHighIcon）与 72px 紧凑液态音量滑动条；
  清理 App.tsx 中 volume/isMuted 状态、isVolDraggingRef 节流防抖机制与 MPD setvol 同步；pcmPlayer 始终保持 1.0 (unity gain) 零衰减音频硬件直通；
  CDP 9222 实机扫描 volumeBlock=false、volumeBtn=false、volumeSlider=false 零残留，右侧子元素减至 2 项（提交 687920c）。
- [已完备] 非交互读数去除图形框转纯文字 (2026-09-13):
  将艺人分类抽屉艺人总数（.artist-count-badge）、歌单总数（.playlist-count-badge）、各类滑条数值读数（.liquid-slider-value）与统计信息播放次数（.stats-count-badge）等非交互性元素剥离外部背景与边框，转为轻量通透纯文字；
  严格保留 font-variant-numeric: tabular-nums 等宽防抖特性，零布局重排；CDP 9222 实机探测 computed border=0、background=rgba(0,0,0,0) 全绿（提交 e009ee9）。
- [已完备] 偏好设置一级总览副顶栏与二级导航分类徽标彻底移除 (2026-09-13):
  清除 SettingsDrawer 一级总览顶部的 settings-overview-toolbar（含“• 播放器偏好设置”与“实时热重载”）；
  清除二级详情导航栏右侧的 settings-toolbar-badge（与下方 Hero 重复的分类徽标）；
  CDP 9222 实机探测 hasOverviewToolbar=false、hasToolbarBadge=false 零残留（提交 04ef167）。
- [已完备] 偏好设置各分组卡片标题栏冗余徽标提示彻底清除 (2026-09-13):
  清除 SettingsDrawer 6 大设置模块共 14 处卡片顶栏右侧的 settings-group-badge 冗余状态镜像与英文翻译（无边框/wallpaper/Wallpaper/Sidebar/UI Font 等）；
  保留硬件音频直通与 MPD 连接等动态探针；CDP 9222 遍历 6 大模块 groupBadgesCount 严格为 0（提交 b909301）。
- [已完备] 彻底移除无意义原生 HTML title 悬浮提示框 (2026-09-13):
  清除 MechanicalGear(4处齿轮/飞轮)、LyricsOrbit(歌词行)、SidebarCapsule(导轨呼吸点)、StatusBar(封面框)、MusicLibraryList/QueueDrawer/ArtistDrawer/PlaylistDrawer(单曲行、艺人行、歌单卡片)及 SettingsDrawer(分类卡片)上的原生 title 提示；
  保留必要纯图标按键无障碍 title；CDP 9222 实机自动化验收全量通过（提交 854ab3f）。
- [已完备] React 组件重渲染阻断隔离与艺人抽屉 GPU 视窗裁剪 (2026-09-13):
  MechanicalGear / WallpaperLayer / SpectrumVisualizer / SidebarCapsule 四大核心组件全量 React.memo 隔离；
  App.tsx 在 syncFromMpdStatus 中对 currentSong 实施同曲对象引用稳定化（若 file/id 未变复用既有对象引用），彻底切断自上而下的无谓属性失效；
  handlePlaySong 与 handleAddToQueue 固化为 useCallback，阻断心跳节拍下长列表的遍历 VDOM diff；
  ArtistDrawer.css 补齐现代 GPU 视窗裁剪 content-visibility: auto (0 60px/0 56px)，实现四大抽屉裁剪统一；
  实测 3s 播放窗下齿轮与 436 首曲库列表 DOM 突变严格为 0，切歌即时秒播，activeSources=4/leadMs=78ms 稳健（提交 a0204ef）。
- [已完备] P0/P1/P2 全量并行修复批量落地 + 实机验收 (2026-09-12):
  6 路只读审查挖出 P0×1 + P1×8 + P2×20 → 6 worker 并行修复 → 6 reviewer 复检 → 2 worker 补修 → 2 reviewer 终检全 PASS → 统一批量提交 6a8af86（27 文件 +909/−607）。
  P0：play-after-pause 重建增益 + 空 gain 丢块（实机 pause 后 sources=0，resume 后 5/92ms，稳态 4/84ms 健康窗内）；P1：MPD 数值注入守卫、共享默认拷贝、频谱 stale 闭包、飞轮/gear-2 十字臂、同戳 secondary 去重、滚轮触板累加、徽标别名、钻取竞态、队列 queueId 操作；P2：版本钉死零 caret、types 单源等。
  验证：tsc 零错误 + diff-check 干净 + typography 11/11 + config.json 零漂移；构建后杀旧主进程重启（新实例 9222）；窗口保留桌面供人工核验。详见 PROGRESS §4.30。
- [已修复] 开关点了没反应：旧主进程 + saveConfig 回填双因 (2026-09-12):
  表象是 ToggleSwitch 无响应，实为两层：① 运行中 Electron 是 14:32 旧主进程，早于 15:01 构建，`config.get` 返回 lyrics keys 无 showTranslation，旧 parse 把开关值丢掉再回写覆盖；② 即使新主进程，`saveConfig` 用 DEFAULT 回填把未携带的开关写盘，污染老用户 config（真实链路探针 OFF 后 config 多出 `"showTranslation": true`）。
  修法：重启载入新 out/main；`saveConfig` 覆写只认 partial 显式携带，未携带从 currentTypo 继承、缺省不写盘；探针 `TOGGLE REAL-CHAIN`（关 0 译文 + persisted=false，恢复 6 译文 + persisted=true，config.json 恢复后零漂移）（提交 096135c）。
- [已完备] 歌词翻译显隐开关 (2026-09-12):
  配置 typography.lyrics.showTranslation（默认 true，严格布尔解析，缺省回退不写盘）；设置歌词排印加「显示歌词翻译」ToggleSwitch（translation 字形前，updateConfigImmediate 即时生效）；
  LyricsOrbit 新增 showTranslation prop（关闭不挂载 secondary），App 由 config.get/onChange 双路径同步；CSS 宿主 data 属性兜底 display:none，主行零影响；
  单测 4/4 + typography 11/11 + lyrics 11/11 + typecheck 0 + build 三产物，CDP 实页探针 4/4（开可见/关全隐/主行不动/重开恢复），config.json 零漂移（提交 3300ec0）。
- [已修复] 歌词行内双语拆分 U+2009 THIN SPACE (2026-09-12):
  实曲 LYRICS 标签为同时间戳单行、原文与译文由 U+2009 隔开；parseLrc 按 THIN SPACE 切分（首段 primary、余段拼 secondary，双侧判定防误拆，同戳编组保留）；
  Close Your Eyes 实曲 61 行中 58 行落 secondary，制作信息行保持单行；重启 Electron 后 CDP 实页 9 节点 6 译文 below=true（提交 ccc5ba7）。
- [已完备] 悬浮胶囊第五按键统计信息抽屉 (2026-09-11):
  第 5 键由占位外观主题重构为统计信息（StatsIcon 三柱条形图）；单级展示：摘要卡（累计播放时长/总播放次数/已统计曲目）+ playCount 降序排行（38px 圆角封面 + 标题>歌手 + 右侧 N 次徽标 + 前三翡翠高亮 + 空态暂无播放记录）；
  MPD sticker playCount 为真源（stats.playtime 累计时长），主进程 broadcastStatus 500ms 轮询 observePlaySession 状态机计数（max(30s, 时长×50%)，暂停冻结/seek 不清/stop 清空/单循环不重复计）；
  应用零本地统计状态，阈值常量硬编码，config.json 零漂移；单测 4 组 + 新 e2e 6 步全绿 + typography 双链路全绿（提交 c7cbd35）。
- [已完备] 歌词滚轮预览+单击确认跳转 (2026-09-11):
  滚轮只进预览不 seek（轨道/齿轮/窗口/is-active 全跟随预览行，零新色零新类复用高亮让位），播放态默认 1.5s 超时回弹、暂停态常驻；
  单击任意行直接跳转（seekLock 1.2s 仅确认跳转），暂停态确认跳转自动 resume 恢复播放；方向键/PageUpDown 保持直跳；
  audio.lyricPreview.timeoutMs（500~5000ms，默认 1500）落盘可配，设置音频模块滑条 0.5~5s step 0.1；
  单测 11/11 + 新 e2e 7 步全绿 + typography-e2e 全绿，config.json 零漂移（提交 39a1842）。
- [已完备] UI 整洁化隐藏专辑名与冗余说明 (2026-09-11):
  五处单曲行副文本仅保留歌手（曲库/队列/艺人L2/歌单L2/添加面板，去专辑名·分隔符·兜底，悬停 title 同步去专辑，SQ 徽标与计数全保留）；
  设置页三级描述全删（模块卡 desc/Hero desc/行级 control-desc，label+控件+数值保留，desc 签名保留兼容）；
  胶囊底部版本号 footer·移出提示·M-B 全删，呼吸点保留；字阶链路未动，单测 11/11 + e2e 全绿 + CDP 五处行盒实测（提交 8afd258）。
- [已完备] 全界面文字受控分层映射联动设置 (2026-09-11):
  九组件 89 处硬编码字号全量变量化零残留（HINT/TITLE/MODAL/HERO/ICON 五层语义映射，拖 ui/hint 滑条整组联动，
  设置页自身同步缩放自证）；全局 12px 托底收口（translation/ui 钳位与滑条 min、badge 负偏移、基线默认值）；
  单测 11/11 + e2e Step 12 联动验收全绿，CDP 实测 13.5→18.5/12→16/13→18 联动成立且可恢复基线（提交 0e43511）。
- [已完备] 悬浮面板全局最小 12px 字阶托底 (2026-09-11):
  六组件 75 处 <12px 字号托底 12px（硬编码 9~11.5px 全量上调 + hint calc 负偏移归零 + hint 默认 11→12），
  ui/hint 解析钳位收紧为 12 起跳，设置滑块 min=12 同步；行盒补偿（艺人/歌单单曲行 54→56px、曲库行内边距 -1px、
  徽标 12/13→16px、双行 gap 收紧）；单测 11/11 + e2e Step 11 computed 扫描全绿，
  CDP 实测 436 行曲库 + L1/L2 全抽屉 <12px=0/夹行=0/溢出=0（提交 d229c2a）。
- [已完备] 封面预压缩双档缓存与提取并发上限 (2026-09-11):
  封面链路一次提取产出双档缓存 —— <hash>.jpg 原图 + <hash>.thumb.jpg 512px JPEG 缩略图（存量老缓存零作废，
  缺缩略图时从原图补压缩不重读音频文件）；coverUrl 统一 ?tier=thumb，协议层 tier 缺省即 thumb → renderer 零改动；
  「从音频剥离原图」昂贵步骤手写 promise 队列并发上限 2（零依赖），缓存命中/补缩略图等廉价路径不排队；
  tier=full 保留原图访问路径留给 M2-3 黑胶大舞台；CDP 实测 30 张并发迁移缩略图 475ms/主进程 CPU 6.8% 无尖峰、
  分档 thumb/full/缺省各自 200、console 零报错、冷提取删缓存双档再生 119ms（提交 5a1c548）。
- [已体检] 音频与性能深度体检全绿，零缺陷: leadMs 均值 88.0ms/σ5.3 (铁律 70~110ms)、activeSources=5、console 零报错、seek ~300ms、采样率 48k/44.1k 随曲目正常自适应；全进程树 CPU 播放 2.8%/暂停 1.0%。疑似异常均为探针自身坑（详见 PROGRESS §4.21: pgrep -f 自匹配、Chromium setproctitle 改写 argv、探针 CDP 轮询污染 CPU 基线），应用侧无代码变更。
- [已修复] 偏好设置字体输入框基准字形同步修复: FontPickerControl 的 Escape 回退基准由「渲染期写 ref」改为「useEffect 空闲态同步」，避免外部 prop 变更（如测试直调 onInputChange/一键重置）冲掉编辑中的 baseline 导致 Esc 回退失效；typecheck 0 报错、单测 10/10 通过（提交 7641beb）。
- [已修复] 悬浮胶囊收起态按键消失缺陷彻底根治:
  1. 根因剖析: 原 .sidebar-capsule 声明为 overflow: hidden，包含 460px 子面板，子面板内元素（如字体输入框）获焦时触发 Chromium 默认机制，将父容器 scrollLeft 自动滚至 374px，导致 offset 0 的左侧导轨 (.capsule-rail) 被推至视窗外 x = -357px，形成按键消失假象；
  2. 现代 CSS overflow: clip: 升级为 overflow: clip，严格禁止任何获焦或 JS 驱动的横向滚动视口偏移；
  3. 收起态 visibility: hidden 隔离: 抽屉收起后为子面板挂载 visibility: hidden，彻底从焦点树与 Tab 链剥离；
  4. React 状态双重守卫: 增加 onScroll 强制归零拦截器，并在收起时主动释放内部焦点 (activeElement.blur())；实测导轨定格 x = 17px，按键居中 x = 25.5px 零位移。
- [已完备] M2-2 偏好设置新增“字体与字形 (Typography)”设置模块卡片与全文本字阶热重载全套闭环:
  1. 悬浮胶囊偏好设置第 6 模块卡片: 矢量字形图标 (TypeIcon)、加粗标题、动态参数摘要（UI/提示/歌词大小）与钻取指示箭头；
  2. 层级 2 字体设置详情流: 划分为 UI 界面通用字体、提示与辅助文本、星盘歌词排印（正文与翻译双轨）、配置重置与维护 4 大精细控件组；
  3. 字形与字号双维度自主控制: 每组均提供主流精选字体胶囊快捷单选、自由文本输入框（支持 Enter 提交、Esc 取消、空内容失焦回退与防 CSS 注入安全清洗）、以及带 tabular-nums 等宽数字防抖的精细滑块（SliderControl，支持严格边界钳位）；
  4. 全局动态 CSS 变量毫秒级热更: 抽象 applyTypographyToDOM，将 --font-family-* 与 --font-size-* 挂载至根节点，全面受控驱动主工作区、状态栏、抽屉列表、极坐标星盘歌词 (LyricsOrbit)；
  5. 严格动静分离与零布局抖动: 字号缩放绝不影响容器网格坐标，宿主位移 ΔX = ΔY = 0px；
  6. 持久化与测试闭环: POSIX 原子持久化至 config.json，单元测试 (10/10) 与 E2E (11/11) 严格通过，pnpm typecheck 0 报错。
- [已完备] M2-2 悬浮胶囊第六按键"偏好设置 (SettingsDrawer)"双级钻取画册流与配置原子持久化热重载全套闭环:
  1. 悬浮胶囊第 6 项专属展开 460px 偏好设置抽屉，纯原生 React + CSS 封装零第三方重型 UI 库依赖；
  2. 层级 1 分类总览层: 6 大模块画册卡片（外观与窗口、音频与过渡、蓝图频谱、MPD 服务、字体与字形、关于播放器），矢量纯线条图标、加粗标题、动态参数摘要与钻取箭头；
  3. 层级 2 设置详情层: 极简返回（‹ 全部设置）、Hero 头部微画卷、精细化控件流；支持 Esc / Backspace 优先返回一级总览；
  4. 精细控件全覆盖: ToggleSwitch 原生开关、SliderControl（tabular-nums 等宽数字防抖滑块）、SegmentedControl（WAI-ARIA 键盘无障碍单选）；
  5. 配置持久化与热重载: saveConfig 深度合并 + schema 校验钳位 + .bak 自动备份 + POSIX 临时文件原子 renameSync 替换；CONFIG_UPDATE 与 CONFIG_CHANGED 秒级即时热更；防抖累加 + 卸载紧急冲刷（flush on unmount）防丢配置；沉浸式无边框模式 (window.immersive) 切换即时无缝重构窗口 (recreateWindow) 并支持顶部 28px 隐形拖拽热区；
  6. 液态玻璃微光滑动条 (.liquid-scrollbar) 与动静分离铁律（宿主 ΔX = ΔY = 0px 零抖动）全覆盖。
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
