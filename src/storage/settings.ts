// ── Keyboard Shortcut Settings ─────────────────────────────
import type { ShortcutBinding } from '@/lib/types'

const STORAGE_KEY = 'lighter-shortcuts'

// Global shortcuts (Ctrl+1 → Long, Ctrl+4 → Short) are handled by
// Electron's globalShortcut in main.ts. These web-level shortcuts
// are only active in the browser (non-Electron) fallback.
export const DEFAULT_SHORTCUTS: ShortcutBinding[] = []

export function loadShortcuts(): ShortcutBinding[] {
  if (typeof window === 'undefined') return DEFAULT_SHORTCUTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SHORTCUTS
    return JSON.parse(raw) as ShortcutBinding[]
  } catch {
    return DEFAULT_SHORTCUTS
  }
}

export function saveShortcuts(shortcuts: ShortcutBinding[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts))
}
