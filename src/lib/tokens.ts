import { randomBytes } from 'crypto'

/**
 * Generate a cryptographically secure token for invitation links.
 * Uses crypto.randomBytes — NOT cuid/uuid which are partially predictable.
 *
 * Output: 64-character hex string (32 bytes of entropy)
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}
