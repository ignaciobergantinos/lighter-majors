// ── POST /api/trade — place a market order ──────────────────
import { NextRequest, NextResponse } from 'next/server'
import { placeMarketOrder } from '@/lib/lighter-client'
import { MARKETS } from '@/lib/constants'

export async function POST(req: NextRequest) {
  try {
    const { marketIndex, side } = await req.json()

    // Validate market
    const market = Object.values(MARKETS).find(
      (m) => m.marketIndex === marketIndex,
    )
    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Invalid market' },
        { status: 400 },
      )
    }

    const isAsk = side === 'short'
    const baseAmount = market.minBaseAmount

    const result = await placeMarketOrder(marketIndex, isAsk, baseAmount)
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Trade failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
