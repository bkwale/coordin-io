// Coordin.io — Prisma Configuration
// Uses Supabase PostgreSQL with connection pooling
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js uses .env.local — load that first, then fall back to .env
config({ path: ".env.local" });
config(); // .env fallback

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DIRECT_URL for migrations (PgBouncer breaks interactive transactions).
    // Falls back to DATABASE_URL if DIRECT_URL is not set.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
