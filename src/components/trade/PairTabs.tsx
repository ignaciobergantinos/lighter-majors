// ── Compact Inline Symbol Selector ──────────────────────────
'use client'
import { MARKET_SYMBOLS } from '@/lib/constants'
import type { MarketSymbol } from '@/lib/types'

/** Short labels for ultra-compact mode */
const SHORT_LABELS: Record<MarketSymbol, string> = {
  BTC: 'B',
  ETH: 'E',
  SOL: 'S',
}

interface PairTabsProps {
  active: MarketSymbol
  onSelect: (symbol: MarketSymbol) => void
  /** Compact mode renders smaller pills for inline use */
  compact?: boolean
  /** Ultra-compact: single-letter labels, minimal padding */
  ultraCompact?: boolean
}

const PILL_COLORS: Record<MarketSymbol, string> = {
  BTC: 'data-[active=true]:bg-orange-500/20 data-[active=true]:text-orange-400',
  ETH: 'data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-400',
  SOL: 'data-[active=true]:bg-purple-500/20 data-[active=true]:text-purple-400',
}

export function PairTabs({ active, onSelect, compact, ultraCompact }: PairTabsProps) {
  return (
    <div
      className={`flex gap-0.5 bg-zinc-900 ${compact ? 'p-0.5 rounded-lg' : 'p-1 rounded-lg'}`}
      role="tablist"
      aria-label="Trading pair"
    >
      {MARKET_SYMBOLS.map((symbol) => (
        <button
          key={symbol}
          role="tab"
          aria-selected={active === symbol}
          data-active={active === symbol}
          onClick={() => onSelect(symbol)}
          className={`
            ${ultraCompact
              ? 'px-1.5 py-1 text-[10px]'
              : compact
                ? 'px-2.5 py-1.5 text-[11px]'
                : 'flex-1 px-3 py-1.5 text-xs'}
            font-semibold rounded-md transition-all duration-150
            text-zinc-500 hover:text-zinc-300
            ${PILL_COLORS[symbol]}
          `}
          title={symbol}
        >
          {ultraCompact ? SHORT_LABELS[symbol] : symbol}
        </button>
      ))}
    </div>
  )
}
