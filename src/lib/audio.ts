// ── Audio Feedback ─────────────────────────────────────────
// Lightweight Web Audio API tones for trade execution feedback.
// No external audio files required.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  // Resume if suspended (browsers require user gesture first)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * Play a pleasant two-tone chime (success).
 * ~200ms total duration — C5 then E5, gentle sine wave.
 */
export function playSuccessSound(): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    // First tone: C5 (523 Hz)
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523, now)
    osc1.connect(gain)
    osc1.start(now)
    osc1.stop(now + 0.12)

    // Second tone: E5 (659 Hz) — starts slightly after first
    const gain2 = ctx.createGain()
    gain2.connect(ctx.destination)
    gain2.gain.setValueAtTime(0.15, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(659, now + 0.08)
    osc2.connect(gain2)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.25)
  } catch {
    // Audio not available — silently ignore
  }
}

/**
 * Play a short tick (shortcut press).
 * ~60ms — crisp high-pitched sine with fast decay.
 */
export function playShortcutSound(): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.08)
  } catch {
    // Audio not available — silently ignore
  }
}

/**
 * Play a low warning buzz (error).
 * ~250ms — low-frequency square wave with quick decay.
 */
export function playErrorSound(): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    // Low buzz: A3 (220 Hz) square wave
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.linearRampToValueAtTime(160, now + 0.25)
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.25)
  } catch {
    // Audio not available — silently ignore
  }
}
