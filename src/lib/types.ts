// ── Lighter Exchange Types ──────────────────────────────────

export type MarketSymbol = 'BTC' | 'ETH' | 'SOL'

export interface MarketConfig {
  symbol: MarketSymbol
  marketIndex: number
  sizeDecimals: number
  priceDecimals: number
  minBaseAmount: number
  minQuote: number
}

export interface Position {
  marketIndex: number
  symbol: MarketSymbol
  side: 'long' | 'short'
  size: string
  entryPrice: string
  pnl: string
}

export interface AccountBalance {
  availableBalance: string
  collateral: string
  totalAssetValue: string
}

export interface AccountData {
  balance: AccountBalance
  positions: Position[]
  aggregatePnl: string
}

export interface TradeRequest {
  marketIndex: number
  side: 'long' | 'short'
  baseAmount: number
  maxPrice?: number
}

export interface TradeResponse {
  success: boolean
  txHash?: string
  error?: string
}

export interface PriceTick {
  symbol: MarketSymbol
  markPrice: string
  indexPrice: string
  fundingRate: string
  lastUpdated: number
}

export interface ShortcutBinding {
  key: string
  ctrl: boolean
  action: ShortcutAction
  label: string
}

export type ShortcutAction =
  | { type: 'trade'; symbol: MarketSymbol; side: 'long' | 'short' }
  | { type: 'close-all' }
  | { type: 'toggle-widget' }
