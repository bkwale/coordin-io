import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a Prisma client using the PrismaPg adapter (Prisma v7).
 *
 * Connection strategy:
 * - DIRECT_URL (port 5432): Used when available — bypasses PgBouncer.
 *   Required for interactive transactions ($transaction with callbacks).
 * - DATABASE_URL (port 6543): Falls back to pooled PgBouncer connection.
 *   Works for simple queries but may fail on interactive transactions.
 *
 * Set both in .env.local for production:
 *   DATABASE_URL=postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true
 *   DIRECT_URL=postgresql://...@db.supabase.com:5432/postgres
 */
function createPrismaClient() {
  // Prefer direct connection for transaction safety
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL

  if (!connectionString) {
    // During Vercel build (static analysis), DB isn't available.
    // Return a proxy that throws on actual use at runtime.
    if (process.env.VERCEL_ENV || process.env.CI) {
      return new Proxy({} as PrismaClient, {
        get(_target, prop) {
          if (prop === 'then' || prop === Symbol.toPrimitive) return undefined
          throw new Error(
            `Prisma client accessed without DATABASE_URL (property: ${String(prop)})`,
          )
        },
      })
    }
    throw new Error(
      'Neither DIRECT_URL nor DATABASE_URL is set. ' +
        'Add your Supabase database connection string to .env.local',
    )
  }

  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
