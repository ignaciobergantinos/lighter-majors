// ── POST /api/close — close position(s) ─────────────────────
import { NextRequest, NextResponse } from 'next/server'
import {
  closePosition,
  closeAllPositions,
  fetchAccountData,
  fetchRealizedPnlByMarket,
} from '@/lib/lighter-client'
import { notifyPositionClose, notifyCloseAll } from '@/lib/discord-notifier'
import { correlationId, createLogger, withTiming } from '@/lib/logger'

// Poll Lighter after a close until realized_pnl moves for all target markets,
// so the notification reports the true realized PnL from the fill rather than
// the stale pre-close unrealized_pnl mark.
async function pollRealizedDiff(
  before: Record<number, number>,
  marketIndexes: number[],
  cid: string,
): Promise<Record<number, number>> {
  const MAX_ATTEMPTS = 10
  const INTERVAL_MS = 400
  const EPSILON = 1e-6

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS))
    const after = await fetchRealizedPnlByMarket(cid)
    const allMoved = marketIndexes.every(
      (m) => Math.abs((after[m] ?? 0) - (before[m] ?? 0)) > EPSILON,
    )
    if (allMoved) {
      const diff: Record<number, number> = {}
      for (const m of marketIndexes) {
        diff[m] = (after[m] ?? 0) - (before[m] ?? 0)
      }
      return diff
    }
  }
  // Timed out — return empty so notifier falls back to unrealized_pnl
  return {}
}

export async function POST(req: NextRequest) {
  const cid = correlationId()
  const log = createLogger(cid)

  try {
    const { closeAll, marketIndex, markPrice, markPrices } = await req.json()

    if (closeAll) {
      // Capture positions + realized_pnl baseline before closing
      const account = await withTiming(
        log,
        'close.fetch_positions',
        {},
        () => fetchAccountData(cid),
      )
      const openPositions = [...account.positions]
      const realizedBefore = await fetchRealizedPnlByMarket(cid)

      const results = await withTiming(
        log,
        'close.close_all',
        { positionCount: openPositions.length },
        () => closeAllPositions(cid),
      )
      const failed = results.filter((r) => !r.success)

      if (failed.length > 0) {
        log.warn('close.partial_failure', {
          total: results.length,
          failed: failed.length,
          errors: failed.map((f) => f.error),
        })
        return NextResponse.json(
          {
            success: false,
            error: `${failed.length} position(s) failed to close`,
            details: failed,
          },
          { status: 422 },
        )
      }

      const parsedPrices: Record<number, number> | undefined =
        markPrices && typeof markPrices === 'object' ? markPrices : undefined
      const realizedDiff = await pollRealizedDiff(
        realizedBefore,
        openPositions.map((p) => p.marketIndex),
        cid,
      )
      notifyCloseAll(openPositions, parsedPrices, realizedDiff)
      return NextResponse.json({ success: true })
    }

    if (marketIndex === undefined) {
      log.warn('close.missing_params')
      return NextResponse.json(
        { success: false, error: 'marketIndex or closeAll required' },
        { status: 400 },
      )
    }

    // Capture position + realized_pnl baseline before closing
    const account = await withTiming(
      log,
      'close.fetch_position',
      { marketIndex },
      () => fetchAccountData(cid),
    )
    const position = account.positions.find((p) => p.marketIndex === marketIndex)
    const realizedBefore = await fetchRealizedPnlByMarket(cid)

    if (!position) {
      log.warn('close.position_not_found', { marketIndex })
    }

    const result = await withTiming(
      log,
      'close.close_position',
      { marketIndex },
      () => closePosition(marketIndex, cid),
    )

    if (!result.success) {
      log.warn('close.order_rejected', { marketIndex, error: result.error })
      return NextResponse.json(result, { status: 422 })
    }

    if (position) {
      const diff = await pollRealizedDiff(realizedBefore, [marketIndex], cid)
      notifyPositionClose({
        position,
        closingPrice: typeof markPrice === 'number' ? markPrice : undefined,
        realizedPnl: diff[marketIndex],
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Close failed'
    log.error('close.unhandled_error', {
      error: msg,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
