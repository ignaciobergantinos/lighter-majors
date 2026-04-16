// ── Lighter REST API Client (server-side) ──────────────────
import { API_BASE, MARKETS } from './constants'
import { generateAuthToken, getKeyConfig, ensureSignerReady, refreshNonce } from './lighter-keys'
import { createLogger } from './logger'
import type {
  AccountData,
  MarketSymbol,
  Position,
  TradeResponse,
} from './types'

function authHeaders(): HeadersInit {
  return { authorization: generateAuthToken() }
}

// ── Read: positions + balance ───────────────────────────────

export async function fetchAccountData(cid?: string): Promise<AccountData> {
  const log = createLogger(cid ?? 'no-cid')
  const { accountIndex } = getKeyConfig()
  const url = `${API_BASE}/api/v1/account?by=index&value=${accountIndex}`

  const start = performance.now()
  log.debug('lighter_api.fetch_account.start', { accountIndex })

  const res = await fetch(url, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  const durationMs = Math.round(performance.now() - start)

  if (!res.ok) {
    log.error('lighter_api.fetch_account.error', {
      status: res.status,
      statusText: res.statusText,
      durationMs,
    })
    throw new Error(`Account fetch failed: ${res.status}`)
  }

  const raw = await res.json()

  // API wraps the account data inside { accounts: [...] }
  const data = raw.accounts?.[0] ?? raw

  const positions = parsePositions(data.positions ?? {})
  const aggregatePnl = positions
    .reduce((sum, p) => sum + parseFloat(p.pnl || '0'), 0)
    .toFixed(2)

  log.debug('lighter_api.fetch_account.complete', {
    status: res.status,
    durationMs,
    positionCount: positions.length,
  })

  return {
    balance: {
      availableBalance: data.available_balance ?? '0',
      collateral: data.collateral ?? '0',
      totalAssetValue: data.total_asset_value ?? '0',
    },
    positions,
    aggregatePnl,
  }
}

function parsePositions(raw: unknown[] | Record<string, unknown>): Position[] {
  const items = Array.isArray(raw) ? raw : Object.values(raw)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items
    .filter((p: any) => parseFloat(p.position ?? p.size ?? '0') !== 0)
    .map((p: any) => {
      const marketIndex = p.market_id ?? p.market_index
      const size = p.position ?? p.size ?? '0'
      const sign = p.sign ?? 1
      // sign: 1 = long, 0 = short; or infer from size
      const side = p.side ?? (sign === 1 ? 'long' : 'short')
      return {
        marketIndex,
        symbol: (p.symbol as MarketSymbol) ?? 'BTC',
        side,
        size,
        entryPrice: p.avg_entry_price ?? p.entry_price ?? '0',
        pnl: p.unrealized_pnl ?? p.pnl ?? '0',
      }
    })
}

// ── Write: place market order ───────────────────────────────

export async function placeMarketOrder(
  marketIndex: number,
  isAsk: boolean,
  baseAmount: number,
  cid?: string,
  reduceOnly = false,
): Promise<TradeResponse> {
  const log = createLogger(cid ?? 'no-cid')
  const start = performance.now()

  // SDK expects base_amount as an integer in smallest units (e.g. 0.0002 BTC → 20 with sizeDecimals=5)
  const market = Object.values(MARKETS).find((m) => m.marketIndex === marketIndex)
  const sizeDecimals = market?.sizeDecimals ?? 5
  const baseAmountInt = Math.round(baseAmount * 10 ** sizeDecimals)

  // Max slippage tolerance (0.05 = 5%) — SDK auto-fetches best orderbook price
  const MAX_SLIPPAGE = 0.05

  log.debug('lighter_sdk.create_market_order.start', {
    marketIndex,
    isAsk,
    baseAmount,
    baseAmountInt,
    maxSlippage: MAX_SLIPPAGE,
    reduceOnly,
  })

  // Ensure the SDK's nonce manager has initialized before sending orders.
  // The SDK initializes nonces async (fire-and-forget) and has a bug where
  // it never recovers from "invalid nonce" errors on its own.
  const client = await ensureSignerReady()

  const MAX_ATTEMPTS = 2

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const [order, respSendTx, error] = await client.create_market_order_limited_slippage(
        marketIndex,
        0,              // client_order_index
        baseAmountInt,
        MAX_SLIPPAGE,   // max slippage — SDK fetches orderbook price and applies this tolerance
        isAsk,
        reduceOnly,
      )

      const durationMs = Math.round(performance.now() - start)

      if (error) {
        // The SDK returns "invalid nonce" as a string error (not an exception)
        // when the server rejects the nonce. The SDK's built-in recovery is
        // broken (checks error.message instead of error.response.data.message),
        // so we force a nonce refresh and retry once.
        if (typeof error === 'string' && error.includes('invalid nonce') && attempt < MAX_ATTEMPTS) {
          log.warn('lighter_sdk.create_market_order.invalid_nonce_retry', {
            durationMs,
            attempt,
            marketIndex,
          })
          await refreshNonce()
          continue
        }

        log.error('lighter_sdk.create_market_order.error', {
          durationMs,
          error,
          marketIndex,
          isAsk,
          baseAmount,
          reduceOnly,
        })
        return { success: false, error }
      }

      const txHash = respSendTx?.tx_hash
      log.debug('lighter_sdk.create_market_order.success', {
        durationMs,
        txHash,
        marketIndex,
        isAsk,
        baseAmount,
        reduceOnly,
      })

      return { success: true, txHash }
    } catch (err) {
      const durationMs = Math.round(performance.now() - start)
      const message = err instanceof Error ? err.message : 'SDK order failed'

      // Also handle "invalid nonce" thrown as an exception
      if (message.includes('invalid nonce') && attempt < MAX_ATTEMPTS) {
        log.warn('lighter_sdk.create_market_order.invalid_nonce_retry', {
          durationMs,
          attempt,
          marketIndex,
        })
        await refreshNonce()
        continue
      }

      log.error('lighter_sdk.create_market_order.exception', {
        durationMs,
        error: message,
        marketIndex,
        isAsk,
        baseAmount,
        reduceOnly,
      })
      return { success: false, error: message }
    }
  }

  // Should never reach here, but satisfy TypeScript
  return { success: false, error: 'Max retry attempts exhausted' }
}

// ── Write: close position ───────────────────────────────────

export async function closePosition(
  marketIndex: number,
  cid?: string,
): Promise<TradeResponse> {
  const log = createLogger(cid ?? 'no-cid')

  // Close = place opposite market order for full size
  const account = await fetchAccountData(cid)
  const pos = account.positions.find((p) => p.marketIndex === marketIndex)

  if (!pos) {
    log.warn('lighter_api.close_position.no_position', { marketIndex })
    return { success: false, error: 'No open position' }
  }

  const isAsk = pos.side === 'long' // sell to close long
  const size = Math.abs(parseFloat(pos.size))

  log.debug('lighter_api.close_position', {
    marketIndex,
    symbol: pos.symbol,
    side: pos.side,
    size,
    isAsk,
  })

  return placeMarketOrder(marketIndex, isAsk, size, cid, true)
}

export async function closeAllPositions(cid?: string): Promise<TradeResponse[]> {
  const account = await fetchAccountData(cid)
  // Serialize close orders to avoid nonce collisions.
  // The SDK's OptimisticNonceManager increments a local counter,
  // but parallel requests can race and reuse the same nonce.
  const results: TradeResponse[] = []
  for (const p of account.positions) {
    results.push(await closePosition(p.marketIndex, cid))
  }
  return results
}
