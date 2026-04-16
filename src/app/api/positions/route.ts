// ── GET /api/positions — fetch account positions + balance ──
import { NextResponse } from 'next/server'
import { fetchAccountData } from '@/lib/lighter-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await fetchAccountData()
    return NextResponse.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
