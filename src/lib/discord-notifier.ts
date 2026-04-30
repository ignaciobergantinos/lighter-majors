// ── Discord Webhook Notifications (fire-and-forget) ────────
import type { Position } from './types'

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

// ── Helpers ────────────────────────────────────────────────

function formatUsd(value: number): string {
  const sign = value >= 0 ? '' : '-'
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(4)}%`
}

function profitEmoji(value: number): string {
  return value >= 0 ? '🟢' : '🔴'
}

async function postToDiscord(content: string): Promise<void> {
  if (!WEBHOOK_URL) return

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) {
      console.error(`[discord] webhook failed: ${res.status} ${res.statusText}`)
    }
  } catch (err) {
    console.error('[discord] webhook error:', err instanceof Error ? err.message : err)
  }
}

// ── Public API ─────────────────────────────────────────────

/** Notify Discord when a position is closed with P&L details. Fire-and-forget.
 *  If `realizedPnl` is provided, use it (true realized PnL from Lighter).
 *  Otherwise fall back to the position's pre-close unrealized_pnl snapshot. */
export function notifyPositionClose(params: {
  position: Position
  closingPrice?: number
  realizedPnl?: number
}): void {
  const { position, realizedPnl } = params
  const sideLabel = position.side === 'long' ? 'LONG' : 'SHORT'
  const closeEmoji = '✖️'

  const pnl = realizedPnl ?? parseFloat(position.pnl || '0')
  const entryPrice = parseFloat(position.entryPrice || '0')
  const size = Math.abs(parseFloat(position.size || '0'))
  const notional = entryPrice * size
  const pctChange = notional > 0 ? (pnl / notional) * 100 : 0

  const lines = [
    `${closeEmoji} **[Lighter] ${sideLabel} ${position.symbol}** — ${formatUsd(notional)}`,
    `Profit: ${formatUsd(pnl)} (${formatPercent(pctChange)}) ${profitEmoji(pnl)}`,
  ]

  // Fire-and-forget — do not await
  void postToDiscord(lines.join('\n'))
}

/** Notify Discord when all positions are closed. Fire-and-forget. */
export function notifyCloseAll(
  positions: Position[],
  markPrices?: Record<number, number>,
  realizedPnlByMarket?: Record<number, number>,
): void {
  if (positions.length === 0) return

  for (const position of positions) {
    const closingPrice = markPrices?.[position.marketIndex]
    const realizedPnl = realizedPnlByMarket?.[position.marketIndex]
    notifyPositionClose({ position, closingPrice, realizedPnl })
  }
}
