// ── Zustand Widget Store ────────────────────────────────────
import { create } from 'zustand'
import type { MarketSymbol, PriceTick } from '@/lib/types'
import { MARKETS } from '@/lib/constants'

interface WidgetState {
  isOpen: boolean
  isPinned: boolean
  activeTab: MarketSymbol
  prices: Record<MarketSymbol, PriceTick | null>
  usdSize: string

  toggleWidget: () => void
  setOpen: (open: boolean) => void
  togglePinned: () => void
  setActiveTab: (tab: MarketSymbol) => void
  updatePrice: (tick: PriceTick) => void
  setUsdSize: (size: string) => void
}

export const useWidgetStore = create<WidgetState>((set) => ({
  isOpen: false,
  isPinned: true,
  activeTab: 'BTC',
  prices: { BTC: null, ETH: null, SOL: null },
  usdSize: String(MARKETS.BTC.minQuote),

  toggleWidget: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  togglePinned: () => set((s) => ({ isPinned: !s.isPinned })),
  setActiveTab: (tab) =>
    set({ activeTab: tab, usdSize: String(MARKETS[tab].minQuote) }),
  updatePrice: (tick) =>
    set((s) => ({ prices: { ...s.prices, [tick.symbol]: tick } })),
  setUsdSize: (size) => set({ usdSize: size }),
}))
