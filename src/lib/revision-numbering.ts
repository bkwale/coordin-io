import { prisma } from '@/lib/prisma'

/**
 * Document revision auto-numbering.
 *
 * Convention:
 * - Preliminary revisions: P01, P02, P03, ...
 * - Construction/issued revisions: C01, C02, C03, ...
 *
 * The prefix indicates the revision category.
 * The number is auto-incremented per document per prefix.
 */

export type RevisionPrefix = 'P' | 'C'

/**
 * Format a revision code from prefix and sequence number.
 * Examples: P01, P02, C01, C03
 */
export function formatRevisionCode(prefix: RevisionPrefix, sequence: number): string {
  return `${prefix}${String(sequence).padStart(2, '0')}`
}

/**
 * Parse a revision code into its prefix and sequence number.
 * Returns null if the format is invalid.
 */
export function parseRevisionCode(revision: string): { prefix: RevisionPrefix; sequence: number } | null {
  const match = revision.match(/^([PC])(\d{2,})$/)
  if (!match) return null
  return {
    prefix: match[1] as RevisionPrefix,
    sequence: parseInt(match[2], 10),
  }
}

/**
 * Get the next revision code for a document.
 * Queries existing revisions and increments the highest sequence number for the given prefix.
 *
 * @param documentId - The document to get the next revision for
 * @param prefix - 'P' for preliminary, 'C' for construction/issued
 * @returns The next revision code (e.g., "P03" if P02 exists, "C01" if no C revisions exist)
 */
export async function getNextRevisionCode(
  documentId: string,
  prefix: RevisionPrefix = 'P',
): Promise<string> {
  const revisions = await prisma.documentRevision.findMany({
    where: { documentId },
    select: { revision: true },
    orderBy: { createdAt: 'desc' },
  })

  let maxSequence = 0

  for (const rev of revisions) {
    const parsed = parseRevisionCode(rev.revision)
    if (parsed && parsed.prefix === prefix && parsed.sequence > maxSequence) {
      maxSequence = parsed.sequence
    }
  }

  return formatRevisionCode(prefix, maxSequence + 1)
}

/**
 * Determine the appropriate revision prefix based on document status.
 * Work in progress / internal = P (Preliminary)
 * Approved for issue / issued = C (Construction)
 */
export function getRevisionPrefix(isIssuedForConstruction: boolean): RevisionPrefix {
  return isIssuedForConstruction ? 'C' : 'P'
}

/**
 * Compare two revision codes. Returns negative if a < b, 0 if equal, positive if a > b.
 * C revisions are always "later" than P revisions.
 * Within the same prefix, higher numbers are later.
 */
export function compareRevisions(a: string, b: string): number {
  const parsedA = parseRevisionCode(a)
  const parsedB = parseRevisionCode(b)

  if (!parsedA || !parsedB) return 0

  // C > P
  if (parsedA.prefix !== parsedB.prefix) {
    return parsedA.prefix === 'C' ? 1 : -1
  }

  return parsedA.sequence - parsedB.sequence
}
