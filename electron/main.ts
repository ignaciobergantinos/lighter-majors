// ── Electron Main Process — Floating Desktop Widget ─────────
import { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } from 'electron'
import * as path from 'path'

// ── Config ──────────────────────────────────────────────────
const WIDGET_WIDTH = 420
const WIDGET_HEIGHT = 680
const DEV_SERVER_URL = 'http://localhost:3000/desktop'
const IS_DEV = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ── Single Instance Lock ────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ── Create Main Window ──────────────────────────────────────
function createWindow(): void {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x: screenWidth - WIDGET_WIDTH - 24,
    y: screenHeight - WIDGET_HEIGHT - 24,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    hasShadow: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    titleBarStyle: 'hidden',
    minWidth: 340,
    minHeight: 400,
    maxWidth: 600,
    maxHeight: 900,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Load the desktop-optimized page
  if (IS_DEV) {
    mainWindow.loadURL(DEV_SERVER_URL)
  } else {
    // Production: load from the Next.js export/build
    mainWindow.loadFile(path.join(__dirname, '../out/desktop.html'))
  }

  // Prevent visual flash — show after content is painted
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Minimize to tray instead of closing on macOS
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && tray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
}

// ── System Tray ─────────────────────────────────────────────
function createTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png')
  try {
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) return icon.resize({ width: 16, height: 16 })
  } catch {
    // fall through to fallback
  }

  // Fallback: 16x16 green circle encoded as a data URL
  // This is a tiny valid PNG so the tray always has an icon
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
      'P0lEQVQ4T2NkYPj/n4EBCxg1gIGBgZGRkeE/AwMDIy4NjIyM/xkYGP7jUoNNA1YX' +
      'YNOATQNWF2DTgE0DPg0A7ggYESMpRnAAAAAASUVORK5CYII=',
  )
}

function createTray(): void {
  const trayIcon = createTrayIcon()

  tray = new Tray(trayIcon)
  tray.setToolTip('Lighter Majors — Trade Widget')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Widget',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        mainWindow?.setAlwaysOnTop(menuItem.checked)
      },
    },
    { type: 'separator' },
    {
      label: 'Reset Position',
      click: () => {
        const { width: sw, height: sh } =
          screen.getPrimaryDisplay().workAreaSize
        mainWindow?.setBounds({
          x: sw - WIDGET_WIDTH - 24,
          y: sh - WIDGET_HEIGHT - 24,
          width: WIDGET_WIDTH,
          height: WIDGET_HEIGHT,
        })
      },
    },
    {
      label: 'Reset Size',
      click: () => {
        mainWindow?.setSize(WIDGET_WIDTH, WIDGET_HEIGHT)
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
      click: () => {
        tray?.destroy()
        tray = null
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

// ── IPC Handlers ────────────────────────────────────────────
ipcMain.on('window:minimize-to-tray', () => {
  mainWindow?.hide()
})

ipcMain.on('app:quit', () => {
  tray?.destroy()
  tray = null
  app.quit()
})

app.whenReady().then(() => {
  createTray()
  createWindow()

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
