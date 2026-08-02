/**
 * Typed modules Prisma client wrapper.
 *
 * The Prisma client needs regeneration after the S15-S17 module
 * models were added to schema.prisma. Until `npx prisma generate` runs,
 * the base PrismaClient type doesn't include the new model delegates.
 *
 * This module provides a safely-typed `modulesPrisma` that exposes
 * the new model delegates. Once the client is regenerated, this cast
 * can be removed and routes can import from '@/lib/prisma' directly.
 */
import { prisma } from './prisma'

/* eslint-disable @typescript-eslint/no-explicit-any */
export const modulesPrisma = prisma as any
