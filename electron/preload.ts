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
})
