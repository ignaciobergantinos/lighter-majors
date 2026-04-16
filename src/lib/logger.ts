// ── Structured JSON Logger for Trade Operations ─────────────
import { randomUUID } from 'crypto'

// ── Types ─────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  correlationId: string
  event: string
  durationMs?: number
  [key: string]: unknown
}

// ── Sensitive field stripping ─────────────────────────────

const REDACTED_KEYS = new Set([
  'authorization',
  'auth',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'password',
  'private_key',
  'privateKey',
])

function sanitize<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitize) as T

  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) {
      clean[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value)
    } else {
      clean[key] = value
    }
  }
  return clean as T
}

// ── Core logging ──────────────────────────────────────────

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? 'info'

function emit(entry: LogEntry): void {
  if (LOG_LEVEL_PRIORITY[entry.level] < LOG_LEVEL_PRIORITY[MIN_LEVEL]) return

  const output = JSON.stringify(sanitize(entry))

  switch (entry.level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    default:
      console.log(output)
  }
}

// ── Public API ────────────────────────────────────────────

/** Generate a new correlation ID for request tracing */
export function correlationId(): string {
  return randomUUID().slice(0, 8)
}

/** Create a scoped logger bound to a correlation ID */
export function createLogger(cid: string) {
  function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
    emit({
      timestamp: new Date().toISOString(),
      level,
      correlationId: cid,
      event,
      ...data,
    })
  }

  return {
    debug: (event: string, data?: Record<string, unknown>) => log('debug', event, data),
    info:  (event: string, data?: Record<string, unknown>) => log('info', event, data),
    warn:  (event: string, data?: Record<string, unknown>) => log('warn', event, data),
    error: (event: string, data?: Record<string, unknown>) => log('error', event, data),
  }
}

/** Measure async operation duration and log start/end */
export async function withTiming<T>(
  logger: ReturnType<typeof createLogger>,
  event: string,
  data: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now()

  try {
    const result = await fn()
    return result
  } catch (err) {
    const durationMs = Math.round(performance.now() - start)
    logger.error(`${event}.error`, {
      ...data,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    throw err
  }
}
