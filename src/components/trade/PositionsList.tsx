// ── Positions List + Close All ───────────────────────────────
'use client'
import type { Position } from '@/lib/types'
import { PositionRow } from './PositionRow'
import { useWidgetStore } from '@/store/widget-store'
import { aggregateLivePnl } from '@/lib/pnl'

interface PositionsListProps {
  positions: Position[]
  onClosePosition: (marketIndex: number) => void
  onCloseAll: () => void
  isClosing: boolean
}

export function PositionsList({
  positions,
  onClosePosition,
  onCloseAll,
  isClosing,
}: PositionsListProps) {
  const prices = useWidgetStore((s) => s.prices)
  const pnl = aggregateLivePnl(positions, prices)
  const isProfit = pnl >= 0

  if (positions.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-zinc-600">
        No open positions
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
          Positions ({positions.length})
        </span>
        <span
          className={`text-xs font-semibold ${
            isProfit ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          PnL: {isProfit ? '+' : ''}${pnl.toFixed(2)}
        </span>
      </div>

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {positions.map((pos) => (
          <PositionRow
            key={`${pos.marketIndex}-${pos.side}`}
            position={pos}
            onClose={onClosePosition}
            isClosing={isClosing}
          />
        ))}
      </div>

      <button
        onClick={onCloseAll}
        disabled={isClosing}
        className="w-full py-1.5 text-xs font-medium rounded-lg
                   bg-red-500/10 text-red-400 border border-red-500/20
                   hover:bg-red-500/20 disabled:opacity-40 transition-colors"
      >
        {isClosing ? 'Closing...' : 'Close All Positions'}
      </button>
    </div>
  )
}
