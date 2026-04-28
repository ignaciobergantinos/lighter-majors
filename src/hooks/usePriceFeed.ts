// ── WebSocket Price Feed ────────────────────────────────────
'use client'
import { useEffect, useRef } from 'react'
import { WS_URL, WS_PING_INTERVAL_MS, WS_RECONNECT_MS, MARKETS } from '@/lib/constants'
import type { MarketSymbol, PriceTick } from '@/lib/types'
import { useWidgetStore } from '@/store/widget-store'

const symbolByIndex: Record<number, MarketSymbol> = {}
for (const m of Object.values(MARKETS)) {
  symbolByIndex[m.marketIndex] = m.symbol
}

export function usePriceFeed() {
  const updatePrice = useWidgetStore((s) => s.updatePrice)
  const wsRef = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval>>()
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    let mounted = true

    function connect() {
      if (!mounted) return
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        // Subscribe to market stats for all three pairs
        for (const market of Object.values(MARKETS)) {
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              channel: `market_stats/${market.marketIndex}`,
            }),
          )
        }
        // Keepalive ping
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping')
        }, WS_PING_INTERVAL_MS)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          // Accept the initial snapshot (subscribed/...) and live ticks (update/...).
          // Lighter wraps the payload in `market_stats`; legacy `data` kept as a fallback.
          if (msg.type !== 'update/market_stats' && msg.type !== 'subscribed/market_stats') return

          const d = msg.market_stats ?? msg.data
          if (!d) return
          const marketId = d.market_id ?? d.market_index
          const symbol = symbolByIndex[marketId]
          if (!symbol) return

          const tick: PriceTick = {
            symbol,
            markPrice: d.mark_price ?? '0',
            indexPrice: d.index_price ?? '0',
            fundingRate: d.funding_rate ?? '0',
            lastUpdated: Date.now(),
          }
          updatePrice(tick)
        } catch { /* ignore non-JSON frames */ }
      }

      ws.onclose = () => {
        clearInterval(pingRef.current)
        if (mounted) {
          reconnectRef.current = setTimeout(connect, WS_RECONNECT_MS)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      mounted = false
      clearInterval(pingRef.current)
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [updatePrice])
}
