// ── User Preferences Persistence ──────────────────────────
// Saves and restores user preferences (selected symbol, USD sizes)
// to a JSON file in the app's userData directory.
// Mirrors the pattern established in window-state.ts.

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// ── Types ──────────────────────────────────────────────────

export interface UserPreferences {
  isPinned?: boolean
  activeTab?: string
  usdSizes?: Record<string, string>
  wtiIsPinned?: boolean
  wtiUsdSize?: string
}

// ── Constants ──────────────────────────────────────────────

const PREFS_FILENAME = 'user-preferences.json'

// ── Helpers ────────────────────────────────────────────────

function getPrefsPath(): string {
  return path.join(app.getPath('userData'), PREFS_FILENAME)
}

// ── Public API ─────────────────────────────────────────────

/**
 * Load saved user preferences from disk.
 * Returns null if the file doesn't exist or is corrupted.
 */
export function loadPreferences(): UserPreferences | null {
  try {
    const raw = fs.readFileSync(getPrefsPath(), 'utf-8')
    const prefs = JSON.parse(raw)

    // Basic shape validation
    if (prefs && typeof prefs === 'object') {
      return prefs as UserPreferences
    }
  } catch {
    // File doesn't exist or is malformed — return null
  }

  return null
}

/**
 * Persist user preferences to disk.
 * Writes atomically (write to temp file, then rename).
 */
export function savePreferences(prefs: UserPreferences): void {
  const prefsPath = getPrefsPath()

  try {
    const tmpPath = prefsPath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(prefs, null, 2), 'utf-8')
    fs.renameSync(tmpPath, prefsPath)
  } catch {
    console.error('[preferences-store] Failed to save user preferences')
  }
}
