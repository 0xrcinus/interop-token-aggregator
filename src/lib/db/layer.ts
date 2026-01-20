import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import { Config, Layer, Redacted } from "effect"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/**
 * SQL client layer using Effect's PostgreSQL client
 *
 * Uses individual connection parameters for maximum compatibility
 * Works with both local PostgreSQL and cloud databases like Neon
 *
 * Environment variables:
 * - POSTGRES_HOST (default: localhost)
 * - POSTGRES_PORT (default: 5433 for local, 5432 for Neon)
 * - POSTGRES_DATABASE (default: tokendb)
 * - POSTGRES_USER (default: dev)
 * - POSTGRES_PASSWORD (default: dev for local development)
 * - POSTGRES_SSL (default: false for local, true for Neon)
 *
 * Note: The standalone Drizzle client uses DATABASE_URL (see createDrizzleClient)
 */
export const SqlLive = PgClient.layer({
  host: Config.string("POSTGRES_HOST").pipe(Config.withDefault("localhost")),
  port: Config.integer("POSTGRES_PORT").pipe(Config.withDefault(5433)),
  database: Config.string("POSTGRES_DATABASE").pipe(Config.withDefault("tokendb")),
  username: Config.string("POSTGRES_USER").pipe(Config.withDefault("dev")),
  password: Config.redacted("POSTGRES_PASSWORD").pipe(Config.withDefault(Redacted.make("dev"))),
  ssl: Config.boolean("POSTGRES_SSL").pipe(Config.withDefault(false)),
})

/**
 * Drizzle ORM layer integrated with Effect SQL
 * Using provideMerge as per Effect test patterns
 */
export const DrizzleLive = PgDrizzle.layer.pipe(Layer.provideMerge(SqlLive))

/**
 * Combined database layer with both SQL client and Drizzle
 */
export const DatabaseLive = Layer.mergeAll(SqlLive, DrizzleLive)

/**
 * Create a standalone Drizzle client for use outside of Effect
 * Useful for Next.js API routes
 *
 * Uses DATABASE_URL if available, falls back to local connection string
 */
export function createDrizzleClient() {
  const connectionString =
    process.env.DATABASE_URL || "postgresql://dev:dev@localhost:5433/tokendb"
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}
