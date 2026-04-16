import { FloatingTradeWidget } from '@/components/trade/FloatingTradeWidget'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-zinc-300">Lighter Majors</h1>
        <p className="text-sm text-zinc-600">
          Click the green button (bottom-right) or press{' '}
          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
            Ctrl+`
          </kbd>{' '}
          to open the trade widget.
        </p>
      </div>
      <FloatingTradeWidget />
    </main>
  )
}
