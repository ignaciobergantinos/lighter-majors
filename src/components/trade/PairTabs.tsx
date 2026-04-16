// ── BTC / ETH / SOL Tab Selector ────────────────────────────
'use client'
import { MARKET_SYMBOLS } from '@/lib/constants'
import type { MarketSymbol } from '@/lib/types'

interface PairTabsProps {
  active: MarketSymbol
  onSelect: (symbol: MarketSymbol) => void
}

const TAB_COLORS: Record<MarketSymbol, string> = {
  BTC: 'data-[active=true]:bg-orange-500/20 data-[active=true]:text-orange-400 data-[active=true]:border-orange-500',
  ETH: 'data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-400 data-[active=true]:border-blue-500',
  SOL: 'data-[active=true]:bg-purple-500/20 data-[active=true]:text-purple-400 data-[active=true]:border-purple-500',
}

export function PairTabs({ active, onSelect }: PairTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg">
      {MARKET_SYMBOLS.map((symbol) => (
        <button
          key={symbol}
          data-active={active === symbol}
          onClick={() => onSelect(symbol)}
          className={`
            flex-1 px-3 py-1.5 text-xs font-semibold rounded-md
            border border-transparent transition-all duration-150
            text-zinc-500 hover:text-zinc-300
            ${TAB_COLORS[symbol]}
          `}
        >
          {symbol}
        </button>
      ))}
    </div>
  )
}
