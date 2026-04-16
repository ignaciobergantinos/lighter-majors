// ── Desktop Titlebar — Drag Region + Window Controls ────────
'use client'
import { Minus, X, TrendingUp } from 'lucide-react'
import { getElectronAPI } from '@/hooks/useElectron'

export function DesktopTitleBar() {
  const api = getElectronAPI()

  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Brand */}
      <div className="flex items-center gap-1.5">
        <TrendingUp size={14} className="text-emerald-400" />
        <span className="text-xs font-semibold text-zinc-400 select-none">
          Lighter Majors
        </span>
      </div>

      {/* Window Controls — non-draggable */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => api?.minimizeToTray()}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Minimize to tray"
          title="Minimize to tray"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => api?.quit()}
          className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
          aria-label="Quit application"
          title="Quit"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
