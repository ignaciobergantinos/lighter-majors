// ── POST /api/trade — place a market order ──────────────────
import { NextRequest, NextResponse } from 'next/server'
import { placeMarketOrder, fetchAccountData, fetchMarkPrice } from '@/lib/lighter-client'
import { MARKETS } from '@/lib/constants'
import { notifyPositionOpen } from '@/lib/discord-notifier'
import { correlationId, createLogger, withTiming } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const cid = correlationId()
  const log = createLogger(cid)

  try {
    const { marketIndex, side, baseAmount: customBaseAmount, markPrice, usdSize: requestUsdSize } = await req.json()

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

    // Resolve base amount: explicit baseAmount > usdSize/markPrice > usdSize + REST-fetched price.
    // Fetching server-side ensures we never silently shrink to minBaseAmount when the
    // renderer's WS feed hasn't populated the symbol yet (the source of the WTI $9.96 bug).
    let baseAmount: number
    let priceForSizing: number = typeof markPrice === 'number' && markPrice > 0 ? markPrice : 0
    if (typeof customBaseAmount === 'number' && customBaseAmount >= market.minBaseAmount) {
      baseAmount = customBaseAmount
    } else if (typeof requestUsdSize === 'number' && requestUsdSize > 0) {
      if (priceForSizing <= 0) {
        priceForSizing = await fetchMarkPrice(marketIndex)
      }
      if (priceForSizing <= 0) {
        log.warn('trade.no_price_available', { marketIndex, requestUsdSize })
        return NextResponse.json(
          { success: false, error: 'No price available for market — try again in a moment' },
          { status: 503 },
        )
      }
      const computed = requestUsdSize / priceForSizing
      const rounded = parseFloat(computed.toFixed(market.sizeDecimals))
      baseAmount = rounded >= market.minBaseAmount ? rounded : market.minBaseAmount
    } else {
      baseAmount = market.minBaseAmount
    }

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

    const price = priceForSizing > 0
      ? priceForSizing
      : typeof markPrice === 'number' && markPrice > 0 ? markPrice : undefined
    const usdSize = typeof requestUsdSize === 'number' && requestUsdSize > 0
      ? requestUsdSize
      : price ? baseAmount * price : undefined

    // Fire-and-forget: wait for exchange to settle, then send accurate notification.
    // Detached so the trade API response returns immediately.
    void (async () => {
      let filledUsd: number | undefined
      try {
        // Give the exchange time to settle the trade
        // Lighter taker latency: ~300ms (standard) / ~150ms (premium) + API fetch RTT
        await new Promise((r) => setTimeout(r, 1000))
        const account = await fetchAccountData(cid)
        const pos = account.positions.find((p) => p.marketIndex === marketIndex)
        if (pos) {
          const posSize = Math.abs(parseFloat(pos.size || '0'))
          const entryPrice = parseFloat(pos.entryPrice || '0')
          filledUsd = entryPrice > 0 ? posSize * entryPrice : undefined
        }
      } catch {
        // Non-fatal — send notification without filled size
      }

      notifyPositionOpen({
        marketIndex,
        side,
        baseAmount,
        usdSize,
        price,
        filledUsd,
      })
    })()

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
