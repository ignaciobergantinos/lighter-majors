// ── Desktop Route — Electron-optimized widget view ──────────
import { DesktopTradeWidget } from '@/components/trade/DesktopTradeWidget'

export default function DesktopPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-transparent">
      <DesktopTradeWidget />
    </main>
  )
}
