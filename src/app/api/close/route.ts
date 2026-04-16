// ── POST /api/close — close position(s) ─────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { closePosition, closeAllPositions } from '@/lib/lighter-client'

export async function POST(req: NextRequest) {
  try {
    const { closeAll, marketIndex } = await req.json()

    if (closeAll) {
      const results = await closeAllPositions()
      const failed = results.filter((r) => !r.success)
      if (failed.length > 0) {
        return NextResponse.json({
          success: false,
          error: `${failed.length} position(s) failed to close`,
          details: failed,
        })
      }
      return NextResponse.json({ success: true })
    }

    if (marketIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'marketIndex or closeAll required' },
        { status: 400 },
      )
    }

    const result = await closePosition(marketIndex)
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Close failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
