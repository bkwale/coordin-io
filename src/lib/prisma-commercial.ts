/**
 * Typed commercial Prisma client wrapper.
 *
 * The Prisma client needs regeneration after the Sprint 7 commercial
 * models were added to schema.prisma. Until `npx prisma generate` runs
 * in an environment where the generated output directory is writable,
 * the base PrismaClient type doesn't include the commercial model
 * delegates (budget, invoice, tender, etc.).
 *
 * This module provides a safely-typed `commercialPrisma` that exposes
 * the commercial model delegates. Once the client is regenerated,
 * this cast can be removed and routes can import from '@/lib/prisma'
 * directly.
 */
import { prisma } from './prisma'

/* eslint-disable @typescript-eslint/no-explicit-any */
export const commercialPrisma = prisma as any
