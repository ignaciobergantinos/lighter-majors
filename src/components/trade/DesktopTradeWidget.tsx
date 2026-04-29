// ── Desktop Trade Widget — Full-window, no FAB ─────────────
// Responsive layout that adapts to very small viewport sizes
'use client'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useWidgetStore } from '@/store/widget-store'
import { usePositions } from '@/hooks/usePositions'
import { useTradeExecution } from '@/hooks/useTradeExecution'
import { usePriceFeed } from '@/hooks/usePriceFeed'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAutoSize } from '@/hooks/useAutoSize'
import { useViewportSize } from '@/hooks/useViewportSize'
import { PairTabs } from './PairTabs'
import { SplitConfig } from './SplitConfig'
import { DesktopTitleBar } from './DesktopTitleBar'
import { MARKETS, SPLIT_SYMBOLS, INVERSE_HEDGE_SYMBOLS } from '@/lib/constants'
import type { MarketSymbol } from '@/lib/types'
import { aggregateLivePnl, livePnlFor } from '@/lib/pnl'

export function DesktopTradeWidget() {
  const { activeTab, usdSizes, prices, autoSizeEnabled, splitEnabled, splitConfig, wtiHedgeEnabled, setActiveTab, setUsdSize, toggleAutoSize, toggleSplit } =
    useWidgetStore()
  const usdSize = usdSizes[activeTab]
  const { positions, balance, isLoading } = usePositions()
  const { placeTrade, placeSplitTrade, closeAll, closePosition, isTrading, isClosing } = useTradeExecution()
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
      splitEnabled,
      splitConfig,
      wtiHedgeEnabled,
    })
  }, [activeTab, usdSize, markPrice, splitEnabled, splitConfig, wtiHedgeEnabled])

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
      if (splitEnabled) {
        const totalUsd = parseFloat(usdSize) || 0
        const mps: Partial<Record<MarketSymbol, number>> = {}
        for (const [sym, tick] of Object.entries(prices)) {
          if (tick) mps[sym as MarketSymbol] = parseFloat(tick.markPrice)
        }
        placeSplitTrade({ side, totalUsdSize: totalUsd, markPrices: mps, splitConfig, wtiHedgeEnabled })
      } else {
        placeTrade({
          symbol: activeTab,
          side,
          baseAmount: getBaseAmount(),
          usdSize: parseFloat(usdSize) || undefined,
          markPrice: markPrice || undefined,
        })
      }
    },
    [placeTrade, placeSplitTrade, splitEnabled, splitConfig, wtiHedgeEnabled, activeTab, getBaseAmount, usdSize, markPrice, prices],
  )

  const pnl = useMemo(() => aggregateLivePnl(positions, prices), [positions, prices])
  const isProfit = pnl >= 0
  const hasPositions = positions.length > 0

  // ── Position Exposure & Leverage ──────────────────────
  const { totalExposure, leverageMultiplier } = useMemo(() => {
    if (!hasPositions || !balance) return { totalExposure: 0, leverageMultiplier: 0 }
    // Sum each position's USD value: |size| × price
    // Use mark price from WebSocket when available, fall back to entry price
    const total = positions.reduce((sum, pos) => {
      const tick = prices[pos.symbol]
      const mp = tick ? parseFloat(tick.markPrice) : 0
      const price = mp > 0 ? mp : parseFloat(pos.entryPrice) || 0
      return sum + Math.abs(parseFloat(pos.size)) * price
    }, 0)
    const bal = parseFloat(balance.availableBalance) || 1
    return { totalExposure: total, leverageMultiplier: total / bal }
  }, [positions, prices, balance, hasPositions])

  // Aggregate direction: all long → LONG, all short → SHORT, mixed → MIX
  const positionDirection = useMemo((): 'LONG' | 'SHORT' | 'MIX' | undefined => {
    if (!hasPositions) return undefined
    const sides = new Set(positions.map((p) => p.side))
    if (sides.size === 1) return sides.has('long') ? 'LONG' : 'SHORT'
    return 'MIX'
  }, [positions, hasPositions])

  /** Background tint: yellow if MIX or >42x, red if SHORT, green otherwise */
  const getExposureBg = () => {
    if (!hasPositions) return 'bg-zinc-950/95 border-zinc-800/50'
    if (positionDirection === 'MIX' || leverageMultiplier >= 42) return 'bg-yellow-950/30 border-yellow-800/40'
    if (positionDirection === 'SHORT') return 'bg-red-950/40 border-red-800/50'
    return 'bg-emerald-950/20 border-emerald-800/30'
  }

  return (
    <div className={`flex flex-col h-screen rounded-2xl overflow-hidden border transition-colors duration-500 ${getExposureBg()}`}>
      {/* ── Draggable Titlebar ─────────────────────────── */}
      <DesktopTitleBar
        compact={isCompact}
        totalExposure={totalExposure}
        leverageMultiplier={leverageMultiplier}
        hasPositions={hasPositions}
        positionDirection={positionDirection}
      />

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
            disabled={splitEnabled}
          />
        </div>

        {/* Auto-size toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none px-0.5">
          <input
            type="checkbox"
            checked={autoSizeEnabled}
            onChange={toggleAutoSize}
            className="w-3 h-3 rounded border-zinc-700 bg-zinc-900 text-emerald-500
                       accent-emerald-500 cursor-pointer"
          />
          <span className="text-[9px] sm:text-[10px] text-zinc-500">
            Auto-size (40×)
          </span>
        </label>

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

        {/* ── Open Positions ────────────────────────────── */}
        {hasPositions && (
          <div className="border-t border-zinc-800/60 pt-1.5 sm:pt-2">
            <table className={`w-full ${isShortHeight ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>
              <thead>
                <tr className="text-zinc-600 uppercase tracking-wide">
                  <th className="text-left font-medium pb-0.5 sm:pb-1">Symbol</th>
                  <th className="text-right font-medium pb-0.5 sm:pb-1">Size</th>
                  <th className="text-right font-medium pb-0.5 sm:pb-1">PnL</th>
                  <th className="w-5"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => {
                  const tick = prices[pos.symbol]
                  const mp = tick ? parseFloat(tick.markPrice) : undefined
                  const posPnl = livePnlFor(pos, prices)
                  return (
                    <tr key={pos.marketIndex}>
                      <td className="text-left text-zinc-300 py-0.5">
                        {pos.symbol}
                        <span className={`ml-1 ${pos.side === 'long' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {pos.side === 'long' ? 'L' : 'S'}
                        </span>
                      </td>
                      <td className="text-right text-zinc-400 py-0.5">
                        ${(() => {
                          const price = mp && mp > 0 ? mp : parseFloat(pos.entryPrice) || 0
                          return (Math.abs(parseFloat(pos.size)) * price).toFixed(2)
                        })()}
                      </td>
                      <td className={`text-right font-medium py-0.5 ${posPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {posPnl >= 0 ? '+' : ''}${posPnl.toFixed(2)}
                      </td>
                      <td className="text-right py-0.5">
                        <button
                          onClick={() => closePosition({ marketIndex: pos.marketIndex, markPrice: mp })}
                          disabled={isClosing}
                          className="text-zinc-600 hover:text-red-400 disabled:opacity-30 transition-colors px-0.5"
                          title={`Close ${pos.symbol} position`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Split Settings ────────────────────────────── */}
        <div className="border-t border-zinc-800/60 pt-1.5 sm:pt-2">
          <label className="flex items-center gap-1.5 cursor-pointer select-none px-0.5">
            <input
              type="checkbox"
              checked={splitEnabled}
              onChange={toggleSplit}
              className="w-3 h-3 rounded border-zinc-700 bg-zinc-900 text-amber-500
                         accent-amber-500 cursor-pointer"
            />
            <span className="text-[9px] sm:text-[10px] text-zinc-500">
              Split
            </span>
            {splitEnabled && (
              <span className="text-[8px] sm:text-[9px] text-amber-500/70">
                {SPLIT_SYMBOLS
                  .filter((s) => (!INVERSE_HEDGE_SYMBOLS.includes(s) || wtiHedgeEnabled) && splitConfig[s].enabled)
                  .map((s) => `${INVERSE_HEDGE_SYMBOLS.includes(s) ? '-' : ''}${splitConfig[s].pct}${s[0]}`)
                  .join('/')}
              </span>
            )}
          </label>
          {splitEnabled && (
            <div className="mt-1.5">
              <SplitConfig />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
