// ── Discord Webhook Notifications (fire-and-forget) ────────
import { MARKETS } from './constants'
import type { MarketSymbol, Position } from './types'

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

// ── Helpers ────────────────────────────────────────────────

function resolveSymbol(marketIndex: number): MarketSymbol {
  for (const m of Object.values(MARKETS)) {
    if (m.marketIndex === marketIndex) return m.symbol
  }
  return 'BTC'
}

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

// ── Deduplication ─────────────────────────────────────────
// Track last notified filledUsd per market to skip duplicate notifications
// when the filled qty hasn't changed (e.g. order still partially filled).
const lastNotifiedFill = new Map<number, number>()

// ── Public API ─────────────────────────────────────────────

/** Notify Discord when a position is opened. Fire-and-forget.
 *  Skips notification if filledUsd is identical to the last one for this market. */
export function notifyPositionOpen(params: {
  marketIndex: number
  side: 'long' | 'short'
  baseAmount: number
  usdSize?: number
  price?: number
  filledUsd?: number
}): void {
  // Dedup: skip if filled amount hasn't changed since last notification
  if (params.filledUsd != null && params.filledUsd > 0) {
    const prev = lastNotifiedFill.get(params.marketIndex)
    if (prev != null && Math.abs(prev - params.filledUsd) < 0.01) {
      console.log(`[discord] skipping duplicate notification for market ${params.marketIndex} — filledUsd unchanged (${params.filledUsd})`)
      return
    }
    lastNotifiedFill.set(params.marketIndex, params.filledUsd)
  }
  const symbol = resolveSymbol(params.marketIndex)
  const sideLabel = params.side === 'long' ? 'LONG' : 'SHORT'
  const emoji = params.side === 'long' ? '🟢' : '🔴'

  const requested = params.usdSize ?? (params.price ? params.baseAmount * params.price : null)
  const filled = params.filledUsd

  let sizeText: string
  if (filled != null && filled > 0) {
    const requestedText = requested != null ? ` ($${Math.round(requested)})` : ''
    sizeText = `$${filled.toFixed(2)} FILLED${requestedText}`
  } else {
    sizeText = requested != null ? `$${requested.toFixed(2)}` : `${params.baseAmount} ${symbol}`
  }

  const message = `${emoji} **[Lighter] ${sideLabel} ${symbol}** — ${sizeText}`

  // Fire-and-forget — do not await
  void postToDiscord(message)
}

/** Notify Discord when a position is closed with P&L details. Fire-and-forget. */
export function notifyPositionClose(params: {
  position: Position
  closingPrice?: number
}): void {
  const { position } = params
  // Clear dedup state so next open on this market notifies fresh
  lastNotifiedFill.delete(position.marketIndex)
  const sideLabel = position.side === 'long' ? 'LONG' : 'SHORT'
  const closeEmoji = '✖️'

  const pnl = parseFloat(position.pnl || '0')
  const entryPrice = parseFloat(position.entryPrice || '0')
  const size = Math.abs(parseFloat(position.size || '0'))
  const notional = entryPrice * size
  const pctChange = notional > 0 ? (pnl / notional) * 100 : 0

  // Use closing price for volume if available, otherwise entry price
  const closingPrice = params.closingPrice ?? entryPrice
  const closeNotional = closingPrice * size

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
): void {
  if (positions.length === 0) return

  for (const position of positions) {
    const closingPrice = markPrices?.[position.marketIndex]
    notifyPositionClose({ position, closingPrice })
  }
}
