// ── Keyboard Shortcut Settings ─────────────────────────────
import type { ShortcutBinding } from '@/lib/types'

const STORAGE_KEY = 'lighter-shortcuts'

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { key: '1', ctrl: true, label: 'Long BTC',  action: { type: 'trade', symbol: 'BTC', side: 'long' } },
  { key: '2', ctrl: true, label: 'Short BTC', action: { type: 'trade', symbol: 'BTC', side: 'short' } },
  { key: '3', ctrl: true, label: 'Long SOL',  action: { type: 'trade', symbol: 'SOL', side: 'long' } },
  { key: '4', ctrl: true, label: 'Short SOL', action: { type: 'trade', symbol: 'SOL', side: 'short' } },
  { key: '5', ctrl: true, label: 'Long ETH',  action: { type: 'trade', symbol: 'ETH', side: 'long' } },
  { key: '6', ctrl: true, label: 'Short ETH', action: { type: 'trade', symbol: 'ETH', side: 'short' } },
  { key: '0', ctrl: true, label: 'Close All', action: { type: 'close-all' } },
  { key: '`', ctrl: true, label: 'Toggle',    action: { type: 'toggle-widget' } },
]

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
