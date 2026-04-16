// ── Auto-Size Hook ─────────────────────────────────────────
// Sets USD size to Math.floor(availableBalance × SIZE_MULTIPLIER)
// Triggers: app mount, balance change (after trade/close), symbol switch
'use client'
import { useEffect, useRef } from 'react'
import { useWidgetStore } from '@/store/widget-store'
import { SIZE_MULTIPLIER } from '@/lib/constants'
import type { AccountBalance } from '@/lib/types'

export function useAutoSize(balance: AccountBalance | null) {
  const { activeTab, setUsdSize } = useWidgetStore()
  const prevBalanceRef = useRef<string | null>(null)
  const prevTabRef = useRef(activeTab)

  useEffect(() => {
    if (!balance) return

    const currentBalance = balance.availableBalance
    const tabChanged = activeTab !== prevTabRef.current
    const balanceChanged = currentBalance !== prevBalanceRef.current
    const isInitial = prevBalanceRef.current === null

    if (isInitial || tabChanged || balanceChanged) {
      const size = Math.floor(parseFloat(currentBalance) * SIZE_MULTIPLIER)
      if (size > 0) {
        setUsdSize(String(size))
      }
    }

    prevBalanceRef.current = currentBalance
    prevTabRef.current = activeTab
  }, [balance, activeTab, setUsdSize])
}
