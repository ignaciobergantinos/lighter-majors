// ── POST /api/close — close position(s) ─────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { closePosition, closeAllPositions, fetchAccountData } from '@/lib/lighter-client'
import { notifyPositionClose, notifyCloseAll } from '@/lib/discord-notifier'
import { correlationId, createLogger, withTiming } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const cid = correlationId()
  const log = createLogger(cid)

  try {
    const { closeAll, marketIndex, markPrice, markPrices } = await req.json()

    if (closeAll) {
      // Capture positions before closing for Discord notifications
      const account = await withTiming(
        log,
        'close.fetch_positions',
        {},
        () => fetchAccountData(cid),
      )
      const openPositions = [...account.positions]

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
      notifyCloseAll(openPositions, parsedPrices)
      return NextResponse.json({ success: true })
    }

    if (marketIndex === undefined) {
      log.warn('close.missing_params')
      return NextResponse.json(
        { success: false, error: 'marketIndex or closeAll required' },
        { status: 400 },
      )
    }

    // Capture position before closing for Discord notification
    const account = await withTiming(
      log,
      'close.fetch_position',
      { marketIndex },
      () => fetchAccountData(cid),
    )
    const position = account.positions.find((p) => p.marketIndex === marketIndex)

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
      notifyPositionClose({
        position,
        closingPrice: typeof markPrice === 'number' ? markPrice : undefined,
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
