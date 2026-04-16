// ── Keyboard Shortcuts Hook ─────────────────────────────────
'use client'
import { useEffect, useState } from 'react'
import { loadShortcuts, saveShortcuts } from '@/storage/settings'
import type { ShortcutBinding } from '@/lib/types'
import { useTradeExecution } from './useTradeExecution'
import { useWidgetStore } from '@/store/widget-store'

export function useKeyboardShortcuts() {
  const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>(loadShortcuts)
  const { placeTrade, closeAll } = useTradeExecution()
  const toggleWidget = useWidgetStore((s) => s.toggleWidget)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return

      const match = shortcuts.find(
        (s) => s.key === e.key && s.ctrl === (e.ctrlKey || e.metaKey),
      )
      if (!match) return

      e.preventDefault()
      const { action } = match

      switch (action.type) {
        case 'trade':
          placeTrade({
            symbol: action.symbol,
            side: action.side,
          })
          break
        case 'close-all':
          closeAll(undefined)
          break
        case 'toggle-widget':
          toggleWidget()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, placeTrade, closeAll, toggleWidget])

  function updateShortcuts(next: ShortcutBinding[]) {
    setShortcuts(next)
    saveShortcuts(next)
  }

  return { shortcuts, updateShortcuts }
}
