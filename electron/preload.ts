// ── Electron Preload — Secure IPC Bridge ────────────────────
import { contextBridge, ipcRenderer } from 'electron'

/**
 * Exposes a minimal, type-safe API to the renderer process.
 * All methods use IPC channels — no direct Node.js access.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Minimize the window to the system tray */
  minimizeToTray: () => ipcRenderer.send('window:minimize-to-tray'),

  /** Close the application */
  quit: () => ipcRenderer.send('app:quit'),

  /** Check if running inside Electron */
  isElectron: true as const,

  /** OS platform — used to adjust layout for macOS traffic-light buttons */
  platform: process.platform,

  /** Push current widget state so global shortcuts use the selected symbol + size */
  syncWidgetState: (state: { activeTab: string; usdSize: string; markPrice?: number }) =>
    ipcRenderer.send('widget:state-sync', state),

  /** Listen for global shortcut registration status from main process */
  onShortcutsStatus: (callback: (status: { active: boolean; reason?: string; shortcuts?: Record<string, boolean> }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: { active: boolean; reason?: string; shortcuts?: Record<string, boolean> }) => callback(status)
    ipcRenderer.on('shortcuts:status', listener)
    return () => ipcRenderer.removeListener('shortcuts:status', listener)
  },

  /** Load persisted user preferences from disk (async) */
  loadPreferences: (): Promise<Record<string, unknown> | null> =>
    ipcRenderer.invoke('preferences:load'),

  /** Save user preferences to disk (fire-and-forget) */
  savePreferences: (prefs: Record<string, unknown>) =>
    ipcRenderer.send('preferences:save', prefs),
})
