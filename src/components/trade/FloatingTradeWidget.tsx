// ── Floating Trade Widget — Compact 3-Row Layout ────────────
'use client'
import { useCallback, useRef } from 'react'
import { TrendingUp, X, Pin, PinOff } from 'lucide-react'
import { useWidgetStore } from '@/store/widget-store'
import { usePositions } from '@/hooks/usePositions'
import { useTradeExecution } from '@/hooks/useTradeExecution'
import { usePriceFeed } from '@/hooks/usePriceFeed'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { PairTabs } from './PairTabs'
import { MARKETS } from '@/lib/constants'
import type { MarketSymbol } from '@/lib/types'

export function FloatingTradeWidget() {
  const { isOpen, isPinned, activeTab, usdSizes, prices, toggleWidget, togglePinned, setActiveTab, setUsdSize } =
    useWidgetStore()
  const usdSize = usdSizes[activeTab]
  const { positions, balance, aggregatePnl, isLoading } = usePositions()
  const { placeTrade, closeAll, isTrading, isClosing } = useTradeExecution()
  const sizeInputRef = useRef<HTMLInputElement>(null)

  usePriceFeed()
  useKeyboardShortcuts()

  const market = MARKETS[activeTab]
  const currentPrice = prices[activeTab]

  /** Convert USD size to base amount using mark price, clamped to market minimum */
  const getBaseAmount = useCallback((): number | undefined => {
    const usd = parseFloat(usdSize)
    if (!usd || usd <= 0) return undefined
    const price = currentPrice ? parseFloat(currentPrice.markPrice) : 0
    if (price <= 0) return undefined
    const base = usd / price
    // Round to market's size decimals
    const rounded = parseFloat(base.toFixed(market.sizeDecimals))
    return rounded >= market.minBaseAmount ? rounded : undefined
  }, [usdSize, currentPrice, market])

  const markPrice = currentPrice ? parseFloat(currentPrice.markPrice) : 0

  const handleTrade = useCallback(
    (side: 'long' | 'short') => {
      placeTrade({
        symbol: activeTab,
        side,
        baseAmount: getBaseAmount(),
        usdSize: parseFloat(usdSize) || undefined,
        markPrice: markPrice || undefined,
      })
    },
    [placeTrade, activeTab, getBaseAmount, usdSize, markPrice],
  )

  const pnl = parseFloat(aggregatePnl || '0')
  const isProfit = pnl >= 0
  const hasPositions = positions.length > 0

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* ── Compact Panel ───────────────────────────────── */}
      {isOpen && (
        <div className="mb-3 w-[340px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Minimal header — just logo + close */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-400">
                Lighter
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={togglePinned}
                className={`p-0.5 rounded transition-colors ${
                  isPinned
                    ? 'text-emerald-400 hover:bg-emerald-500/15'
                    : 'text-zinc-500 hover:bg-zinc-800'
                }`}
                aria-label={isPinned ? 'Unpin widget' : 'Pin widget'}
                title={isPinned ? 'Unpin widget (allow repositioning)' : 'Pin widget (lock position)'}
              >
                {isPinned ? <Pin size={12} /> : <PinOff size={12} />}
              </button>
              <button
                onClick={toggleWidget}
                className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500"
                aria-label="Close widget"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            {/* ── Row 1: USD Size Input | Symbol Selector ── */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 pointer-events-none">
                  $
                </span>
                <input
                  ref={sizeInputRef}
                  type="number"
                  inputMode="decimal"
                  min={market.minQuote}
                  step={1}
                  value={usdSize}
                  onChange={(e) => setUsdSize(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder={String(market.minQuote)}
                  aria-label={`Trade size in USD (min $${market.minQuote})`}
                  className="w-full pl-6 pr-3 py-2 text-sm font-medium
                             bg-zinc-900 border border-zinc-800 rounded-lg
                             text-zinc-100 placeholder:text-zinc-600
                             focus:outline-none focus:border-zinc-600
                             [appearance:textfield]
                             [&::-webkit-outer-spin-button]:appearance-none
                             [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <PairTabs active={activeTab} onSelect={setActiveTab} compact />
            </div>

            {/* ── Row 2: Buy | Short | Close All ─────────── */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleTrade('long')}
                disabled={isTrading}
                className="py-2 text-xs font-bold rounded-lg
                           bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                           hover:bg-emerald-500/25 active:scale-[0.97]
                           disabled:opacity-40 transition-all"
              >
                {isTrading ? '...' : 'Buy'}
              </button>
              <button
                onClick={() => handleTrade('short')}
                disabled={isTrading}
                className="py-2 text-xs font-bold rounded-lg
                           bg-red-500/15 text-red-400 border border-red-500/30
                           hover:bg-red-500/25 active:scale-[0.97]
                           disabled:opacity-40 transition-all"
              >
                {isTrading ? '...' : 'Short'}
              </button>
              <button
                onClick={() => {
                  const markPrices: Record<number, number> = {}
                  for (const [sym, tick] of Object.entries(prices)) {
                    if (tick) {
                      const m = MARKETS[sym as MarketSymbol]
                      markPrices[m.marketIndex] = parseFloat(tick.markPrice)
                    }
                  }
                  closeAll({ markPrices })
                }}
                disabled={isClosing || !hasPositions}
                className="py-2 text-xs font-bold rounded-lg
                           bg-zinc-800 text-zinc-400 border border-zinc-700
                           hover:bg-zinc-700 hover:text-zinc-300
                           disabled:opacity-30 transition-all"
              >
                {isClosing ? '...' : 'Close All'}
              </button>
            </div>

            {/* ── Row 3: Balance | PnL ───────────────────── */}
            {!isLoading && (
              <div className="flex items-center justify-between px-1 py-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
                    Bal
                  </span>
                  <span className="text-xs font-medium text-zinc-300">
                    {balance
                      ? `$${parseFloat(balance.availableBalance).toFixed(2)}`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
                    PnL
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      hasPositions
                        ? isProfit
                          ? 'text-emerald-400'
                          : 'text-red-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {hasPositions
                      ? `${isProfit ? '+' : ''}$${pnl.toFixed(2)}`
                      : '$0.00'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB Button ─────────────────────────────────────── */}
      <button
        onClick={toggleWidget}
        className={`
          w-14 h-14 rounded-full shadow-lg shadow-black/40
          flex items-center justify-center transition-all duration-200
          ${
            isOpen
              ? 'bg-zinc-800 hover:bg-zinc-700'
              : 'bg-emerald-600 hover:bg-emerald-500 hover:scale-105'
          }
        `}
        title="Toggle Trade Widget (Ctrl+`)"
        aria-label="Toggle trade widget"
      >
        <TrendingUp size={22} className="text-white" />
      </button>
    </div>
  )
}
