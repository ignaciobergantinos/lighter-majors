// ── Keyboard Shortcuts Hook ─────────────────────────────────
'use client'
import { useEffect, useState } from 'react'
import { loadShortcuts, saveShortcuts } from '@/storage/settings'
import type { ShortcutBinding, MarketSymbol } from '@/lib/types'
import { useTradeExecution } from './useTradeExecution'
import { useWidgetStore } from '@/store/widget-store'
import { MARKETS } from '@/lib/constants'
import { playShortcutSound } from '@/lib/audio'

export function useKeyboardShortcuts() {
  const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>(loadShortcuts)
  const { placeTrade, closeAll } = useTradeExecution()
  const toggleWidget = useWidgetStore((s) => s.toggleWidget)
  const { activeTab, usdSizes, prices, soundEnabled } = useWidgetStore()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return

      const match = shortcuts.find(
        (s) => s.key === e.key && s.ctrl === (e.ctrlKey || e.metaKey),
      )
      if (!match) return

      e.preventDefault()
      if (soundEnabled) playShortcutSound()
      const { action } = match

      switch (action.type) {
        case 'trade': {
          const symbol = action.symbol ?? activeTab
          const market = MARKETS[symbol as MarketSymbol]
          const currentPrice = prices[symbol as MarketSymbol]
          const usdSize = parseFloat(usdSizes[symbol as MarketSymbol]) || undefined
          const mark = currentPrice ? parseFloat(currentPrice.markPrice) : 0

          let baseAmount: number | undefined
          if (usdSize && mark > 0) {
            const base = usdSize / mark
            const rounded = parseFloat(base.toFixed(market.sizeDecimals))
            baseAmount = rounded >= market.minBaseAmount ? rounded : undefined
          }

          placeTrade({
            symbol: symbol as MarketSymbol,
            side: action.side,
            baseAmount,
            usdSize,
            markPrice: mark || undefined,
          })
          break
        }
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
  }, [shortcuts, placeTrade, closeAll, toggleWidget, activeTab, usdSizes, prices, soundEnabled])

  // Also play the tick when Electron's global shortcuts fire (system-wide, window unfocused).
  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined
    if (!api?.onShortcutFired) return
    const off = api.onShortcutFired(() => {
      if (soundEnabled) playShortcutSound()
    })
    return off
  }, [soundEnabled])

  function updateShortcuts(next: ShortcutBinding[]) {
    setShortcuts(next)
    saveShortcuts(next)
  }

  return { shortcuts, updateShortcuts }
}
