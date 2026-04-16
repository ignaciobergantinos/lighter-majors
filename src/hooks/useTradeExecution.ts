// ── Trade Execution Hook ────────────────────────────────────
'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MarketSymbol, TradeResponse } from '@/lib/types'
import { MARKETS } from '@/lib/constants'

interface TradeParams {
  symbol: MarketSymbol
  side: 'long' | 'short'
  /** Base amount to trade. Falls back to market minimum if omitted. */
  baseAmount?: number
}

async function executeTrade(params: TradeParams): Promise<TradeResponse> {
  const market = MARKETS[params.symbol]
  const res = await fetch('/api/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      marketIndex: market.marketIndex,
      side: params.side,
      ...(params.baseAmount != null && { baseAmount: params.baseAmount }),
    }),
  })
  return res.json()
}

async function executeCloseAll(): Promise<TradeResponse> {
  const res = await fetch('/api/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closeAll: true }),
  })
  return res.json()
}

async function executeClose(marketIndex: number): Promise<TradeResponse> {
  const res = await fetch('/api/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketIndex }),
  })
  return res.json()
}

export function useTradeExecution() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['positions'] })

  const tradeMutation = useMutation({
    mutationFn: executeTrade,
    onSuccess: invalidate,
  })

  const closeAllMutation = useMutation({
    mutationFn: executeCloseAll,
    onSuccess: invalidate,
  })

  const closeMutation = useMutation({
    mutationFn: executeClose,
    onSuccess: invalidate,
  })

  return {
    placeTrade: tradeMutation.mutate,
    closeAll: closeAllMutation.mutate,
    closePosition: closeMutation.mutate,
    isTrading: tradeMutation.isPending,
    isClosing: closeAllMutation.isPending || closeMutation.isPending,
    tradeError: tradeMutation.error?.message ?? null,
  }
}
