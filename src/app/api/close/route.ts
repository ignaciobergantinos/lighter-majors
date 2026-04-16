// ── POST /api/close — close position(s) ─────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { closePosition, closeAllPositions, fetchAccountData } from '@/lib/lighter-client'
import { notifyPositionClose, notifyCloseAll } from '@/lib/discord-notifier'

export async function POST(req: NextRequest) {
  try {
    const { closeAll, marketIndex } = await req.json()

    if (closeAll) {
      // Capture positions before closing for Discord notifications
      const account = await fetchAccountData()
      const openPositions = [...account.positions]

      const results = await closeAllPositions()
      const failed = results.filter((r) => !r.success)

      if (failed.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `${failed.length} position(s) failed to close`,
            details: failed,
          },
          { status: 422 },
        )
      }

      notifyCloseAll(openPositions)
      return NextResponse.json({ success: true })
    }

    if (marketIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'marketIndex or closeAll required' },
        { status: 400 },
      )
    }

    // Capture position before closing for Discord notification
    const account = await fetchAccountData()
    const position = account.positions.find((p) => p.marketIndex === marketIndex)

    const result = await closePosition(marketIndex)

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
    }

    if (position) {
      notifyPositionClose({ position })
    }

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Close failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
