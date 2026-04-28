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
      // Parallelize positions + realized_pnl baseline (both hit the same
      // endpoint but the parallel issue avoids paying RTT twice).
      const [account, realizedBefore] = await withTiming(
        log,
        'close.fetch_positions_and_baseline',
        {},
        () => Promise.all([fetchAccountData(cid), fetchRealizedPnlByMarket(cid)]),
      )
      const openPositions = [...account.positions]

      const results = await withTiming(
        log,
        'close.close_all',
        { positionCount: openPositions.length },
        () => closeAllPositions(cid, openPositions),
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

      // Detached: poll for realized PnL settlement, then notify Discord.
      // Returning the response immediately drops the API latency from
      // ~3.5s to ~1s; the notification fires when the data is ready.
      void (async () => {
        try {
          const realizedDiff = await pollRealizedDiff(
            realizedBefore,
            openPositions.map((p) => p.marketIndex),
            cid,
          )
          notifyCloseAll(openPositions, parsedPrices, realizedDiff)
        } catch (err) {
          log.error('close.notify_close_all_failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      })()

      return NextResponse.json({ success: true })
    }

    if (marketIndex === undefined) {
      log.warn('close.missing_params')
      return NextResponse.json(
        { success: false, error: 'marketIndex or closeAll required' },
        { status: 400 },
      )
    }

    // Parallelize position fetch + realized_pnl baseline.
    const [account, realizedBefore] = await withTiming(
      log,
      'close.fetch_position_and_baseline',
      { marketIndex },
      () => Promise.all([fetchAccountData(cid), fetchRealizedPnlByMarket(cid)]),
    )
    const position = account.positions.find((p) => p.marketIndex === marketIndex)

    if (!position) {
      log.warn('close.position_not_found', { marketIndex })
    }

    const result = await withTiming(
      log,
      'close.close_position',
      { marketIndex },
      () => closePosition(marketIndex, cid, position),
    )

    if (!result.success) {
      log.warn('close.order_rejected', { marketIndex, error: result.error })
      return NextResponse.json(result, { status: 422 })
    }

    if (position) {
      // Detached: poll for realized PnL settlement, then notify Discord.
      // The response returns immediately; notification fires once the data lands.
      void (async () => {
        try {
          const diff = await pollRealizedDiff(realizedBefore, [marketIndex], cid)
          notifyPositionClose({
            position,
            closingPrice: typeof markPrice === 'number' ? markPrice : undefined,
            realizedPnl: diff[marketIndex],
          })
        } catch (err) {
          log.error('close.notify_position_close_failed', {
            error: err instanceof Error ? err.message : String(err),
            marketIndex,
          })
        }
      })()
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
