// ── Electron IPC API Type Declarations ──────────────────────
/** Exposed by electron/preload.ts via contextBridge */
interface ElectronAPI {
  minimizeToTray: () => void
  quit: () => void
  isElectron: true
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
