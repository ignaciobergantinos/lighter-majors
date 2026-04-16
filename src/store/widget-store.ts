// ── Zustand Widget Store ────────────────────────────────────
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MarketSymbol, PriceTick } from '@/lib/types'
import { MARKETS } from '@/lib/constants'

const defaultUsdSizes: Record<MarketSymbol, string> = {
  BTC: String(MARKETS.BTC.minQuote),
  ETH: String(MARKETS.ETH.minQuote),
  SOL: String(MARKETS.SOL.minQuote),
}

interface WidgetState {
  isOpen: boolean
  isPinned: boolean
  activeTab: MarketSymbol
  prices: Record<MarketSymbol, PriceTick | null>
  /** Per-coin USD sizes — each market remembers its own amount */
  usdSizes: Record<MarketSymbol, string>

  toggleWidget: () => void
  setOpen: (open: boolean) => void
  togglePinned: () => void
  setActiveTab: (tab: MarketSymbol) => void
  updatePrice: (tick: PriceTick) => void
  setUsdSize: (size: string) => void
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      isOpen: false,
      isPinned: true,
      activeTab: 'BTC',
      prices: { BTC: null, ETH: null, SOL: null },
      usdSizes: { ...defaultUsdSizes },

      toggleWidget: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      togglePinned: () => set((s) => ({ isPinned: !s.isPinned })),
      setActiveTab: (tab) => set({ activeTab: tab }),
      updatePrice: (tick) =>
        set((s) => ({ prices: { ...s.prices, [tick.symbol]: tick } })),
      setUsdSize: (size) =>
        set((s) => ({
          usdSizes: { ...s.usdSizes, [s.activeTab]: size },
        })),
    }),
    {
      name: 'lighter-widget',
      // Only persist user preferences, not transient state like prices
      partialize: (state) => ({
        isPinned: state.isPinned,
        activeTab: state.activeTab,
        usdSizes: state.usdSizes,
      }),
    },
  ),
)
