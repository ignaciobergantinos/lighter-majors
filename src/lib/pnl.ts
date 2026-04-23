// ── Live PnL Helpers ─────────────────────────────────────────
import type { MarketSymbol, Position, PriceTick } from '@/lib/types'

/** Unrealized PnL for a position given a live mark price. */
export function computeUnrealizedPnl(position: Position, markPrice: number): number {
  const size = parseFloat(position.size)
  const entry = parseFloat(position.entryPrice)
  if (!Number.isFinite(size) || !Number.isFinite(entry) || markPrice <= 0) {
    return parseFloat(position.pnl) || 0
  }
  const sign = position.side === 'long' ? 1 : -1
  return (markPrice - entry) * Math.abs(size) * sign
}

/** Pick the live mark price for a position's symbol, falling back to its server pnl. */
export function livePnlFor(
  position: Position,
  prices: Record<MarketSymbol, PriceTick | null>,
): number {
  const tick = prices[position.symbol]
  const mark = tick ? parseFloat(tick.markPrice) : 0
  if (mark > 0) return computeUnrealizedPnl(position, mark)
  return parseFloat(position.pnl) || 0
}

/** Aggregate live PnL across all positions. */
export function aggregateLivePnl(
  positions: Position[],
  prices: Record<MarketSymbol, PriceTick | null>,
): number {
  return positions.reduce((sum, pos) => sum + livePnlFor(pos, prices), 0)
}
