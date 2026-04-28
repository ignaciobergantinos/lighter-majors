// ── Lighter Exchange Constants ──────────────────────────────
import type { MarketConfig, MarketSymbol } from './types'

export const API_BASE =
  process.env.NEXT_PUBLIC_LIGHTER_API_URL ??
  'https://mainnet.zklighter.elliot.ai'

export const WS_URL =
  process.env.NEXT_PUBLIC_LIGHTER_WS_URL ??
  'wss://mainnet.zklighter.elliot.ai/stream'

export const EXPLORER_API =
  process.env.NEXT_PUBLIC_LIGHTER_EXPLORER_URL ??
  'https://explorer.elliot.ai/api'

export const MARKETS: Record<MarketSymbol, MarketConfig> = {
  ETH: {
    symbol: 'ETH',
    marketIndex: 0,
    sizeDecimals: 4,
    priceDecimals: 2,
    minBaseAmount: 0.005,
    minQuote: 10,
  },
  BTC: {
    symbol: 'BTC',
    marketIndex: 1,
    sizeDecimals: 5,
    priceDecimals: 1,
    minBaseAmount: 0.0002,
    minQuote: 10,
  },
  SOL: {
    symbol: 'SOL',
    marketIndex: 2,
    sizeDecimals: 3,
    priceDecimals: 3,
    minBaseAmount: 0.05,
    minQuote: 10,
  },
  WTI: {
    symbol: 'WTI',
    marketIndex: 145,
    sizeDecimals: 3,
    priceDecimals: 3,
    minBaseAmount: 0.1,
    minQuote: 10,
  },
}

/** User-tradeable majors — what shows in tabs and the regular trade UI. */
export const MARKET_SYMBOLS: MarketSymbol[] = ['BTC', 'ETH', 'SOL', 'WTI']

/** Symbols that can participate in a split order. WTI rides as an inverse hedge. */
export const SPLIT_SYMBOLS: MarketSymbol[] = ['BTC', 'ETH', 'SOL', 'WTI']

/** Symbols whose split direction is inverted from the requested side. */
export const INVERSE_HEDGE_SYMBOLS: MarketSymbol[] = ['WTI']

/** Default leverage multiplier for auto-sizing (balance × this = USD size) */
export const SIZE_MULTIPLIER = 40


export const POLL_INTERVAL_MS = 5_000
export const WS_RECONNECT_MS = 3_000
export const WS_PING_INTERVAL_MS = 90_000
