import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a Prisma client using the PrismaPg adapter (Prisma v7).
 *
 * Connection strategy:
 * - DATABASE_URL (port 6543): Preferred — uses Supabase's Supavisor pooler
 *   (PgBouncer-compatible). Handles connection limits in serverless (Vercel)
 *   where many function instances share a small pool.
 * - DIRECT_URL (port 5432): Fallback — bypasses pooler. Only use locally
 *   or for migrations/schema pushes. In production this exhausts the
 *   15-connection session-mode limit under concurrent load.
 *
 * Set both in .env.local for production:
 *   DATABASE_URL=postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true
 *   DIRECT_URL=postgresql://...@pooler.supabase.com:5432/postgres
 */
function createPrismaClient() {
  // Prefer pooled connection to avoid EMAXCONNSESSION in serverless
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL

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
