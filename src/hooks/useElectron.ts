// ── Electron Detection Hook ─────────────────────────────────
'use client'

/**
 * Returns true when running inside the Electron shell.
 * Safe to call in browser — returns false when window.electronAPI is absent.
 */
export function useIsElectron(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.electronAPI?.isElectron
}

/** Safe accessor for the Electron IPC bridge */
export function getElectronAPI(): Window['electronAPI'] | null {
  if (typeof window === 'undefined') return null
  return window.electronAPI ?? null
}
