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

const EDGE_MARGIN = 24

export interface WindowStateConfig {
  /** Filename inside userData (each window gets its own state file) */
  filename: string
  defaultWidth: number
  defaultHeight: number
  /** Vertical offset above the bottom edge — lets multiple windows stack. */
  bottomOffset?: number
}

export const MAIN_WINDOW_CONFIG: WindowStateConfig = {
  filename: 'window-state.json',
  defaultWidth: 420,
  defaultHeight: 680,
}

export const WTI_WINDOW_CONFIG: WindowStateConfig = {
  filename: 'wti-window-state.json',
  defaultWidth: 220,
  defaultHeight: 140,
  // Sit just above the main widget by default
  bottomOffset: 720,
}

// ── Helpers ────────────────────────────────────────────────

function getStatePath(filename: string): string {
  return path.join(app.getPath('userData'), filename)
}

/** Compute default bottom-right position based on primary display */
export function getDefaultBounds(config: WindowStateConfig): WindowBounds {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const verticalGap = config.bottomOffset ?? config.defaultHeight + EDGE_MARGIN
  return {
    x: sw - config.defaultWidth - EDGE_MARGIN,
    y: sh - verticalGap,
    width: config.defaultWidth,
    height: config.defaultHeight,
  }
}

/**
 * Ensure bounds are visible on at least one connected display.
 * If the saved position is completely offscreen (e.g. external monitor
 * disconnected), reset to the default bottom-right position while
 * preserving the saved dimensions.
 */
function ensureBoundsOnScreen(
  bounds: WindowBounds,
  config: WindowStateConfig,
): WindowBounds {
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
  const defaults = getDefaultBounds(config)
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
export function loadWindowState(config: WindowStateConfig): WindowBounds {
  try {
    const raw = fs.readFileSync(getStatePath(config.filename), 'utf-8')
    const state: WindowStateFile = JSON.parse(raw)

    if (
      state?.bounds &&
      typeof state.bounds.x === 'number' &&
      typeof state.bounds.y === 'number' &&
      typeof state.bounds.width === 'number' &&
      typeof state.bounds.height === 'number'
    ) {
      return ensureBoundsOnScreen(state.bounds, config)
    }
  } catch {
    // File doesn't exist or is malformed — use defaults
  }

  return getDefaultBounds(config)
}

/**
 * Persist current window bounds to disk.
 * Writes atomically (write to temp file, then rename).
 */
export function saveWindowState(
  config: WindowStateConfig,
  bounds: WindowBounds,
): void {
  const state: WindowStateFile = { bounds }
  const statePath = getStatePath(config.filename)

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
export function clearWindowState(config: WindowStateConfig): void {
  try {
    fs.unlinkSync(getStatePath(config.filename))
  } catch {
    // File may not exist — that's fine
  }
}
