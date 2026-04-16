// ── Electron IPC API Type Declarations ──────────────────────
/** Exposed by electron/preload.ts via contextBridge */
interface ShortcutsStatus {
  active: boolean
  reason?: string
  shortcuts?: Record<string, boolean>
}

interface ElectronAPI {
  minimizeToTray: () => void
  quit: () => void
  isElectron: true
  platform: NodeJS.Platform
  syncWidgetState: (state: { activeTab: string; usdSize: string; markPrice?: number }) => void
  onShortcutsStatus: (callback: (status: ShortcutsStatus) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
