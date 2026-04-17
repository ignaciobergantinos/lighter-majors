// ── Floating Trade Widget — Compact 3-Row Layout ────────────
'use client'
import { useCallback, useMemo, useRef } from 'react'
import { TrendingUp, X, Pin, PinOff } from 'lucide-react'
import { useWidgetStore } from '@/store/widget-store'
import { usePositions } from '@/hooks/usePositions'
import { useTradeExecution } from '@/hooks/useTradeExecution'
import { usePriceFeed } from '@/hooks/usePriceFeed'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAutoSize } from '@/hooks/useAutoSize'
import { PairTabs } from './PairTabs'
import { SplitConfig } from './SplitConfig'
import { MARKETS, MARKET_SYMBOLS } from '@/lib/constants'
import type { MarketSymbol } from '@/lib/types'

export function FloatingTradeWidget() {
  const { isOpen, isPinned, activeTab, usdSizes, prices, autoSizeEnabled, splitEnabled, splitConfig, toggleWidget, togglePinned, setActiveTab, setUsdSize, toggleAutoSize, toggleSplit } =
    useWidgetStore()
  const usdSize = usdSizes[activeTab]
  const { positions, balance, aggregatePnl, isLoading } = usePositions()
  const { placeTrade, placeSplitTrade, closeAll, closePosition, isTrading, isClosing } = useTradeExecution()
  const sizeInputRef = useRef<HTMLInputElement>(null)

  usePriceFeed()
  useKeyboardShortcuts()
  useAutoSize(balance)

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
      if (splitEnabled) {
        const totalUsd = parseFloat(usdSize) || 0
        const mps: Partial<Record<MarketSymbol, number>> = {}
        for (const [sym, tick] of Object.entries(prices)) {
          if (tick) mps[sym as MarketSymbol] = parseFloat(tick.markPrice)
        }
        placeSplitTrade({ side, totalUsdSize: totalUsd, markPrices: mps, splitConfig })
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
    [placeTrade, placeSplitTrade, splitEnabled, splitConfig, activeTab, getBaseAmount, usdSize, markPrice, prices],
  )

  const pnl = parseFloat(aggregatePnl || '0')
  const isProfit = pnl >= 0
  const hasPositions = positions.length > 0

  // ── Position Exposure & Leverage ──────────────────────
  const { totalExposure, leverageMultiplier } = useMemo(() => {
    if (!hasPositions || !balance) return { totalExposure: 0, leverageMultiplier: 0 }
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

  /** Text color: yellow if MIX or >42x, red if SHORT, green otherwise */
  const getExposureTextColor = () => {
    if (positionDirection === 'MIX' || leverageMultiplier >= 42) return 'text-yellow-400'
    if (positionDirection === 'SHORT') return 'text-red-400'
    return 'text-emerald-400'
  }

  const getExposureBg = () => {
    if (!hasPositions) return 'bg-zinc-950 border-zinc-800'
    if (positionDirection === 'MIX' || leverageMultiplier >= 42) return 'bg-yellow-950/30 border-yellow-800/40'
    if (positionDirection === 'SHORT') return 'bg-red-950/40 border-red-800/50'
    return 'bg-emerald-950/20 border-emerald-800/30'
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* ── Compact Panel ───────────────────────────────── */}
      {isOpen && (
        <div className={`mb-3 w-[340px] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden border transition-colors duration-500 ${getExposureBg()}`}>
          {/* Minimal header — just logo + close */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-400">
                Lighter
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Position Exposure — shown when positions are open */}
              {hasPositions && totalExposure > 0 && leverageMultiplier > 0 && (
                <span
                  className={`text-[9px] font-semibold mr-1 select-none ${getExposureTextColor()}`}
                  title={`Total exposure: $${totalExposure.toFixed(0)} — Leverage: ${leverageMultiplier.toFixed(2)}× balance`}
                >
                  ${totalExposure.toFixed(0)}{' '}
                  <span className="opacity-75">(x{leverageMultiplier.toFixed(2)})</span>
                  {positionDirection && (
                    <span className="ml-1">
                      {positionDirection}
                    </span>
                  )}
                </span>
              )}
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
              <PairTabs active={activeTab} onSelect={setActiveTab} compact disabled={splitEnabled} />
            </div>

            {/* Auto-size toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSizeEnabled}
                onChange={toggleAutoSize}
                className="w-3 h-3 rounded border-zinc-700 bg-zinc-900 text-emerald-500
                           accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-zinc-500">
                Auto-size (40×)
              </span>
            </label>

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

            {/* ── Open Positions ────────────────────────────── */}
            {hasPositions && (
              <div className="border-t border-zinc-800/60 pt-2">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-zinc-600 uppercase tracking-wide">
                      <th className="text-left font-medium pb-1">Symbol</th>
                      <th className="text-right font-medium pb-1">Size</th>
                      <th className="text-right font-medium pb-1">PnL</th>
                      <th className="w-5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => {
                      const posPnl = parseFloat(pos.pnl)
                      const tick = prices[pos.symbol]
                      const mp = tick ? parseFloat(tick.markPrice) : undefined
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
            <div className="border-t border-zinc-800/60 pt-2">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={toggleSplit}
                  className="w-3 h-3 rounded border-zinc-700 bg-zinc-900 text-amber-500
                             accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] text-zinc-500">
                  Split
                </span>
                {splitEnabled && (
                  <span className="text-[9px] text-amber-500/70">
                    {MARKET_SYMBOLS.filter((s) => splitConfig[s].enabled).map((s) => `${splitConfig[s].pct}${s[0]}`).join('/')}
                  </span>
                )}
              </label>
              {splitEnabled && (
                <div className="mt-2">
                  <SplitConfig />
                </div>
              )}
            </div>
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
