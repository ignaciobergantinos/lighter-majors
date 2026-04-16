// ── Window State Persistence ───────────────────────────────
// Saves and restores window bounds (position + dimensions) to a
// JSON file in the app's userData directory. No external dependencies.

import { app, screen } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// ── Types ──────────────────────────────────────────────────

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

interface WindowStateFile {
  bounds: WindowBounds
}

// ── Defaults ───────────────────────────────────────────────

const DEFAULT_WIDTH = 420
const DEFAULT_HEIGHT = 680
const EDGE_MARGIN = 24

const STATE_FILENAME = 'window-state.json'

// ── Helpers ────────────────────────────────────────────────

function getStatePath(): string {
  return path.join(app.getPath('userData'), STATE_FILENAME)
}

/** Compute default bottom-right position based on primary display */
export function getDefaultBounds(): WindowBounds {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  return {
    x: sw - DEFAULT_WIDTH - EDGE_MARGIN,
    y: sh - DEFAULT_HEIGHT - EDGE_MARGIN,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  }
}

/**
 * Ensure bounds are visible on at least one connected display.
 * If the saved position is completely offscreen (e.g. external monitor
 * disconnected), reset to the default bottom-right position while
 * preserving the saved dimensions.
 */
function ensureBoundsOnScreen(bounds: WindowBounds): WindowBounds {
  const displays = screen.getAllDisplays()

  // Check if at least a 50×50 px region of the window is visible
  // on any display's work area
  const MIN_VISIBLE = 50
  const isVisible = displays.some((display) => {
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea
    const overlapX = Math.max(
      0,
      Math.min(bounds.x + bounds.width, dx + dw) - Math.max(bounds.x, dx),
    )
    const overlapY = Math.max(
      0,
      Math.min(bounds.y + bounds.height, dy + dh) - Math.max(bounds.y, dy),
    )
    return overlapX >= MIN_VISIBLE && overlapY >= MIN_VISIBLE
  })

  if (isVisible) return bounds

  // Position is offscreen — reset position but keep saved size
  const defaults = getDefaultBounds()
  return {
    x: defaults.x,
    y: defaults.y,
    width: bounds.width,
    height: bounds.height,
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Load saved window bounds from disk.
 * Returns validated bounds, falling back to defaults if the file
 * doesn't exist or is corrupted.
 */
export function loadWindowState(): WindowBounds {
  try {
    const raw = fs.readFileSync(getStatePath(), 'utf-8')
    const state: WindowStateFile = JSON.parse(raw)

    if (
      state?.bounds &&
      typeof state.bounds.x === 'number' &&
      typeof state.bounds.y === 'number' &&
      typeof state.bounds.width === 'number' &&
      typeof state.bounds.height === 'number'
    ) {
      return ensureBoundsOnScreen(state.bounds)
    }
  } catch {
    // File doesn't exist or is malformed — use defaults
  }

  return getDefaultBounds()
}

/**
 * Persist current window bounds to disk.
 * Writes atomically (write to temp file, then rename).
 */
export function saveWindowState(bounds: WindowBounds): void {
  const state: WindowStateFile = { bounds }
  const statePath = getStatePath()

  try {
    const tmpPath = statePath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8')
    fs.renameSync(tmpPath, statePath)
  } catch {
    // Non-critical — log but don't crash
    console.error('[window-state] Failed to save window bounds')
  }
}

/**
 * Delete the persisted state file (used by "Reset Position" tray action).
 */
export function clearWindowState(): void {
  try {
    fs.unlinkSync(getStatePath())
  } catch {
    // File may not exist — that's fine
  }
}
