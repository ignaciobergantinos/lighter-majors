// ── Desktop Titlebar — Drag Region + Window Controls ────────
// Adapts to compact widths by hiding brand text
// Offsets content on macOS to avoid overlapping traffic-light buttons
'use client'
import { Minus, X, TrendingUp, Pin, PinOff } from 'lucide-react'
import { getElectronAPI } from '@/hooks/useElectron'
import { useWidgetStore } from '@/store/widget-store'

/** Width reserved for macOS traffic-light buttons (close/minimize/maximize) */
const MACOS_TRAFFIC_LIGHT_WIDTH = 70

interface DesktopTitleBarProps {
  /** Hide brand text to save horizontal space */
  compact?: boolean
}

export function DesktopTitleBar({ compact }: DesktopTitleBarProps) {
  const api = getElectronAPI()
  const isMac = api?.platform === 'darwin'
  const { isPinned, togglePinned } = useWidgetStore()

  return (
    <div
      className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 border-b border-zinc-800/60 shrink-0"
      style={{
        WebkitAppRegion: 'drag',
        // Reserve space for macOS traffic-light buttons on the left
        paddingLeft: isMac ? MACOS_TRAFFIC_LIGHT_WIDTH : undefined,
      } as React.CSSProperties}
    >
      {/* Brand — collapses to icon-only when compact */}
      <div className="flex items-center gap-1.5 min-w-0">
        <TrendingUp size={compact ? 12 : 14} className="text-emerald-400 shrink-0" />
        {!compact && (
          <span className="text-xs font-semibold text-zinc-400 select-none truncate">
            Lighter Majors
          </span>
        )}
      </div>

      {/* Window Controls — non-draggable */}
      <div
        className="flex items-center gap-0.5 sm:gap-1 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={togglePinned}
          className={`p-0.5 sm:p-1 rounded transition-colors ${
            isPinned
              ? 'text-emerald-400 hover:bg-emerald-500/15'
              : 'text-zinc-500 hover:bg-zinc-800'
          }`}
          aria-label={isPinned ? 'Unpin widget' : 'Pin widget'}
          title={isPinned ? 'Unpin (allow repositioning)' : 'Pin (lock position)'}
        >
          {isPinned ? <Pin size={12} /> : <PinOff size={12} />}
        </button>
        <button
          onClick={() => api?.minimizeToTray()}
          className="p-0.5 sm:p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Minimize to tray"
          title="Minimize to tray"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => api?.quit()}
          className="p-0.5 sm:p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
          aria-label="Quit application"
          title="Quit"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
