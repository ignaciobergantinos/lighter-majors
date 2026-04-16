// ── Positions + Balance Hook ────────────────────────────────
'use client'
import { useQuery } from '@tanstack/react-query'
import { POLL_INTERVAL_MS } from '@/lib/constants'
import type { AccountData } from '@/lib/types'

async function fetchPositions(): Promise<AccountData> {
  const res = await fetch('/api/positions', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch positions: ${res.status}`)
  return res.json()
}

export function usePositions() {
  const query = useQuery<AccountData>({
    queryKey: ['positions'],
    queryFn: fetchPositions,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS / 2,
  })

  return {
    positions: query.data?.positions ?? [],
    balance: query.data?.balance ?? null,
    aggregatePnl: query.data?.aggregatePnl ?? '0.00',
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  }
}
