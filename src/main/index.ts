import { existsSync, watch, mkdirSync } from 'node:fs'
import { extname, join, dirname, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, protocol, net, ipcMain } from 'electron'

import { loadConfig, getDefaultConfigPath, saveConfig, type AppConfig, type DeepPartial } from './config'
export { loadConfig, saveConfig, getDefaultConfigPath }
export type { AppConfig, DeepPartial }
import { EXT_TO_MIME, resolveWallpaperPayload } from './wallpaper'
import { IPC_CHANNELS } from './ipc-channels'
import type { PlaybackMode, PlaySessionState } from '../types/music'
import {
  addToPlaylist,
  addToQueue,
  clearQueue,
  createPlaylist,
  deduplicateQueue,
  deletePlaylist,
  enqueuePlaylist,
  getLibrary,
  getOrExtractAlbumCover,
  getPlaylists,
  getPlaylistSongs,
  getPlayStats,
  getQueue,
  getSongLyrics,
  getStatus,
  incrementPlayCount,
  observePlaySession,
  moveQueueItem,
  nextSong,
  pausePlayback,
  playPlaylist,
  playQueueItem,
  playSong,
  prevSong,
  removeFromPlaylist,
  removeQueueItem,
  renamePlaylist,
  rescanLibrary,
  resumePlayback,
  seekSong,
  setPlaybackMode,
  setVolume,
  togglePlayPause
} from './mpd'

// 启用远程调试端口以支持自动化验证与实测核验
app.commandLine.appendSwitch('remote-debugging-port', '9222')

// Wayland 下 Vulkan 与 ozone 不兼容导致渲染回退 CPU; 引导合成走 EGL (NVIDIA 硬件路径), 禁用 Vulkan 避免回退
app.commandLine.appendSwitch('use-angle', 'gl-egl')
app.commandLine.appendSwitch('disable-vulkan')
// NVIDIA 610 驱动自带官方 VA-API (NVDEC 硬解后端): 开启 Chromium 硬解 flags
// (壁纸视频软件解码实测占 renderer ~90% CPU, 硬解后解码与零拷贝合成均移出 CPU)
// 注意: LIBVA_DRIVER_NAME=nvidia 环境变量会致 GPU 进程启动失败, 由 Chromium 自行探测 VA-API 驱动
app.commandLine.appendSwitch(
  'enable-features',
  'VaapiOnNvidiaGPUs,VaapiIgnoreDriverChecks,AcceleratedVideoDecodeLinuxGL,AcceleratedVideoDecodeLinuxZeroCopyGL'
)

// 注册特权协议 app-media 用于高效流式加载本地壁纸与媒体文件
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-media',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

/**
 * 将最新的应用配置即时同步并注入到指定的 BrowserWindow
 * 包含 CSS 变量与 HTML data 属性，无须重新加载页面即可实现即时视觉热生效
 */
export function applyConfigToWindow(win: BrowserWindow, config: AppConfig): void {
  if (!win || win.isDestroyed()) return

  const { background, theme, sidebar } = config.window
  const wpPayload = background.mode === 'wallpaper' ? resolveWallpaperPayload(background.wallpaper) : null

  const script = `
    (() => {
      try {
        const root = document.documentElement;
        const s = root.style;

        // 窗口沉浸式形态标记
        root.setAttribute('data-window-immersive', ${JSON.stringify(String(config.window.immersive))});

        // 1. 窗口背景模式与相关材质/壁纸参数
        const mode = ${JSON.stringify(background.mode)};
        root.setAttribute('data-bg-mode', mode);

        if (mode === 'mica') {
          root.setAttribute('data-mica', 'true');
          root.setAttribute('data-mica-style', ${JSON.stringify(background.mica.style)});
          root.setAttribute('data-mica-border', ${JSON.stringify(String(background.mica.border))});
          root.removeAttribute('data-wallpaper-type');
          root.removeAttribute('data-wallpaper-url');

          s.setProperty('--mica-grain-opacity', ${JSON.stringify(String(background.mica.grainOpacity))});
          s.setProperty('--mica-tint-opacity', ${JSON.stringify(String(background.mica.tintOpacity))});
          s.setProperty('--mica-edge-highlight', ${JSON.stringify(String(background.mica.edgeHighlight))});
        } else if (mode === 'wallpaper') {
          root.removeAttribute('data-mica');
          const wpPayload = ${JSON.stringify(wpPayload)};
          if (wpPayload) {
            root.setAttribute('data-wallpaper-type', wpPayload.mediaType);
            root.setAttribute('data-wallpaper-url', wpPayload.mediaUrl);
            root.setAttribute('data-wallpaper-blur', String(wpPayload.blur));
            root.setAttribute('data-wallpaper-overlay-opacity', String(wpPayload.overlayOpacity));
            root.setAttribute('data-wallpaper-fit', wpPayload.fit);
            root.setAttribute('data-wallpaper-muted', String(wpPayload.muted));
            root.setAttribute('data-wallpaper-loop', String(wpPayload.loop));
            root.setAttribute('data-wallpaper-playback-rate', String(wpPayload.playbackRate));

            s.setProperty('--wallpaper-image', 'url("' + wpPayload.mediaUrl + '")');
            s.setProperty('--wallpaper-media-url', 'url("' + wpPayload.mediaUrl + '")');
            s.setProperty('--wallpaper-blur', wpPayload.blur + 'px');
            s.setProperty('--wallpaper-overlay-opacity', String(wpPayload.overlayOpacity));
            s.setProperty('--wallpaper-fit', wpPayload.fit);
          } else {
            root.setAttribute('data-bg-mode', 'default');
            root.removeAttribute('data-wallpaper-type');
            root.removeAttribute('data-wallpaper-url');
          }
        } else {
          root.removeAttribute('data-mica');
          root.removeAttribute('data-wallpaper-type');
          root.removeAttribute('data-wallpaper-url');
        }

        // 2. 主题明暗、微调偏移与对比度
        root.setAttribute('data-theme', ${JSON.stringify(theme.mode)});
        root.setAttribute('data-theme-brightness', ${JSON.stringify(String(theme.brightness))});
        root.setAttribute('data-theme-contrast', ${JSON.stringify(String(theme.contrast))});
        s.setProperty('--theme-mode', ${JSON.stringify(theme.mode)});
        s.setProperty('--theme-brightness', ${JSON.stringify(String(theme.brightness))});
        s.setProperty('--theme-contrast', ${JSON.stringify(String(theme.contrast))});

        // 3. 侧边悬浮胶囊抽屉
        const sidebarEnabled = ${JSON.stringify(sidebar.enabled)};
        root.setAttribute('data-sidebar-enabled', String(sidebarEnabled));
        if (sidebarEnabled) {
          root.setAttribute('data-sidebar-opacity', ${JSON.stringify(String(sidebar.opacity))});
          root.setAttribute('data-sidebar-glow-hint', ${JSON.stringify(String(sidebar.glowHint))});
          root.setAttribute('data-sidebar-trigger-delay', ${JSON.stringify(String(sidebar.triggerDelay))});
          root.setAttribute('data-sidebar-close-delay', ${JSON.stringify(String(sidebar.closeDelay))});
          root.setAttribute('data-sidebar-close-buffer', ${JSON.stringify(String(sidebar.closeBuffer))});
          root.setAttribute('data-sidebar-vertical-extension', ${JSON.stringify(String(sidebar.verticalExtension))});

          s.setProperty('--sidebar-opacity', ${JSON.stringify(String(sidebar.opacity))});
          s.setProperty('--sidebar-bg', 'rgba(14, 16, 24, ' + ${JSON.stringify(String(sidebar.opacity))} + ')');
          s.setProperty('--sidebar-bg-hover', 'rgba(18, 21, 32, ' + ${JSON.stringify(String(Math.min(1, sidebar.opacity + 0.08)))} + ')');
          s.setProperty('--sidebar-bg-expanded', 'rgba(12, 14, 22, ' + ${JSON.stringify(String(Math.min(1, sidebar.opacity + 0.12)))} + ')');
          s.setProperty('--sidebar-width', ${JSON.stringify(`${sidebar.width}px`)});
          s.setProperty('--sidebar-trigger-width', ${JSON.stringify(`${sidebar.triggerWidth}px`)});
          s.setProperty('--sidebar-close-buffer', ${JSON.stringify(`${sidebar.closeBuffer}px`)});
          s.setProperty('--sidebar-vertical-extension', ${JSON.stringify(`${sidebar.verticalExtension}px`)});
          s.setProperty('--sidebar-duration', ${JSON.stringify(`${sidebar.animationDuration}ms`)});
          s.setProperty('--sidebar-easing', ${JSON.stringify(sidebar.animationEasing)});
        }

        // 4. 全局文字排印与字体系统
        const typography = ${JSON.stringify(config.typography || null)};
        if (typography) {
          if (typography.ui) {
            if (typography.ui.fontFamily) s.setProperty('--font-family-ui', typography.ui.fontFamily);
            if (typography.ui.fontSize) s.setProperty('--font-size-ui', typography.ui.fontSize + 'px');
          }
          if (typography.hint) {
            if (typography.hint.fontFamily) s.setProperty('--font-family-hint', typography.hint.fontFamily);
            if (typography.hint.fontSize) s.setProperty('--font-size-hint', typography.hint.fontSize + 'px');
          }
          if (typography.lyrics) {
            if (typography.lyrics.body) {
              if (typography.lyrics.body.fontFamily) {
                s.setProperty('--font-family-lyrics-body', typography.lyrics.body.fontFamily);
                s.setProperty('--font-family-lyrics', typography.lyrics.body.fontFamily);
              }
              if (typography.lyrics.body.fontSize) {
                s.setProperty('--font-size-lyrics-body', typography.lyrics.body.fontSize + 'px');
                s.setProperty('--font-size-lyrics', typography.lyrics.body.fontSize + 'px');
              }
            }
            if (typography.lyrics.translation) {
              if (typography.lyrics.translation.fontFamily) {
                s.setProperty('--font-family-lyrics-translation', typography.lyrics.translation.fontFamily);
              }
              if (typography.lyrics.translation.fontSize) {
                s.setProperty('--font-size-lyrics-translation', typography.lyrics.translation.fontSize + 'px');
              }
            }
          }
        }
      } catch (err) {
        console.error('[lpip-player:applyConfigToWindow] 注入配置异常:', err);
      }
    })();
  `

  win.webContents.executeJavaScript(script).catch(() => {})
}

// 追踪当前窗口的沉浸式形态以及是否处于平滑重建过程中
let currentWindowImmersive = false
let isRecreatingWindow = false
// 窗口重建保护标志的安全超时 (毫秒): 若新窗口既不 ready-to-show 也不 did-fail-load
// (如加载挂起), 强制释放保护标志, 避免后续切换被永久拒绝
const RECREATE_SAFETY_TIMEOUT_MS = 8000

/**
 * 根据沉浸式配置重建窗口
 * Electron 在 Linux/Wayland 下 frame (原生窗框/无边框) 为窗口创建时固定属性，
 * 无法通过单实例 API 动态切换。此处通过创建新窗口、状态无缝交接并安全销毁旧窗口实现即时生效。
 */
export function recreateWindow(oldWin: BrowserWindow, isImmersive: boolean): BrowserWindow {
  if (isRecreatingWindow || !oldWin || oldWin.isDestroyed()) return oldWin
  isRecreatingWindow = true
  currentWindowImmersive = isImmersive

  const bounds = oldWin.getBounds()
  const isMaximized = oldWin.isMaximized()
  const isFullScreen = oldWin.isFullScreen()

  const newWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 720,
    minHeight: 480,
    show: false,
    frame: !isImmersive,
    backgroundColor: '#0a0a0f',
    title: 'lpip-player',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })

  newWin.webContents.on('did-finish-load', () => {
    applyConfigToWindow(newWin, loadConfig())
  })

  // 安全超时: 加载挂起导致既无 ready-to-show 也无 did-fail-load 时兜底释放
  const safetyTimer = setTimeout(() => {
    isRecreatingWindow = false
  }, RECREATE_SAFETY_TIMEOUT_MS)

  newWin.once('ready-to-show', () => {
    // 成功分支: 清除安全超时, 后续按正常流程释放标志
    clearTimeout(safetyTimer)
    if (isFullScreen) {
      newWin.setFullScreen(true)
    } else if (isMaximized) {
      newWin.maximize()
    }
    newWin.show()
    // 等新窗口就绪并展示后，销毁旧窗口，视觉无缝切换
    setTimeout(() => {
      try {
        if (!oldWin.isDestroyed()) {
          oldWin.destroy()
        }
      } catch {
        // 忽略销毁瞬态异常
      }
      isRecreatingWindow = false
    }, 60)
  })

  newWin.webContents.on('did-fail-load', () => {
    clearTimeout(safetyTimer)
    isRecreatingWindow = false
  })

  // 新窗口被用户或系统直接关闭时同样释放保护标志, 避免卡死后续切换
  newWin.on('closed', () => {
    clearTimeout(safetyTimer)
    isRecreatingWindow = false
  })


  if (process.env['ELECTRON_RENDERER_URL']) {
    newWin.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    newWin.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return newWin
}

function createWindow(): void {
  // 读取运行时配置, 判定是否开启沉浸式效果
  const config = loadConfig()
  const isImmersive = config.window.immersive
  currentWindowImmersive = isImmersive

  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    // 沉浸式效果: 为 true 时无边框 (frame: false); 否则使用系统原生边框 (frame: true)
    frame: !isImmersive,
    backgroundColor: '#0a0a0f',
    title: 'lpip-player',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })

  // 页面加载完成后, 注入最新的运行时配置 (云母、壁纸、主题与悬浮胶囊等)
  win.webContents.on('did-finish-load', () => {
    applyConfigToWindow(win, loadConfig())
  })

  // 渲染完成再显示, 避免白屏闪烁
  win.on('ready-to-show', () => win.show())

  // 开发模式走 vite dev server (热更新); 生产加载打包产物
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // 注册特权流式本地媒体协议处理器 (支持图片、大尺寸视频 Range 请求零内存拷贝，以及内嵌封面提取缓存)
  protocol.handle('app-media', async (request) => {
    const url = request.url

    // 场景 1: 音频内嵌封面提取与本地缓存服务 (app-media://cover/<file>?tier=thumb|full)
    if (url.startsWith('app-media://cover/')) {
      const rawRel = url.slice('app-media://cover/'.length)
      const qIndex = rawRel.indexOf('?')
      const encodedPath = qIndex === -1 ? rawRel : rawRel.slice(0, qIndex)
      const query = qIndex === -1 ? '' : rawRel.slice(qIndex + 1)
      const relPath = decodeURIComponent(encodedPath)
      // 缺省按 thumb 处理; tier=full 保留原图访问路径 (留给大舞台高清场景)
      const tier = query.includes('tier=full') ? 'full' : 'thumb'
      const coverPath = await getOrExtractAlbumCover(relPath, tier)
      if (coverPath && existsSync(coverPath)) {
        return net.fetch(pathToFileURL(coverPath).toString(), {
          headers: request.headers
        })
      }
      return new Response('No Cover', { status: 404 })
    }

    // 场景 2: 常规静态图片或大尺寸视频流 Range 请求
    const pathWithoutQuery = url.replace(/^app-media:\/\//, '').split('?')[0]
    let filePath = decodeURIComponent(pathWithoutQuery)
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath
    }
    if (!existsSync(filePath)) {
      return new Response('File Not Found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString(), {
      headers: request.headers
    })
  })

  // 统计信息抽屉: 连续播放会话追踪 (跨越阈值 max(30s, 时长×50%) 即 playCount +1, 单曲循环/手动重播视为新会话允许再次计数)
  let playSession: PlaySessionState | null = null

  // 轮询在途守卫: 500ms 节拍内上一轮 getStatus 未返回时跳过本轮, 避免慢查询重叠导致旧结果后到覆盖新状态
  let isBroadcastingInFlight = false

  const broadcastStatus = async (): Promise<void> => {
    // 上一轮仍在途中则丢弃本轮节拍 (保新状态不被旧结果回写)
    if (isBroadcastingInFlight) return
    isBroadcastingInFlight = true
    try {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0 && !windows[0].isDestroyed()) {
        const status = await getStatus()
        playSession = observePlaySession(playSession, status, Date.now(), (file) => {
          // fire-and-forget: sticker get/set 两轮往返挂后台, 不阻塞 500ms 广播节拍
          void incrementPlayCount(file)
        })
        windows[0].webContents.send(IPC_CHANNELS.MPD_STATUS_CHANGED, status)
      }
    } catch {
      // 忽略广播异常
    } finally {
      // 无论成功失败都必须复位, 否则守卫永久锁死导致轮询停摆
      isBroadcastingInFlight = false
    }
  }


  // 注册 MPD 相关 IPC 通信处理程序
  ipcMain.handle(IPC_CHANNELS.MPD_GET_LIBRARY, async () => {
    return getLibrary()
  })

  ipcMain.handle(IPC_CHANNELS.MPD_RESCAN, async () => {
    return rescanLibrary()
  })

  ipcMain.handle(IPC_CHANNELS.MPD_PLAY, async (_event, file: string) => {
    const res = await playSong(file)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_PAUSE, async () => {
    const res = await pausePlayback()
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_RESUME, async () => {
    const res = await resumePlayback()
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_TOGGLE_PLAY, async () => {
    const res = await togglePlayPause()
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_NEXT, async () => {
    const res = await nextSong()
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_PREV, async () => {
    const res = await prevSong()
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_SEEK, async (_event, time: number) => {
    const res = await seekSong(time)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_GET_STATUS, async () => {
    return getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.MPD_GET_LYRICS, async (_event, file: string) => {
    return getSongLyrics(file)
  })

  ipcMain.handle(IPC_CHANNELS.MPD_ADD_QUEUE, async (_event, file: string) => {
    const res = await addToQueue(file)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_GET_QUEUE, async () => {
    return getQueue()
  })

  ipcMain.handle(IPC_CHANNELS.MPD_PLAY_QUEUE_ITEM, async (_event, pos: number, queueId?: number) => {
    const res = await playQueueItem(pos, queueId)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_REMOVE_QUEUE_ITEM, async (_event, pos: number, queueId?: number, file?: string) => {
    const res = await removeQueueItem(pos, queueId, file)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_CLEAR_QUEUE, async () => {
    const res = await clearQueue()
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_MOVE_QUEUE_ITEM, async (_event, fromPos: number, toPos: number) => {
    const res = await moveQueueItem(fromPos, toPos)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_SET_VOLUME, async (_event, volume: number) => {
    const res = await setVolume(volume)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_SET_MODE, async (_event, mode: PlaybackMode) => {
    const res = await setPlaybackMode(mode)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_GET_PLAY_STATS, async () => {
    return getPlayStats()
  })

  // 歌单相关 IPC 处理程序
  ipcMain.handle(IPC_CHANNELS.MPD_GET_PLAYLISTS, async () => {
    return getPlaylists()
  })

  ipcMain.handle(IPC_CHANNELS.MPD_GET_PLAYLIST_SONGS, async (_event, name: string) => {
    return getPlaylistSongs(name)
  })

  ipcMain.handle(IPC_CHANNELS.MPD_CREATE_PLAYLIST, async (_event, name: string) => {
    return createPlaylist(name)
  })

  ipcMain.handle(IPC_CHANNELS.MPD_DELETE_PLAYLIST, async (_event, name: string) => {
    return deletePlaylist(name)
  })

  ipcMain.handle(IPC_CHANNELS.MPD_RENAME_PLAYLIST, async (_event, oldName: string, newName: string) => {
    return renamePlaylist(oldName, newName)
  })

  ipcMain.handle(IPC_CHANNELS.MPD_ADD_TO_PLAYLIST, async (_event, name: string, file: string) => {
    return addToPlaylist(name, file)
  })

  ipcMain.handle(IPC_CHANNELS.MPD_REMOVE_FROM_PLAYLIST, async (_event, name: string, pos: number) => {
    return removeFromPlaylist(name, pos)
  })

  ipcMain.handle(IPC_CHANNELS.MPD_PLAY_PLAYLIST, async (_event, name: string) => {
    const res = await playPlaylist(name)
    broadcastStatus()
    return res
  })

  ipcMain.handle(IPC_CHANNELS.MPD_ENQUEUE_PLAYLIST, async (_event, name: string) => {
    const res = await enqueuePlaylist(name)
    broadcastStatus()
    return res
  })

  // 获取当前应用运行时全局配置
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async () => {
    return loadConfig()
  })

  // 更新当前应用全局配置并安全持久化
  ipcMain.handle(IPC_CHANNELS.CONFIG_UPDATE, async (_event, partial: DeepPartial<AppConfig>) => {
    try {
      const configFilePath = process.env['LPIP_CONFIG_PATH'] || getDefaultConfigPath()
      const prevConfig = loadConfig(configFilePath)
      const prevImmersive = prevConfig.window.immersive

      const updatedConfig = saveConfig(partial)
      const nextImmersive = updatedConfig.window.immersive

      // 检查沉浸式无边框模式是否发生了变更
      const immersiveChanged =
        typeof partial.window?.immersive === 'boolean' && prevImmersive !== nextImmersive

      const windows = BrowserWindow.getAllWindows()
      if (immersiveChanged) {
        // 重建窗口以使无边框模式 (frame: false / true) 瞬时平滑生效
        const targetWin = BrowserWindow.getFocusedWindow() || windows[0]
        if (targetWin && !targetWin.isDestroyed()) {
          recreateWindow(targetWin, nextImmersive)
        }
      } else {
        for (const win of windows) {
          if (!win.isDestroyed()) {
            applyConfigToWindow(win, updatedConfig)
            win.webContents.send(IPC_CHANNELS.CONFIG_CHANGED, updatedConfig)
          }
        }
      }
      return { success: true, config: updatedConfig }
    } catch (err) {
      console.error('[lpip-player:main] CONFIG_UPDATE 异常:', err)
      const current = loadConfig(process.env['LPIP_CONFIG_PATH'] || getDefaultConfigPath())
      return { success: false, config: current, error: (err as Error).message }
    }
  })

  // 监听配置文件变更并向渲染层广播热更新 (监听父目录以兼容原子 rename 与冷启动未创建场景)
  const configFilePath = process.env['LPIP_CONFIG_PATH'] || getDefaultConfigPath()
  const configDir = dirname(configFilePath)
  const configFileName = basename(configFilePath)
  if (!existsSync(configDir)) {
    try {
      mkdirSync(configDir, { recursive: true })
    } catch {
      // 忽略目录预创建瞬态异常
    }
  }

  let configDebounceTimer: ReturnType<typeof setTimeout> | null = null
  if (existsSync(configDir)) {
    try {
      watch(configDir, (_eventType, filename) => {
        // 严格过滤仅处理目标配置文件变更，规避 .bak 与 .tmp 引起的循环广播
        if (!filename || filename === configFileName) {
          if (configDebounceTimer) clearTimeout(configDebounceTimer)
          configDebounceTimer = setTimeout(() => {
            try {
              const updatedConfig = loadConfig(configFilePath)
              const windows = BrowserWindow.getAllWindows()
              // 如果外部直接编辑 config.json 改变了 immersive 属性
              if (updatedConfig.window.immersive !== currentWindowImmersive) {
                const targetWin = BrowserWindow.getFocusedWindow() || windows[0]
                if (targetWin && !targetWin.isDestroyed()) {
                  recreateWindow(targetWin, updatedConfig.window.immersive)
                }
              } else {
                for (const win of windows) {
                  if (!win.isDestroyed()) {
                    applyConfigToWindow(win, updatedConfig)
                    win.webContents.send(IPC_CHANNELS.CONFIG_CHANGED, updatedConfig)
                  }
                }
              }
            } catch {
              // 忽略文件读取过程中的瞬态竞争
            }
          }, 150)
        }
      })
    } catch {
      // 忽略文件监听异常
    }
  }

  // 启动前去重 MPD 队列中的历史重复歌曲
  deduplicateQueue().catch(() => {})

  // 启动 MPD 实时播放状态监听轮询器 (500ms 刷新并广播变更)
  setInterval(broadcastStatus, 500)

  createWindow()

  // macOS: 点击 dock 图标时若无窗口则重建
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 除 macOS 外, 全部窗口关闭即退出 (重建窗口过程中忽略此事件)
app.on('window-all-closed', () => {
  if (isRecreatingWindow) return
  if (process.platform !== 'darwin') app.quit()
})
