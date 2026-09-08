import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

import { loadConfig } from './config'
import { resolveWallpaperPayload } from './wallpaper'

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
            --wallpaper-image: url("${payload.dataUri}");
            --wallpaper-blur: ${payload.blur}px;
            --wallpaper-overlay-opacity: ${payload.overlayOpacity};
            --wallpaper-fit: ${payload.fit};
          }`
        )
        win.webContents.executeJavaScript(
          `document.documentElement.setAttribute('data-bg-mode', 'wallpaper');
           document.documentElement.removeAttribute('data-mica');`
        )
      } else {
        win.webContents.executeJavaScript(
          `document.documentElement.setAttribute('data-bg-mode', 'default');
           document.documentElement.removeAttribute('data-mica');`
        )
      }
    } else {
      win.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-bg-mode', 'default');
         document.documentElement.removeAttribute('data-mica');`
      )
    }

    // 注入左侧滑出气泡弹窗配置 (CSS 变量与触发参数)
    const { sidebar } = config.window
    if (sidebar.enabled) {
      win.webContents.insertCSS(
        `:root {
          --sidebar-width: ${sidebar.width}px;
          --sidebar-trigger-width: ${sidebar.triggerWidth}px;
          --sidebar-close-buffer: ${sidebar.closeBuffer}px;
          --sidebar-duration: ${sidebar.animationDuration}ms;
          --sidebar-easing: ${sidebar.animationEasing};
        }`
      )
      win.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-sidebar-enabled', 'true');
         document.documentElement.setAttribute('data-sidebar-trigger-delay', '${sidebar.triggerDelay}');
         document.documentElement.setAttribute('data-sidebar-close-delay', '${sidebar.closeDelay}');`
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
