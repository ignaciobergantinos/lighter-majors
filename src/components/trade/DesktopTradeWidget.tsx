// ── Desktop Trade Widget — Full-window, no FAB ─────────────
// Responsive layout that adapts to very small viewport sizes
'use client'
import { useCallback, useEffect, useRef } from 'react'
import { useWidgetStore } from '@/store/widget-store'
import { usePositions } from '@/hooks/usePositions'
import { useTradeExecution } from '@/hooks/useTradeExecution'
import { usePriceFeed } from '@/hooks/usePriceFeed'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAutoSize } from '@/hooks/useAutoSize'
import { useViewportSize } from '@/hooks/useViewportSize'
import { PairTabs } from './PairTabs'
import { DesktopTitleBar } from './DesktopTitleBar'
import { MARKETS } from '@/lib/constants'
import type { MarketSymbol } from '@/lib/types'

export function DesktopTradeWidget() {
  const { activeTab, usdSizes, prices, setActiveTab, setUsdSize } =
    useWidgetStore()
  const usdSize = usdSizes[activeTab]
  const { positions, balance, aggregatePnl, isLoading } = usePositions()
  const { placeTrade, closeAll, isTrading, isClosing } = useTradeExecution()
  const sizeInputRef = useRef<HTMLInputElement>(null)
  const { isUltraCompact, isCompact, isShortHeight } = useViewportSize()

  usePriceFeed()
  useKeyboardShortcuts()
  useAutoSize(balance)

  const market = MARKETS[activeTab]
  const currentPrice = prices[activeTab]

  // Sync widget state to Electron main process for global shortcuts
  const markPrice = currentPrice ? parseFloat(currentPrice.markPrice) : 0
  useEffect(() => {
    window.electronAPI?.syncWidgetState({
      activeTab,
      usdSize,
      markPrice: markPrice || undefined,
    })
  }, [activeTab, usdSize, markPrice])

  const getBaseAmount = useCallback((): number | undefined => {
    const usd = parseFloat(usdSize)
    if (!usd || usd <= 0) return undefined
    const price = currentPrice ? parseFloat(currentPrice.markPrice) : 0
    if (price <= 0) return undefined
    const base = usd / price
    const rounded = parseFloat(base.toFixed(market.sizeDecimals))
    return rounded >= market.minBaseAmount ? rounded : undefined
  }, [usdSize, currentPrice, market])

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
    <div className="flex flex-col h-screen bg-zinc-950/95 rounded-2xl overflow-hidden border border-zinc-800/50">
      {/* ── Draggable Titlebar ─────────────────────────── */}
      <DesktopTitleBar compact={isCompact} />

      {/* ── Trade Panel ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 sm:space-y-2.5">
        {/* Row 1: USD Size Input | Symbol Selector
            Stacks vertically at ultra-compact widths */}
        <div className={`flex gap-1.5 sm:gap-2 ${isUltraCompact ? 'flex-col' : 'items-center'}`}>
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 pointer-events-none">
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
              className="w-full pl-5 pr-2 py-1.5 sm:py-2 text-xs sm:text-sm font-medium
                         bg-zinc-900 border border-zinc-800 rounded-lg
                         text-zinc-100 placeholder:text-zinc-600
                         focus:outline-none focus:border-zinc-600
                         [appearance:textfield]
                         [&::-webkit-outer-spin-button]:appearance-none
                         [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <PairTabs
            active={activeTab}
            onSelect={setActiveTab}
            compact
            ultraCompact={isUltraCompact}
          />
        </div>

        {/* Row 2: Buy | Short | Close All
            At ultra-compact width, stack Buy/Short on one row, Close All below */}
        <div className={`grid gap-1 sm:gap-1.5 ${isUltraCompact ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <button
            onClick={() => handleTrade('long')}
            disabled={isTrading}
            className="py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-lg
                       bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                       hover:bg-emerald-500/25 active:scale-[0.97]
                       disabled:opacity-40 transition-all truncate"
          >
            {isTrading ? '...' : 'Buy'}
          </button>
          <button
            onClick={() => handleTrade('short')}
            disabled={isTrading}
            className="py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-lg
                       bg-red-500/15 text-red-400 border border-red-500/30
                       hover:bg-red-500/25 active:scale-[0.97]
                       disabled:opacity-40 transition-all truncate"
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
            className={`py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-lg
                       bg-zinc-800 text-zinc-400 border border-zinc-700
                       hover:bg-zinc-700 hover:text-zinc-300
                       disabled:opacity-30 transition-all truncate
                       ${isUltraCompact ? 'col-span-2' : ''}`}
          >
            {isClosing ? '...' : 'Close'}
          </button>
        </div>

        {/* Row 3: Balance | PnL — always visible, condensed at short heights */}
        {!isLoading && (
          <div className={`flex items-center ${
            isShortHeight
              ? 'gap-2 px-0.5 py-0'
              : `px-0.5 py-0.5 sm:px-1 sm:py-1 ${
                  isCompact ? 'flex-col items-start gap-0.5' : 'justify-between'
                }`
          }`}>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className={`${isShortHeight ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'} text-zinc-600 uppercase tracking-wide`}>
                Bal
              </span>
              <span className={`${isShortHeight ? 'text-[9px]' : 'text-[10px] sm:text-xs'} font-medium text-zinc-300`}>
                {balance
                  ? `$${parseFloat(balance.availableBalance).toFixed(2)}`
                  : '---'}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className={`${isShortHeight ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'} text-zinc-600 uppercase tracking-wide`}>
                PnL
              </span>
              <span
                className={`${isShortHeight ? 'text-[9px]' : 'text-[10px] sm:text-xs'} font-semibold ${
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
  )
}
