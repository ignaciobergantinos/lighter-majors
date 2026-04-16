// ── Lighter REST API Client (server-side) ──────────────────
import { API_BASE, MARKETS } from './constants'
import { generateAuthToken, getKeyConfig } from './lighter-keys'
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

export async function fetchAccountData(): Promise<AccountData> {
  const { accountIndex } = getKeyConfig()
  const res = await fetch(
    `${API_BASE}/api/v1/account?by=index&value=${accountIndex}`,
    { headers: authHeaders(), cache: 'no-store' },
  )
  if (!res.ok) throw new Error(`Account fetch failed: ${res.status}`)
  const raw = await res.json()

  // API wraps the account data inside { accounts: [...] }
  const data = raw.accounts?.[0] ?? raw

  const positions = parsePositions(data.positions ?? {})
  const aggregatePnl = positions
    .reduce((sum, p) => sum + parseFloat(p.pnl || '0'), 0)
    .toFixed(2)

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
): Promise<TradeResponse> {
  const body = JSON.stringify({
    market_index: marketIndex,
    is_ask: isAsk,
    base_amount: baseAmount,
    order_type: 'MARKET',
  })
  const res = await fetch(`${API_BASE}/api/v1/sendTx`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.json()
  if (!res.ok) return { success: false, error: data.message ?? 'Order failed' }
  return { success: true, txHash: data.tx_hash }
}

// ── Write: close position ───────────────────────────────────

export async function closePosition(
  marketIndex: number,
): Promise<TradeResponse> {
  // Close = place opposite market order for full size
  const account = await fetchAccountData()
  const pos = account.positions.find((p) => p.marketIndex === marketIndex)
  if (!pos) return { success: false, error: 'No open position' }

  const isAsk = pos.side === 'long' // sell to close long
  const size = Math.abs(parseFloat(pos.size))
  return placeMarketOrder(marketIndex, isAsk, size)
}

export async function closeAllPositions(): Promise<TradeResponse[]> {
  const account = await fetchAccountData()
  return Promise.all(
    account.positions.map((p) => closePosition(p.marketIndex)),
  )
}
