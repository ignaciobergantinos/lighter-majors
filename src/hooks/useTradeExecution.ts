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
  /** Current mark price — forwarded for Discord notification context. */
  markPrice?: number
}

/** Parse response and throw on failure so React Query triggers onError. */
async function parseTradeResponse(res: Response): Promise<TradeResponse> {
  const data: TradeResponse = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `Trade request failed (${res.status})`)
  }
  return data
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
      ...(params.markPrice != null && { markPrice: params.markPrice }),
    }),
  })
  return parseTradeResponse(res)
}

interface CloseAllParams {
  /** Mark prices keyed by market index — forwarded for Discord notification context. */
  markPrices?: Record<number, number>
}

async function executeCloseAll(params?: CloseAllParams): Promise<TradeResponse> {
  const res = await fetch('/api/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      closeAll: true,
      ...(params?.markPrices && { markPrices: params.markPrices }),
    }),
  })
  return parseTradeResponse(res)
}

interface CloseParams {
  marketIndex: number
  /** Current mark price — forwarded for Discord notification context. */
  markPrice?: number
}

async function executeClose(params: CloseParams): Promise<TradeResponse> {
  const res = await fetch('/api/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      marketIndex: params.marketIndex,
      ...(params.markPrice != null && { markPrice: params.markPrice }),
    }),
  })
  return parseTradeResponse(res)
}

export function useTradeExecution() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['positions'] })

  const tradeMutation = useMutation({
    mutationFn: executeTrade,
    onSuccess: invalidate,
  })

  const closeAllMutation = useMutation({
    mutationFn: (params: CloseAllParams | undefined) => executeCloseAll(params),
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
