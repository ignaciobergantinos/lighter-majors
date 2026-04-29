// ── WTI Floating Widget — Standalone WTI Long/Short window ──
'use client'
import { useCallback } from 'react'
import { Pin, PinOff, X } from 'lucide-react'
import { useTradeExecution } from '@/hooks/useTradeExecution'
import { usePriceFeed } from '@/hooks/usePriceFeed'
import { usePositions } from '@/hooks/usePositions'
import { useWidgetStore } from '@/store/widget-store'
import { getElectronAPI } from '@/hooks/useElectron'
import { MARKETS, WTI_SIZE_MULTIPLIER } from '@/lib/constants'

export function WtiFloatingWidget() {
  const api = getElectronAPI()
  const { prices, wtiIsPinned, toggleWtiIsPinned } = useWidgetStore()
  const { placeTrade, isTrading } = useTradeExecution()
  const { balance } = usePositions()

  // Subscribe to live prices so cached WTI price stays fresh
  usePriceFeed()

  // Always trade WTI at balance × 20 — no manual size input.
  const balanceUsd = balance ? parseFloat(balance.availableBalance) || 0 : 0
  const usdSize = Math.floor(balanceUsd * WTI_SIZE_MULTIPLIER)

  const handleTrade = useCallback(
    (side: 'long' | 'short') => {
      const tick = prices.WTI
      const price = tick ? parseFloat(tick.markPrice) : 0
      const market = MARKETS.WTI
      let baseAmount: number | undefined
      if (usdSize > 0 && price > 0) {
        const rounded = parseFloat((usdSize / price).toFixed(market.sizeDecimals))
        baseAmount = rounded >= market.minBaseAmount ? rounded : undefined
      }
      placeTrade({
        symbol: 'WTI',
        side,
        baseAmount,
        usdSize: usdSize || undefined,
        markPrice: price || undefined,
      })
    },
    [placeTrade, prices, usdSize],
  )

  const sizeReady = usdSize >= MARKETS.WTI.minQuote
  const disabled = isTrading || !sizeReady

  return (
    <div className="flex flex-col h-screen rounded-2xl overflow-hidden border border-zinc-800/50 bg-zinc-950/95">
      {/* ── Drag bar with size badge + pin + close ─────── */}
      <div
        className="flex items-center justify-between px-2 py-1 border-b border-zinc-800/60 shrink-0"
        style={{
          WebkitAppRegion: wtiIsPinned ? 'no-drag' : 'drag',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-1.5 min-w-0 select-none">
          <span className="text-[10px] font-semibold text-zinc-400">WTI</span>
          <span
            className="text-[10px] font-medium text-zinc-300 truncate"
            title={`${WTI_SIZE_MULTIPLIER}× available balance`}
          >
            {sizeReady ? `$${usdSize}` : '—'}
          </span>
          <span className="text-[9px] text-zinc-600">×{WTI_SIZE_MULTIPLIER}</span>
        </div>
        <div
          className="flex items-center gap-0.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={toggleWtiIsPinned}
            className={`p-0.5 rounded transition-colors ${
              wtiIsPinned
                ? 'text-emerald-400 hover:bg-emerald-500/15'
                : 'text-zinc-500 hover:bg-zinc-800'
            }`}
            aria-label={wtiIsPinned ? 'Unpin WTI window' : 'Pin WTI window'}
            title={wtiIsPinned ? 'Unpin (allow repositioning)' : 'Pin (lock position)'}
          >
            {wtiIsPinned ? <Pin size={11} /> : <PinOff size={11} />}
          </button>
          <button
            onClick={() => api?.minimizeToTray()}
            className="p-0.5 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
            aria-label="Hide WTI window"
            title="Hide (use tray menu to bring back)"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* ── Buttons fill all remaining space ────────────── */}
      <div className="flex-1 grid grid-cols-2 gap-1.5 p-1.5 min-h-0">
        <button
          onClick={() => handleTrade('long')}
          disabled={disabled}
          className="h-full text-base sm:text-lg font-extrabold tracking-wide rounded-xl
                     bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                     hover:bg-emerald-500/25 active:scale-[0.97]
                     disabled:opacity-40 transition-all"
        >
          {isTrading ? '...' : 'LONG'}
        </button>
        <button
          onClick={() => handleTrade('short')}
          disabled={disabled}
          className="h-full text-base sm:text-lg font-extrabold tracking-wide rounded-xl
                     bg-red-500/15 text-red-400 border border-red-500/30
                     hover:bg-red-500/25 active:scale-[0.97]
                     disabled:opacity-40 transition-all"
        >
          {isTrading ? '...' : 'SHORT'}
        </button>
      </div>
    </div>
  )
}
