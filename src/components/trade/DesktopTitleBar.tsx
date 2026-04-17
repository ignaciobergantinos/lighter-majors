// ── Desktop Titlebar — Drag Region + Window Controls ────────
// Adapts to compact widths by hiding brand text
// Offsets content on macOS to avoid overlapping traffic-light buttons
// Shows total position exposure & leverage multiplier when positions are open
'use client'
import { Minus, X, TrendingUp, Pin, PinOff, Volume2, VolumeOff } from 'lucide-react'
import { getElectronAPI } from '@/hooks/useElectron'
import { useWidgetStore } from '@/store/widget-store'

/** Width reserved for macOS traffic-light buttons (close/minimize/maximize) */
const MACOS_TRAFFIC_LIGHT_WIDTH = 70

/** Returns Tailwind text color: yellow if MIX or >42x, red if SHORT, green otherwise */
function getExposureColor(direction?: 'LONG' | 'SHORT' | 'MIX', multiplier = 0): string {
  if (direction === 'MIX' || multiplier >= 42) return 'text-yellow-400'
  if (direction === 'SHORT') return 'text-red-400'
  return 'text-emerald-400'
}

interface DesktopTitleBarProps {
  /** Hide brand text to save horizontal space */
  compact?: boolean
  /** Total USD exposure across all open positions */
  totalExposure?: number
  /** Leverage multiplier (totalExposure / balance) */
  leverageMultiplier?: number
  /** Whether there are open positions */
  hasPositions?: boolean
  /** Aggregate position direction: LONG, SHORT, or MIX */
  positionDirection?: 'LONG' | 'SHORT' | 'MIX'
}

export function DesktopTitleBar({ compact, totalExposure, leverageMultiplier, hasPositions, positionDirection }: DesktopTitleBarProps) {
  const api = getElectronAPI()
  const isMac = api?.platform === 'darwin'
  const { isPinned, togglePinned, soundEnabled, toggleSound } = useWidgetStore()

  return (
    <div
      className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 border-b border-zinc-800/60 shrink-0"
      style={{
        WebkitAppRegion: isPinned ? 'no-drag' : 'drag',
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
        {/* Position Exposure Indicator — shown when positions are open */}
        {hasPositions && totalExposure != null && totalExposure > 0 && leverageMultiplier != null && (
          <span
            className={`text-[9px] sm:text-[10px] font-semibold mr-1 sm:mr-1.5 select-none ${getExposureColor(positionDirection, leverageMultiplier)}`}
            title={`Total exposure: $${totalExposure.toFixed(0)} — Leverage: ${leverageMultiplier.toFixed(2)}× balance`}
          >
            ${totalExposure.toFixed(0)}{' '}
            <span className="opacity-75">(x{leverageMultiplier.toFixed(2)})</span>
            {positionDirection && (
              <span className="ml-1">
                {positionDirection}
              </span>
            )}
          </span>
        )}
        <button
          onClick={toggleSound}
          className={`p-0.5 sm:p-1 rounded transition-colors ${
            soundEnabled
              ? 'text-zinc-400 hover:bg-zinc-800'
              : 'text-zinc-600 hover:bg-zinc-800'
          }`}
          aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          title={soundEnabled ? 'Mute trade sounds' : 'Unmute trade sounds'}
        >
          {soundEnabled ? <Volume2 size={12} /> : <VolumeOff size={12} />}
        </button>
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
