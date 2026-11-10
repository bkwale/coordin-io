/**
 * Encryption at rest for integration secrets (Xero / Microsoft OAuth tokens). AES-256-GCM with a key that lives
 * only in the environment (INTEGRATION_ENCRYPTION_KEY: 32 bytes, base64 or hex), never in the database.
 * Values are stored as "enc:v1:<base64 iv|tag|ciphertext>". Old plain values still read, and are re-sealed on next write.
 * Server-only.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'
let warned = false

function key(): Buffer | null {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!raw) return null
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (buf.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters)')
  return buf
}

export function sealSecret(plain: string): string {
  if (!plain || plain.startsWith(PREFIX)) return plain
  const k = key()
  if (!k) {
    // Live sites must never store tokens in plain text
    if (process.env.VERCEL_ENV === 'production' || process.env.REQUIRE_INTEGRATION_ENCRYPTION === 'on') {
      throw new Error('INTEGRATION_ENCRYPTION_KEY is not set — integration tokens cannot be stored')
    }
    if (!warned) { warned = true; console.warn(JSON.stringify({ level: 'warn', event: 'integration_secret_unencrypted', hint: 'set INTEGRATION_ENCRYPTION_KEY' })) }
    return plain
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', k, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')
}

export function openSecret(stored: string | null | undefined): string {
  if (!stored) return ''
  if (!stored.startsWith(PREFIX)) return stored // written before encryption was switched on
  const k = key()
  if (!k) throw new Error('Integration secret is encrypted but INTEGRATION_ENCRYPTION_KEY is not set')
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64')
  const decipher = createDecipheriv('aes-256-gcm', k, buf.subarray(0, 12))
  decipher.setAuthTag(buf.subarray(12, 28))
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
}
