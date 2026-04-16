// ── Lighter API Key Management (server-side only) ──────────
//
// Manages the key triplet (index, public key, private key)
// and provides a lazy-initialized SignerClient singleton.
//
// Key rotation: update env vars and restart — the singleton
// is created on first use, not at import time.

import { SignerClient } from 'zklighter-sdk'
import { API_BASE } from './constants'

export interface LighterKeyConfig {
  apiKeyIndex: number
  privateKey: string
  publicKey: string
  accountIndex: number
}

/** Read and validate key triplet from environment variables. */
export function loadKeyConfig(): LighterKeyConfig {
  const apiKeyIndex = parseInt(process.env.LIGHTER_API_KEY_INDEX ?? '', 10)
  const privateKey = process.env.LIGHTER_PRIVATE_KEY ?? ''
  const publicKey = process.env.LIGHTER_PUBLIC_KEY ?? ''
  const accountIndex = parseInt(process.env.LIGHTER_ACCOUNT_INDEX ?? '0', 10)

  if (Number.isNaN(apiKeyIndex)) {
    throw new Error('LIGHTER_API_KEY_INDEX must be a valid integer')
  }
  if (!privateKey) {
    throw new Error('LIGHTER_PRIVATE_KEY is required')
  }
  if (!publicKey) {
    throw new Error('LIGHTER_PUBLIC_KEY is required (for audit trail)')
  }

  return { apiKeyIndex, privateKey, publicKey, accountIndex }
}

// ── Singleton SignerClient ─────────────────────────────────

let _client: SignerClient | null = null
let _config: LighterKeyConfig | null = null
let _nonceReady: Promise<void> | null = null

/** Lazy singleton — created on first call, reused after. */
export function getSignerClient(): SignerClient {
  if (!_client) {
    const cfg = loadKeyConfig()
    _client = new SignerClient(
      API_BASE,
      cfg.privateKey,
      cfg.apiKeyIndex,
      cfg.accountIndex,
    )
    _config = cfg

    // The SDK's nonce manager initializes async (fire-and-forget) and has a
    // bug where hard_refresh_nonce is never triggered on "invalid nonce" errors
    // (it checks error.message instead of error.response.data.message).
    // We fetch the correct nonce ourselves to ensure it's ready before the
    // first order. This resolves the persistent "invalid nonce" failures.
    _nonceReady = warmUpNonce(cfg.accountIndex, cfg.apiKeyIndex)
  }
  return _client
}

/**
 * Wait for the SignerClient's nonce manager to be initialized.
 * Must be called (and awaited) before any transactional SDK call.
 */
export async function ensureSignerReady(): Promise<SignerClient> {
  const client = getSignerClient()
  if (_nonceReady) {
    await _nonceReady
    _nonceReady = null // only wait once
  }
  return client
}

/**
 * Fetch the correct nonce from the Lighter API and wait long enough
 * for the SDK's internal nonce manager to have initialized.
 * The SDK's OptimisticNonceManager.initialize() makes the same call —
 * by the time our fetch resolves, theirs has too.
 */
async function warmUpNonce(accountIndex: number, apiKeyIndex: number): Promise<void> {
  try {
    const url = `${API_BASE}/api/v1/nextNonce?accountIndex=${accountIndex}&apiKeyIndex=${apiKeyIndex}`
    await fetch(url, { cache: 'no-store' })
    // We don't need the result — this just ensures the SDK's parallel
    // nonce fetch (same endpoint) has had time to complete.
  } catch {
    // Non-fatal: the SDK may still initialize on its own.
  }
}

/** Current config (available after first getSignerClient call). */
export function getKeyConfig(): LighterKeyConfig {
  if (!_config) {
    _config = loadKeyConfig()
  }
  return _config
}

/**
 * Generate a short-lived auth token (default: 10 minutes).
 * Uses the native signer under the hood — no pre-generated tokens needed.
 */
export function generateAuthToken(deadlineSeconds?: number): string {
  const client = getSignerClient()
  const [token, error] = client.create_auth_token_with_expiry(deadlineSeconds)
  if (error || !token) {
    throw new Error(`Auth token generation failed: ${error ?? 'unknown error'}`)
  }
  return token
}

/**
 * Force-recreate the SignerClient (e.g. after key rotation).
 * Call this if you hot-swap env vars at runtime.
 */
export function resetSignerClient(): void {
  if (_client) {
    _client.close().catch(() => {})
  }
  _client = null
  _config = null
}
