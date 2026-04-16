// ── Electron Main Process — Floating Desktop Widget ─────────
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  screen,
  ipcMain,
  globalShortcut,
  systemPreferences,
  dialog,
} from 'electron'
import * as path from 'path'
import {
  loadWindowState,
  saveWindowState,
  clearWindowState,
  getDefaultBounds,
} from './window-state'
import {
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from './preferences-store'

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

// ── Preferences Persistence (file-backed) ──────────────────
ipcMain.handle('preferences:load', () => {
  return loadPreferences()
})

ipcMain.on('preferences:save', (_event, prefs: UserPreferences) => {
  savePreferences(prefs)
})

// ── Global Shortcuts (system-wide, work even when app is not focused) ──
const API_URL = 'http://localhost:3000'
const LIGHTER_API = 'https://mainnet.zklighter.elliot.ai'
const PRICE_POLL_MS = 60_000 // 1 minute

// Market config mirrored from constants.ts (main process can't import renderer code)
const MARKETS: Record<string, { marketIndex: number; minBaseAmount: number; sizeDecimals: number; priceDecimals: number }> = {
  BTC: { marketIndex: 1, minBaseAmount: 0.0002, sizeDecimals: 5, priceDecimals: 1 },
  ETH: { marketIndex: 0, minBaseAmount: 0.005, sizeDecimals: 4, priceDecimals: 2 },
  SOL: { marketIndex: 2, minBaseAmount: 0.05, sizeDecimals: 3, priceDecimals: 3 },
}

// Cached widget state from renderer — updated via IPC
let widgetState = { activeTab: 'BTC', usdSize: '10', markPrice: 0 }

// Cached prices per symbol — fetched independently from Lighter REST API
const cachedPrices: Record<string, number> = { BTC: 0, ETH: 0, SOL: 0 }
let pricePollTimer: ReturnType<typeof setInterval> | null = null

/** Fetch the current mark price for a symbol from the Lighter REST API */
async function fetchPrice(symbol: string): Promise<number> {
  const market = MARKETS[symbol]
  if (!market) return 0

  try {
    const url = `${LIGHTER_API}/api/v1/orderBookDetails?market_id=${market.marketIndex}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.error(`[price-feed] fetch failed for ${symbol}: ${res.status}`)
      return cachedPrices[symbol] || 0
    }
    const data = await res.json()
    const details = data.order_book_details?.[0] ?? data
    const price = parseFloat(details.mark_price ?? details.last_trade_price ?? '0')
    if (price > 0) {
      cachedPrices[symbol] = price
      console.log(`[price-feed] ${symbol} = $${price}`)
    }
    return price
  } catch (err) {
    console.error(`[price-feed] error fetching ${symbol}:`, err instanceof Error ? err.message : err)
    return cachedPrices[symbol] || 0
  }
}

/** Fetch price for the currently selected symbol */
async function fetchActivePrice(): Promise<void> {
  const symbol = widgetState.activeTab
  const price = await fetchPrice(symbol)
  if (price > 0) {
    widgetState.markPrice = price
  }
}

/** Fetch prices for all symbols (used on startup) */
async function fetchAllPrices(): Promise<void> {
  await Promise.all(Object.keys(MARKETS).map(fetchPrice))
  // Update widgetState with the active symbol's price
  const activePrice = cachedPrices[widgetState.activeTab]
  if (activePrice > 0) {
    widgetState.markPrice = activePrice
  }
}

/** Start polling prices every minute */
function startPricePolling(): void {
  if (pricePollTimer) clearInterval(pricePollTimer)
  // Fetch immediately on start
  fetchAllPrices()
  // Then poll every minute
  pricePollTimer = setInterval(fetchActivePrice, PRICE_POLL_MS)
}

ipcMain.on('widget:state-sync', (_event, state: { activeTab: string; usdSize: string; markPrice?: number }) => {
  const prevTab = widgetState.activeTab
  widgetState = { ...widgetState, ...state }

  // If renderer sends a valid price, update our cache too
  if (state.markPrice && state.markPrice > 0) {
    cachedPrices[widgetState.activeTab] = state.markPrice
  }

  // On symbol change: use cached price immediately, then refresh from API
  if (state.activeTab && state.activeTab !== prevTab) {
    const cached = cachedPrices[state.activeTab]
    if (cached > 0) {
      widgetState.markPrice = cached
    }
    // Fetch fresh price in background
    fetchActivePrice()
  }

  // On size change: ensure we have a price (fetch if missing)
  if (widgetState.markPrice <= 0) {
    fetchActivePrice()
  }
})

function fireTrade(side: 'long' | 'short'): void {
  const market = MARKETS[widgetState.activeTab]
  if (!market) {
    console.error(`[global-shortcut] Unknown market: ${widgetState.activeTab}`)
    return
  }

  // Use our own cached price (more reliable than renderer sync)
  const usdSize = parseFloat(widgetState.usdSize) || 0
  const price = widgetState.markPrice || cachedPrices[widgetState.activeTab] || 0
  let baseAmount: number | undefined
  if (price > 0 && usdSize > 0) {
    const raw = usdSize / price
    const rounded = parseFloat(raw.toFixed(market.sizeDecimals))
    baseAmount = rounded >= market.minBaseAmount ? rounded : undefined
  }

  console.log(`[global-shortcut] ${side.toUpperCase()} ${widgetState.activeTab} — $${usdSize} @ $${price} (~${baseAmount?.toFixed(market.sizeDecimals) ?? 'min'} ${widgetState.activeTab})`)

  fetch(`${API_URL}/api/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      marketIndex: market.marketIndex,
      side,
      ...(baseAmount != null && { baseAmount }),
      ...(usdSize > 0 && { usdSize }),
      ...(price > 0 && { markPrice: price }),
    }),
  }).catch((err) => {
    console.error(`[global-shortcut] trade failed:`, err)
  })
}

/**
 * On macOS, global shortcuts require Accessibility permission.
 * Prompt the user if permission hasn't been granted yet.
 * Returns true if permission is granted (or not macOS).
 */
function ensureAccessibilityPermission(): boolean {
  if (process.platform !== 'darwin') return true

  const isTrusted = systemPreferences.isTrustedAccessibilityClient(false)
  if (isTrusted) return true

  console.warn('[global-shortcut] Accessibility permission not granted — prompting user')

  // Show explanation dialog, then trigger the OS permission prompt
  dialog.showMessageBoxSync({
    type: 'info',
    title: 'Accessibility Permission Required',
    message: 'Lighter Majors needs Accessibility permission to register global keyboard shortcuts (Ctrl+1, Ctrl+3) that work from any app.',
    detail: 'Click OK to open System Settings. Add this app under Privacy & Security → Accessibility, then restart the app.',
    buttons: ['OK'],
  })

  // This call with `true` triggers the macOS permission prompt / System Settings
  systemPreferences.isTrustedAccessibilityClient(true)
  return false
}

function registerGlobalShortcuts(): void {
  const hasPermission = ensureAccessibilityPermission()
  if (!hasPermission) {
    console.warn('[global-shortcut] Shortcuts not registered — waiting for Accessibility permission. Restart app after granting.')
    // Notify renderer that shortcuts are inactive
    mainWindow?.webContents.send('shortcuts:status', { active: false, reason: 'accessibility-permission' })
    return
  }

  // Ctrl+1 → Long (selected symbol + size)
  const longOk = globalShortcut.register('Control+1', () => {
    console.log('[global-shortcut] Ctrl+1 → LONG')
    fireTrade('long')
  })

  if (!longOk) {
    console.error('[global-shortcut] Failed to register Control+1')
  } else {
    console.log('[global-shortcut] ✓ Registered Control+1 → Long')
  }

  // Ctrl+3 → Short (selected symbol + size)
  const shortOk = globalShortcut.register('Control+3', () => {
    console.log('[global-shortcut] Ctrl+3 → SHORT')
    fireTrade('short')
  })

  if (!shortOk) {
    console.error('[global-shortcut] Failed to register Control+3')
  } else {
    console.log('[global-shortcut] ✓ Registered Control+3 → Short')
  }

  const longRegistered = globalShortcut.isRegistered('Control+1')
  const shortRegistered = globalShortcut.isRegistered('Control+3')

  console.log(`[global-shortcut] Verified: Ctrl+1=${longRegistered}, Ctrl+3=${shortRegistered}`)

  mainWindow?.webContents.send('shortcuts:status', {
    active: longRegistered && shortRegistered,
    shortcuts: {
      'Control+1': longRegistered,
      'Control+3': shortRegistered,
    },
  })
}

app.whenReady().then(() => {
  createTray()
  createWindow()
  registerGlobalShortcuts()
  startPricePolling() // Fetch prices on startup + poll every 60s

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
  if (pricePollTimer) clearInterval(pricePollTimer)
})
