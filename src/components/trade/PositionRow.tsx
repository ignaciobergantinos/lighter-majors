// ── Single Position Display ─────────────────────────────────
'use client'
import { X } from 'lucide-react'
import type { Position } from '@/lib/types'

interface PositionRowProps {
  position: Position
  onClose: (marketIndex: number) => void
  isClosing: boolean
}

export function PositionRow({ position, onClose, isClosing }: PositionRowProps) {
  const pnl = parseFloat(position.pnl)
  const isProfit = pnl >= 0

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-zinc-300">
          {position.symbol}
        </span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            position.side === 'long'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {position.side.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[10px] text-zinc-500">Size</div>
          <div className="text-xs text-zinc-300">{position.size}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-500">Entry</div>
          <div className="text-xs text-zinc-300">{position.entryPrice}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-500">PnL</div>
          <div
            className={`text-xs font-medium ${
              isProfit ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isProfit ? '+' : ''}${pnl.toFixed(2)}
          </div>
        </div>
        <button
          onClick={() => onClose(position.marketIndex)}
          disabled={isClosing}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400
                     disabled:opacity-40 transition-colors"
          title="Close position"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
