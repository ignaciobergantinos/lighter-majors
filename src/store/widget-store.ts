// ── Zustand Widget Store ────────────────────────────────────
import { create } from 'zustand'
import type { MarketSymbol, PriceTick } from '@/lib/types'

interface WidgetState {
  isOpen: boolean
  activeTab: MarketSymbol
  prices: Record<MarketSymbol, PriceTick | null>

  toggleWidget: () => void
  setOpen: (open: boolean) => void
  setActiveTab: (tab: MarketSymbol) => void
  updatePrice: (tick: PriceTick) => void
}

export const useWidgetStore = create<WidgetState>((set) => ({
  isOpen: false,
  activeTab: 'BTC',
  prices: { BTC: null, ETH: null, SOL: null },

  toggleWidget: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  updatePrice: (tick) =>
    set((s) => ({ prices: { ...s.prices, [tick.symbol]: tick } })),
}))
