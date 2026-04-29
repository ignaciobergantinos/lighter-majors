// ── WTI Floating Widget — Standalone WTI Long/Short window ──
'use client'
import { useCallback } from 'react'
import { Pin, PinOff, X } from 'lucide-react'
import { useTradeExecution } from '@/hooks/useTradeExecution'
import { usePriceFeed } from '@/hooks/usePriceFeed'
import { useWidgetStore } from '@/store/widget-store'
import { getElectronAPI } from '@/hooks/useElectron'
import { MARKETS } from '@/lib/constants'

export function WtiFloatingWidget() {
  const api = getElectronAPI()
  const { prices, wtiIsPinned, toggleWtiIsPinned, wtiUsdSize, setWtiUsdSize } = useWidgetStore()
  const { placeTrade, isTrading } = useTradeExecution()

  // Subscribe to live prices so cached WTI price stays fresh
  usePriceFeed()

  const handleTrade = useCallback(
    (side: 'long' | 'short') => {
      const usd = parseFloat(wtiUsdSize) || 0
      const tick = prices.WTI
      const price = tick ? parseFloat(tick.markPrice) : 0
      const market = MARKETS.WTI
      let baseAmount: number | undefined
      if (usd > 0 && price > 0) {
        const rounded = parseFloat((usd / price).toFixed(market.sizeDecimals))
        baseAmount = rounded >= market.minBaseAmount ? rounded : undefined
      }
      placeTrade({
        symbol: 'WTI',
        side,
        baseAmount,
        usdSize: usd || undefined,
        markPrice: price || undefined,
      })
    },
    [placeTrade, prices, wtiUsdSize],
  )

  return (
    <div className="flex flex-col h-screen rounded-2xl overflow-hidden border border-zinc-800/50 bg-zinc-950/95">
      {/* ── Drag bar with pin + close ──────────────────── */}
      <div
        className="flex items-center justify-between px-2 py-1 border-b border-zinc-800/60 shrink-0"
        style={{
          WebkitAppRegion: wtiIsPinned ? 'no-drag' : 'drag',
        } as React.CSSProperties}
      >
        <span className="text-[10px] font-semibold text-zinc-400 select-none">WTI</span>
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

      {/* ── Body ────────────────────────────────────────── */}
      <div className="flex-1 p-2 space-y-1.5">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 pointer-events-none">
            $
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={MARKETS.WTI.minQuote}
            step={1}
            value={wtiUsdSize}
            onChange={(e) => setWtiUsdSize(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder={String(MARKETS.WTI.minQuote)}
            aria-label={`WTI trade size in USD (min $${MARKETS.WTI.minQuote})`}
            className="w-full pl-5 pr-2 py-1.5 text-xs font-medium
                       bg-zinc-900 border border-zinc-800 rounded-lg
                       text-zinc-100 placeholder:text-zinc-600
                       focus:outline-none focus:border-zinc-600
                       [appearance:textfield]
                       [&::-webkit-outer-spin-button]:appearance-none
                       [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => handleTrade('long')}
            disabled={isTrading}
            className="py-1.5 text-[10px] font-bold rounded-lg
                       bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                       hover:bg-emerald-500/25 active:scale-[0.97]
                       disabled:opacity-40 transition-all truncate"
          >
            {isTrading ? '...' : 'WTI Long'}
          </button>
          <button
            onClick={() => handleTrade('short')}
            disabled={isTrading}
            className="py-1.5 text-[10px] font-bold rounded-lg
                       bg-red-500/15 text-red-400 border border-red-500/30
                       hover:bg-red-500/25 active:scale-[0.97]
                       disabled:opacity-40 transition-all truncate"
          >
            {isTrading ? '...' : 'WTI Short'}
          </button>
        </div>
      </div>
    </div>
  )
}
