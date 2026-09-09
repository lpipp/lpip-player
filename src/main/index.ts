import { existsSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, protocol, net } from 'electron'

import { loadConfig } from './config'
import { EXT_TO_MIME, resolveWallpaperPayload } from './wallpaper'

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
  // 注册特权流式本地媒体协议处理器 (支持图片与大尺寸视频 Range 请求零内存拷贝)
  protocol.handle('app-media', async (request) => {
    let filePath = decodeURIComponent(request.url.replace(/^app-media:\/\//, ''))
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
