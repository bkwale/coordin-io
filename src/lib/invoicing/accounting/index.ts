/**
 * Accounting adapter registry — adapted from Morway for Coordin
 *
 * Returns the right adapter based on the organisation's configured accounting system.
 *
 * TODO: Wire to Coordin's Prisma schema once accounting integration models are added.
 * The organisation model will need an `accountingSystem` field.
 */

import type { AccountingAdapter } from './types'

// TODO: Define these as an enum in Coordin's constants
export type AccountingSystem =
  | 'XERO'
  | 'EXACT_ONLINE'
  | 'DATEV'
  | 'LEXWARE'
  | 'FEC'
  | 'PENNYLANE'
  | 'MONEYBIRD'
  | 'TWINFIELD'
  | 'OCTOPUS'
  | 'NONE'

/**
 * Get the appropriate accounting adapter for an organisation.
 * Returns null if no accounting system is configured.
 *
 * TODO: Replace this stub with Prisma lookup once the schema is extended.
 * Each adapter will be lazily imported to avoid loading all SDKs at once.
 */
export async function getAdapter(orgId: string, system: AccountingSystem): Promise<AccountingAdapter | null> {
  switch (system) {
    case 'XERO': {
      // TODO: Lazy import Xero adapter when built
      // const { xeroAdapter } = await import('./xero')
      // return xeroAdapter
      console.warn('[invoicing] Xero adapter not yet implemented for Coordin')
      return null
    }

    case 'EXACT_ONLINE':
    case 'DATEV':
    case 'LEXWARE':
    case 'FEC':
    case 'PENNYLANE':
    case 'MONEYBIRD':
    case 'TWINFIELD':
    case 'OCTOPUS': {
      // TODO: Import adapters as they're built
      console.warn(`[invoicing] ${system} adapter not yet implemented for Coordin`)
      return null
    }

    case 'NONE':
    default:
      return null
  }
}

export type { AccountingAdapter, BillPayload, PostResult, ContactResult, BillLineItem } from './types'
