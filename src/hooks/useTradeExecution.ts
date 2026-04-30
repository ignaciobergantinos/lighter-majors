// ── Trade Execution Hook ────────────────────────────────────
'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MarketSymbol, TradeResponse, SplitCoinConfig } from '@/lib/types'
import { MARKETS, SPLIT_SYMBOLS, INVERSE_HEDGE_SYMBOLS } from '@/lib/constants'
import { playSuccessSound, playErrorSound } from '@/lib/audio'
import { useWidgetStore } from '@/store/widget-store'

interface TradeParams {
  symbol: MarketSymbol
  side: 'long' | 'short'
  /** Base amount to trade. Falls back to market minimum if omitted. */
  baseAmount?: number
  /** USD size the user entered — used server-side to size the order. */
  usdSize?: number
  /** Current mark price — used server-side to size the order. */
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
      ...(params.usdSize != null && { usdSize: params.usdSize }),
      ...(params.markPrice != null && { markPrice: params.markPrice }),
    }),
  })
  return parseTradeResponse(res)
}

interface SplitTradeParams {
  side: 'long' | 'short'
  /** Total USD size to split across all symbols */
  totalUsdSize: number
  /** Mark prices keyed by symbol */
  markPrices: Partial<Record<MarketSymbol, number>>
  /** Per-coin split configuration from the store */
  splitConfig: Record<MarketSymbol, SplitCoinConfig>
  /** Whether WTI rides as an inverse hedge (long crypto → short WTI). */
  wtiHedgeEnabled?: boolean
}

const oppositeSide = (s: 'long' | 'short'): 'long' | 'short' =>
  s === 'long' ? 'short' : 'long'

/** Place split orders for all enabled coins with their configured percentages.
 *  Dispatches sequentially in SPLIT_SYMBOLS priority order (BTC → ETH → SOL → WTI)
 *  so the server sees orders in a deterministic sequence — avoids nonce races.
 *  Inverse-hedge symbols (WTI) flip side from the requested direction. */
async function executeSplitTrade(params: SplitTradeParams): Promise<TradeResponse> {
  const { side, totalUsdSize, markPrices, splitConfig, wtiHedgeEnabled = false } = params
  const errors: string[] = []

  const activeSymbols = SPLIT_SYMBOLS.filter((s) => {
    if (INVERSE_HEDGE_SYMBOLS.includes(s) && !wtiHedgeEnabled) return false
    return splitConfig[s].enabled && splitConfig[s].pct > 0
  })
  if (activeSymbols.length === 0) {
    throw new Error('No coins enabled for split')
  }

  let dispatched = 0
  for (const symbol of activeSymbols) {
    const pct = splitConfig[symbol].pct / 100
    const usdSize = Math.floor(totalUsdSize * pct)
    const market = MARKETS[symbol]
    const price = markPrices[symbol]

    if (!price || price <= 0 || usdSize < market.minQuote) continue

    const base = usdSize / price
    const baseAmount = parseFloat(base.toFixed(market.sizeDecimals))
    if (baseAmount < market.minBaseAmount) continue

    const orderSide = INVERSE_HEDGE_SYMBOLS.includes(symbol) ? oppositeSide(side) : side

    dispatched++
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketIndex: market.marketIndex,
          side: orderSide,
          baseAmount,
          usdSize,
          markPrice: price,
        }),
      })
      const parsed = await parseTradeResponse(res)
      if (!parsed.success) errors.push(parsed.error ?? 'Order failed')
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (dispatched > 0 && errors.length === dispatched) {
    throw new Error(`All split orders failed: ${errors.join('; ')}`)
  }

  return { success: true }
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
  const soundEnabled = useWidgetStore((s) => s.soundEnabled)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['positions'] })

  const onSuccess = () => {
    invalidate()
    if (soundEnabled) playSuccessSound()
  }
  const onError = () => {
    if (soundEnabled) playErrorSound()
  }

  const tradeMutation = useMutation({
    mutationFn: executeTrade,
    onSuccess,
    onError,
  })

  const closeAllMutation = useMutation({
    mutationFn: (params: CloseAllParams | undefined) => executeCloseAll(params),
    onSuccess,
    onError,
  })

  const closeMutation = useMutation({
    mutationFn: executeClose,
    onSuccess,
    onError,
  })

  const splitTradeMutation = useMutation({
    mutationFn: executeSplitTrade,
    onSuccess,
    onError,
  })

  return {
    placeTrade: tradeMutation.mutate,
    placeSplitTrade: splitTradeMutation.mutate,
    closeAll: closeAllMutation.mutate,
    closePosition: closeMutation.mutate,
    isTrading: tradeMutation.isPending || splitTradeMutation.isPending,
    isClosing: closeAllMutation.isPending || closeMutation.isPending,
    tradeError: tradeMutation.error?.message ?? splitTradeMutation.error?.message ?? null,
  }
}
