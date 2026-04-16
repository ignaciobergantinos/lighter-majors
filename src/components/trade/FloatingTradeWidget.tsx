// ── Floating Trade Widget (FAB + Panel) ─────────────────────
'use client'
import { TrendingUp, X } from 'lucide-react'
import { useWidgetStore } from '@/store/widget-store'
import { usePositions } from '@/hooks/usePositions'
import { useTradeExecution } from '@/hooks/useTradeExecution'
import { usePriceFeed } from '@/hooks/usePriceFeed'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { PairTabs } from './PairTabs'
import { PositionsList } from './PositionsList'
import { MARKETS } from '@/lib/constants'

export function FloatingTradeWidget() {
  const { isOpen, activeTab, prices, toggleWidget, setActiveTab } =
    useWidgetStore()
  const { positions, balance, aggregatePnl, isLoading } = usePositions()
  const { placeTrade, closeAll, closePosition, isTrading, isClosing } =
    useTradeExecution()

  usePriceFeed()
  useKeyboardShortcuts()

  const currentPrice = prices[activeTab]
  const market = MARKETS[activeTab]

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* ── Expanded Panel ─────────────────────────────────── */}
      {isOpen && (
        <div className="mb-3 w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400" />
              <span className="text-sm font-semibold text-zinc-200">
                Lighter
              </span>
            </div>
            <div className="flex items-center gap-3">
              {balance && (
                <span className="text-[10px] text-zinc-500">
                  ${parseFloat(balance.availableBalance).toFixed(2)}
                </span>
              )}
              <button
                onClick={toggleWidget}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {/* Pair Tabs */}
            <PairTabs active={activeTab} onSelect={setActiveTab} />

            {/* Price Display */}
            {currentPrice && (
              <div className="text-center py-1">
                <div className="text-lg font-bold text-zinc-100">
                  ${parseFloat(currentPrice.markPrice).toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500">
                  Index: ${parseFloat(currentPrice.indexPrice).toLocaleString()}
                  {' · '}
                  Funding: {currentPrice.fundingRate}%
                </div>
              </div>
            )}

            {/* Long / Short Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  placeTrade({ symbol: activeTab, side: 'long' })
                }
                disabled={isTrading}
                className="py-2.5 text-sm font-bold rounded-xl
                           bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                           hover:bg-emerald-500/25 active:scale-[0.98]
                           disabled:opacity-40 transition-all"
              >
                {isTrading ? '...' : `Long ${activeTab}`}
              </button>
              <button
                onClick={() =>
                  placeTrade({ symbol: activeTab, side: 'short' })
                }
                disabled={isTrading}
                className="py-2.5 text-sm font-bold rounded-xl
                           bg-red-500/15 text-red-400 border border-red-500/30
                           hover:bg-red-500/25 active:scale-[0.98]
                           disabled:opacity-40 transition-all"
              >
                {isTrading ? '...' : `Short ${activeTab}`}
              </button>
            </div>

            {/* Min order size hint */}
            <div className="text-center text-[10px] text-zinc-600">
              Min: {market.minBaseAmount} {activeTab} (~${market.minQuote})
            </div>

            {/* Positions */}
            {!isLoading && (
              <PositionsList
                positions={positions}
                aggregatePnl={aggregatePnl}
                onClosePosition={closePosition}
                onCloseAll={() => closeAll()}
                isClosing={isClosing}
              />
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
      >
        <TrendingUp size={22} className="text-white" />
      </button>
    </div>
  )
}
