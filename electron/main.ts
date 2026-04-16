// ── Electron Main Process — Floating Desktop Widget ─────────
import { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, globalShortcut } from 'electron'
import * as path from 'path'
import {
  loadWindowState,
  saveWindowState,
  clearWindowState,
  getDefaultBounds,
} from './window-state'

// ── Config ──────────────────────────────────────────────────
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
  // Restore saved position + dimensions, or fall back to defaults
  const savedBounds = loadWindowState()

  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
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
    minWidth: 150,
    minHeight: 150,
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

  // ── Persist position + dimensions on move / resize ───────
  // Use a debounce timer to avoid writing to disk on every pixel
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        saveWindowState(mainWindow.getBounds())
      }
    }, 500)
  }

  mainWindow.on('moved', debouncedSave)
  mainWindow.on('resized', debouncedSave)

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
        const defaults = getDefaultBounds()
        mainWindow?.setBounds(defaults)
        clearWindowState()
      },
    },
    {
      label: 'Reset Size',
      click: () => {
        const { width, height } = getDefaultBounds()
        mainWindow?.setSize(width, height)
        if (mainWindow && !mainWindow.isDestroyed()) {
          saveWindowState(mainWindow.getBounds())
        }
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

// ── Global Shortcuts (system-wide, work even when app is not focused) ──
const API_URL = 'http://localhost:3000'

function fireTrade(marketIndex: number, side: 'long' | 'short'): void {
  fetch(`${API_URL}/api/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketIndex, side }),
  }).catch((err) => {
    console.error(`[global-shortcut] trade failed:`, err)
  })
}

function registerGlobalShortcuts(): void {
  // Ctrl+1 (or Cmd+1 on Mac) → Long BTC (marketIndex 1)
  globalShortcut.register('CommandOrControl+1', () => {
    console.log('[global-shortcut] Ctrl+1 → Long BTC')
    fireTrade(1, 'long')
  })

  // Ctrl+3 (or Cmd+3 on Mac) → Long SOL (marketIndex 2)
  globalShortcut.register('CommandOrControl+3', () => {
    console.log('[global-shortcut] Ctrl+3 → Long SOL')
    fireTrade(2, 'long')
  })
}

app.whenReady().then(() => {
  createTray()
  createWindow()
  registerGlobalShortcuts()

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
