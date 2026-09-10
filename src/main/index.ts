import { existsSync, watch } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, protocol, net, ipcMain } from 'electron'

import { loadConfig, getDefaultConfigPath } from './config'
import { EXT_TO_MIME, resolveWallpaperPayload } from './wallpaper'
import { IPC_CHANNELS } from './ipc-channels'
import type { PlaybackMode } from '../types/music'
import {
  addToQueue,
  clearQueue,
  deduplicateQueue,
  getLibrary,
  getOrExtractAlbumCover,
  getQueue,
  getSongLyrics,
  getStatus,
  moveQueueItem,
  nextSong,
  pausePlayback,
  playQueueItem,
  playSong,
  prevSong,
  removeQueueItem,
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

function createWindow(): void {
  // 读取运行时配置, 判定是否开启沉浸式效果
  const config = loadConfig()
  const isImmersive = config.window.immersive

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

  // 页面加载完成后, 根据配置注入相应的窗口背景效果 (云母、自定义壁纸或默认基底)
  win.webContents.on('did-finish-load', () => {
    const { background } = config.window

    if (background.mode === 'mica') {
      const { grainOpacity, tintOpacity, edgeHighlight, style, border } = background.mica
      win.webContents.insertCSS(
        `:root {
          --mica-grain-opacity: ${grainOpacity};
          --mica-tint-opacity: ${tintOpacity};
          --mica-edge-highlight: ${edgeHighlight};
        }`
      )
      win.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-bg-mode', 'mica');
         document.documentElement.setAttribute('data-mica', 'true');
         document.documentElement.setAttribute('data-mica-style', '${style}');
         document.documentElement.setAttribute('data-mica-border', '${border}');`
      )
    } else if (background.mode === 'wallpaper') {
      const payload = resolveWallpaperPayload(background.wallpaper)
      if (payload) {
        win.webContents.insertCSS(
          `:root {
            --wallpaper-image: url("${payload.mediaUrl}");
            --wallpaper-media-url: url("${payload.mediaUrl}");
            --wallpaper-blur: ${payload.blur}px;
            --wallpaper-overlay-opacity: ${payload.overlayOpacity};
            --wallpaper-fit: ${payload.fit};
          }`
        )
        win.webContents.executeJavaScript(
          `document.documentElement.setAttribute('data-bg-mode', 'wallpaper');
           document.documentElement.setAttribute('data-wallpaper-type', '${payload.mediaType}');
           document.documentElement.setAttribute('data-wallpaper-url', '${payload.mediaUrl}');
           document.documentElement.setAttribute('data-wallpaper-blur', '${payload.blur}');
           document.documentElement.setAttribute('data-wallpaper-overlay-opacity', '${payload.overlayOpacity}');
           document.documentElement.setAttribute('data-wallpaper-fit', '${payload.fit}');
           document.documentElement.setAttribute('data-wallpaper-muted', '${payload.muted}');
           document.documentElement.setAttribute('data-wallpaper-loop', '${payload.loop}');
           document.documentElement.setAttribute('data-wallpaper-playback-rate', '${payload.playbackRate}');
           document.documentElement.removeAttribute('data-mica');`
        )
      } else {
        win.webContents.executeJavaScript(
          `document.documentElement.setAttribute('data-bg-mode', 'default');
           document.documentElement.removeAttribute('data-wallpaper-type');
           document.documentElement.removeAttribute('data-wallpaper-url');
           document.documentElement.removeAttribute('data-mica');`
        )
      }
    } else {
      win.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-bg-mode', 'default');
         document.documentElement.removeAttribute('data-wallpaper-type');
         document.documentElement.removeAttribute('data-wallpaper-url');
         document.documentElement.removeAttribute('data-mica');`
      )
    }

    // 注入明暗主题与微调配置 (CSS 变量与 HTML 属性)
    const { theme, sidebar } = config.window
    win.webContents.insertCSS(
      `:root {
        --theme-mode: ${theme.mode};
        --theme-brightness: ${theme.brightness};
        --theme-contrast: ${theme.contrast};
      }`
    )
    win.webContents.executeJavaScript(
      `document.documentElement.setAttribute('data-theme', '${theme.mode}');
       document.documentElement.setAttribute('data-theme-brightness', '${theme.brightness}');
       document.documentElement.setAttribute('data-theme-contrast', '${theme.contrast}');`
    )

    // 注入左侧滑出气泡弹窗配置 (CSS 变量与触发参数)
    if (sidebar.enabled) {
      win.webContents.insertCSS(
        `:root {
          --sidebar-opacity: ${sidebar.opacity};
          --sidebar-bg: rgba(14, 16, 24, ${sidebar.opacity});
          --sidebar-bg-hover: rgba(18, 21, 32, ${Math.min(1, sidebar.opacity + 0.08)});
          --sidebar-bg-expanded: rgba(12, 14, 22, ${Math.min(1, sidebar.opacity + 0.12)});
          --sidebar-width: ${sidebar.width}px;
          --sidebar-trigger-width: ${sidebar.triggerWidth}px;
          --sidebar-close-buffer: ${sidebar.closeBuffer}px;
          --sidebar-vertical-extension: ${sidebar.verticalExtension}px;
          --sidebar-duration: ${sidebar.animationDuration}ms;
          --sidebar-easing: ${sidebar.animationEasing};
        }`
      )
      win.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-sidebar-enabled', 'true');
         document.documentElement.setAttribute('data-sidebar-opacity', '${sidebar.opacity}');
         document.documentElement.setAttribute('data-sidebar-glow-hint', '${sidebar.glowHint}');
         document.documentElement.setAttribute('data-sidebar-trigger-delay', '${sidebar.triggerDelay}');
         document.documentElement.setAttribute('data-sidebar-close-delay', '${sidebar.closeDelay}');
         document.documentElement.setAttribute('data-sidebar-close-buffer', '${sidebar.closeBuffer}');
         document.documentElement.setAttribute('data-sidebar-vertical-extension', '${sidebar.verticalExtension}');`
      )
    } else {
      win.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-sidebar-enabled', 'false');`
      )
    }
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

    // 场景 1: 音频内嵌封面提取与本地缓存服务 (app-media://cover/...)
    if (url.startsWith('app-media://cover/')) {
      const rawRel = url.slice('app-media://cover/'.length)
      const relPath = decodeURIComponent(rawRel)
      const coverPath = await getOrExtractAlbumCover(relPath)
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

  const broadcastStatus = async (): Promise<void> => {
    try {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0 && !windows[0].isDestroyed()) {
        const status = await getStatus()
        windows[0].webContents.send(IPC_CHANNELS.MPD_STATUS_CHANGED, status)
      }
    } catch {
      // 忽略广播异常
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

  // 获取当前应用运行时全局配置
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async () => {
    return loadConfig()
  })

  // 监听配置文件变更并向渲染层广播热更新
  const configFilePath = getDefaultConfigPath()
  let configDebounceTimer: ReturnType<typeof setTimeout> | null = null
  if (existsSync(configFilePath)) {
    try {
      watch(configFilePath, () => {
        if (configDebounceTimer) clearTimeout(configDebounceTimer)
        configDebounceTimer = setTimeout(() => {
          try {
            const updatedConfig = loadConfig()
            const windows = BrowserWindow.getAllWindows()
            if (windows.length > 0 && !windows[0].isDestroyed()) {
              windows[0].webContents.send(IPC_CHANNELS.CONFIG_CHANGED, updatedConfig)
            }
          } catch {
            // 忽略文件读取过程中的瞬态竞争
          }
        }, 150)
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

// 除 macOS 外, 全部窗口关闭即退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
