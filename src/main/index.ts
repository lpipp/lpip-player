import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

// 窗口形态: system | frameless | frameless-transparent
// M0 阶段先用系统边框跑通, 后续做成可切换配置
const FRAME_MODE: 'system' | 'frameless' = 'system'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    frame: FRAME_MODE !== 'system',
    backgroundColor: '#0a0a0f',
    title: 'mpd-glass',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
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
