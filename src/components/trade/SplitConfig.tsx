// ── Split Order Configuration Panel ─────────────────────────
'use client'
import { SPLIT_SYMBOLS, INVERSE_HEDGE_SYMBOLS } from '@/lib/constants'
import { useWidgetStore } from '@/store/widget-store'
import type { MarketSymbol } from '@/lib/types'

const COIN_COLORS: Record<MarketSymbol, { active: string; label: string }> = {
  BTC: { active: 'accent-orange-500', label: 'text-orange-400' },
  ETH: { active: 'accent-blue-500', label: 'text-blue-400' },
  SOL: { active: 'accent-purple-500', label: 'text-purple-400' },
  WTI: { active: 'accent-red-500', label: 'text-red-400' },
}

export function SplitConfig() {
  const {
    splitConfig,
    toggleSplitCoin,
    setSplitPct,
    wtiHedgeEnabled,
    toggleWtiHedge,
  } = useWidgetStore()

  const visibleSymbols = SPLIT_SYMBOLS.filter(
    (s) => !INVERSE_HEDGE_SYMBOLS.includes(s) || wtiHedgeEnabled,
  )
  const totalPct = visibleSymbols.reduce(
    (sum, s) => sum + (splitConfig[s].enabled ? splitConfig[s].pct : 0),
    0,
  )
  const isValid = totalPct === 100
  const enabledCount = visibleSymbols.filter((s) => splitConfig[s].enabled).length

  return (
    <div className="space-y-1.5 px-0.5">
      {/* WTI inverse-hedge master toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={wtiHedgeEnabled}
          onChange={toggleWtiHedge}
          className="w-3 h-3 rounded border-zinc-700 bg-zinc-900 cursor-pointer accent-red-500"
        />
        <span className="text-[10px] text-zinc-500">
          WTI hedge <span className="text-zinc-600">(inverse)</span>
        </span>
      </label>

      {visibleSymbols.map((symbol) => {
        const cfg = splitConfig[symbol]
        const colors = COIN_COLORS[symbol]
        const isInverse = INVERSE_HEDGE_SYMBOLS.includes(symbol)
        return (
          <div key={symbol} className="flex items-center gap-2">
            {/* Coin toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none min-w-[52px]">
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={() => toggleSplitCoin(symbol)}
                className={`w-3 h-3 rounded border-zinc-700 bg-zinc-900 cursor-pointer ${colors.active}`}
              />
              <span className={`text-[10px] font-semibold ${cfg.enabled ? colors.label : 'text-zinc-600'}`}>
                {symbol}
                {isInverse && (
                  <span className="ml-1 text-[8px] font-normal text-zinc-500">inv</span>
                )}
              </span>
            </label>

            {/* Percentage input */}
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={cfg.pct}
                disabled={!cfg.enabled}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                  setSplitPct(symbol, val)
                }}
                onFocus={(e) => e.target.select()}
                className="w-full pl-2 pr-5 py-1 text-[10px] font-medium
                           bg-zinc-900 border border-zinc-800 rounded
                           text-zinc-100 placeholder:text-zinc-600
                           focus:outline-none focus:border-zinc-600
                           disabled:opacity-30 disabled:cursor-not-allowed
                           [appearance:textfield]
                           [&::-webkit-outer-spin-button]:appearance-none
                           [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500 pointer-events-none">
                %
              </span>
            </div>
          </div>
        )
      })}

      {/* Validation feedback */}
      <div className="flex items-center justify-between pt-0.5">
        <span className={`text-[9px] font-medium ${isValid ? 'text-emerald-500/70' : 'text-red-400/80'}`}>
          {isValid ? '✓ 100%' : `${totalPct}% — ${totalPct < 100 ? `${100 - totalPct}% remaining` : `${totalPct - 100}% over`}`}
        </span>
        {enabledCount === 0 && (
          <span className="text-[9px] text-red-400/80">
            Enable at least 1 coin
          </span>
        )}
      </div>
    </div>
  )
}
