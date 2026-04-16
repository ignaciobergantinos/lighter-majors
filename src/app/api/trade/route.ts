// ── POST /api/trade — place a market order ──────────────────
import { NextRequest, NextResponse } from 'next/server'
import { placeMarketOrder } from '@/lib/lighter-client'
import { MARKETS } from '@/lib/constants'
import { notifyPositionOpen } from '@/lib/discord-notifier'
import { correlationId, createLogger, withTiming } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const cid = correlationId()
  const log = createLogger(cid)

  try {
    const { marketIndex, side, baseAmount: customBaseAmount, markPrice } = await req.json()

    // Validate market
    const market = Object.values(MARKETS).find(
      (m) => m.marketIndex === marketIndex,
    )
    if (!market) {
      log.warn('trade.invalid_market', { marketIndex })
      return NextResponse.json(
        { success: false, error: 'Invalid market' },
        { status: 400 },
      )
    }

    const isAsk = side === 'short'
    const baseAmount =
      typeof customBaseAmount === 'number' && customBaseAmount >= market.minBaseAmount
        ? customBaseAmount
        : market.minBaseAmount

    const result = await withTiming(
      log,
      'trade.place_order',
      { marketIndex, isAsk, baseAmount },
      () => placeMarketOrder(marketIndex, isAsk, baseAmount, cid),
    )

    if (!result.success) {
      log.warn('trade.order_rejected', { error: result.error })
      return NextResponse.json(result, { status: 400 })
    }

    notifyPositionOpen({
      marketIndex,
      side,
      baseAmount,
      price: typeof markPrice === 'number' ? markPrice : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Trade failed'
    log.error('trade.unhandled_error', {
      error: msg,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
