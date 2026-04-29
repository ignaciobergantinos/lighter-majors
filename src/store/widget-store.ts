// ── Zustand Widget Store ────────────────────────────────────
import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { MarketSymbol, PriceTick, SplitCoinConfig } from '@/lib/types'
import { MARKETS } from '@/lib/constants'

const defaultUsdSizes: Record<MarketSymbol, string> = {
  BTC: String(MARKETS.BTC.minQuote),
  ETH: String(MARKETS.ETH.minQuote),
  SOL: String(MARKETS.SOL.minQuote),
  WTI: String(MARKETS.WTI.minQuote),
}

interface WidgetState {
  isOpen: boolean
  isPinned: boolean
  activeTab: MarketSymbol
  prices: Record<MarketSymbol, PriceTick | null>
  /** Per-coin USD sizes — each market remembers its own amount */
  usdSizes: Record<MarketSymbol, string>
  /** Whether audio feedback is enabled for trade execution */
  soundEnabled: boolean
  /** Whether USD size auto-calculates from balance × 48 */
  autoSizeEnabled: boolean
  /** Whether split mode is active */
  splitEnabled: boolean
  /** Per-coin split configuration (enabled + percentage) */
  splitConfig: Record<MarketSymbol, SplitCoinConfig>
  /** Whether WTI rides the split as an inverse hedge (long crypto → short WTI, etc.) */
  wtiHedgeEnabled: boolean
  /** Pinned state of the standalone WTI floating window (separate from main widget). */
  wtiIsPinned: boolean

  toggleWidget: () => void
  setOpen: (open: boolean) => void
  togglePinned: () => void
  setActiveTab: (tab: MarketSymbol) => void
  updatePrice: (tick: PriceTick) => void
  setUsdSize: (size: string) => void
  toggleSound: () => void
  toggleAutoSize: () => void
  toggleSplit: () => void
  toggleSplitCoin: (symbol: MarketSymbol) => void
  setSplitPct: (symbol: MarketSymbol, pct: number) => void
  toggleWtiHedge: () => void
  toggleWtiIsPinned: () => void
}

// ── Electron-aware storage adapter ─────────────────────────
// In Electron: persists preferences to disk via IPC (survives app restarts).
// In browser: falls back to localStorage.

interface ElectronPrefsAPI {
  loadPreferences: () => Promise<Record<string, unknown> | null>
  savePreferences: (prefs: Record<string, unknown>) => void
}

function getElectronAPI(): ElectronPrefsAPI | null {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    const api = (window as unknown as Record<string, unknown>).electronAPI as
      | Record<string, unknown>
      | undefined
    if (api?.loadPreferences && api?.savePreferences) {
      return api as unknown as ElectronPrefsAPI
    }
  }
  return null
}

/**
 * Custom StateStorage that uses Electron file-based IPC when available,
 * falling back to localStorage for browser mode.
 */
const electronBackedStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const electronAPI = getElectronAPI()
    if (electronAPI) {
      const prefs = await electronAPI.loadPreferences()
      if (prefs) {
        // Wrap in the { state, version } envelope that Zustand expects
        return JSON.stringify({ state: prefs, version: 0 })
      }
      return null
    }

    // Fallback: localStorage (browser mode)
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(name)
    }
    return null
  },

  setItem: (name: string, value: string): void => {
    const electronAPI = getElectronAPI()
    if (electronAPI) {
      try {
        const parsed = JSON.parse(value)
        // Send the inner state object (without Zustand envelope) to Electron
        electronAPI.savePreferences(parsed.state ?? parsed)
      } catch {
        // Malformed value — skip
      }
      return
    }

    // Fallback: localStorage (browser mode)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(name, value)
    }
  },

  removeItem: (name: string): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(name)
    }
  },
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      isOpen: false,
      isPinned: true,
      activeTab: 'BTC',
      prices: { BTC: null, ETH: null, SOL: null, WTI: null },
      usdSizes: { ...defaultUsdSizes },
      soundEnabled: true,
      autoSizeEnabled: true,
      splitEnabled: false,
      splitConfig: {
        BTC: { enabled: true, pct: 70 },
        ETH: { enabled: true, pct: 30 },
        SOL: { enabled: false, pct: 0 },
        WTI: { enabled: false, pct: 0 },
      },
      wtiHedgeEnabled: false,
      wtiIsPinned: true,

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
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleAutoSize: () => set((s) => ({ autoSizeEnabled: !s.autoSizeEnabled })),
      toggleSplit: () => set((s) => ({ splitEnabled: !s.splitEnabled })),
      toggleSplitCoin: (symbol) =>
        set((s) => ({
          splitConfig: {
            ...s.splitConfig,
            [symbol]: { ...s.splitConfig[symbol], enabled: !s.splitConfig[symbol].enabled },
          },
        })),
      setSplitPct: (symbol, pct) =>
        set((s) => ({
          splitConfig: {
            ...s.splitConfig,
            [symbol]: { ...s.splitConfig[symbol], pct },
          },
        })),
      toggleWtiHedge: () => set((s) => ({ wtiHedgeEnabled: !s.wtiHedgeEnabled })),
      toggleWtiIsPinned: () => set((s) => ({ wtiIsPinned: !s.wtiIsPinned })),
    }),
    {
      name: 'lighter-widget',
      storage: createJSONStorage(() => electronBackedStorage),
      // Only persist user preferences, not transient state like prices
      partialize: (state) => ({
        isPinned: state.isPinned,
        activeTab: state.activeTab,
        usdSizes: state.usdSizes,
        soundEnabled: state.soundEnabled,
        autoSizeEnabled: state.autoSizeEnabled,
        splitEnabled: state.splitEnabled,
        splitConfig: state.splitConfig,
        wtiHedgeEnabled: state.wtiHedgeEnabled,
        wtiIsPinned: state.wtiIsPinned,
      }),
      // Deep-merge persisted prefs into current defaults so stores saved
      // before a new symbol/key existed (e.g. WTI) hydrate without holes.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WidgetState>
        return {
          ...current,
          ...p,
          splitConfig: { ...current.splitConfig, ...(p.splitConfig ?? {}) },
          usdSizes: { ...current.usdSizes, ...(p.usdSizes ?? {}) },
        }
      },
    },
  ),
)
