import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import { Config, Effect, Layer, Redacted } from "effect"
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
 *
 * Updated for Effect 0.94+: Uses Layer.unwrapEffect to resolve Config values
 */
export const SqlLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const host = yield* Config.string("POSTGRES_HOST").pipe(Config.withDefault("localhost"))
    const port = yield* Config.integer("POSTGRES_PORT").pipe(Config.withDefault(5433))
    const database = yield* Config.string("POSTGRES_DATABASE").pipe(Config.withDefault("tokendb"))
    const username = yield* Config.string("POSTGRES_USER").pipe(Config.withDefault("dev"))
    const password = yield* Config.redacted("POSTGRES_PASSWORD").pipe(
      Config.withDefault(Redacted.make("dev"))
    )
    const ssl = yield* Config.boolean("POSTGRES_SSL").pipe(Config.withDefault(false))

    return PgClient.layer({
      host,
      port,
      database,
      username,
      password,
      ssl,
    })
  })
)

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
