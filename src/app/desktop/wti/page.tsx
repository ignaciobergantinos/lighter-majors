// ── Desktop /wti Route — Standalone WTI quick-action window ─
import { WtiFloatingWidget } from '@/components/trade/WtiFloatingWidget'

export default function WtiDesktopPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-transparent">
      <WtiFloatingWidget />
    </main>
  )
}
