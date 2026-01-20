import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import { Config, Layer } from "effect"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/**
 * SQL client layer using Effect's PostgreSQL client
 * Reads connection details from environment variables
 */
export const SqlLive = PgClient.layer({
  host: Config.string("DATABASE_HOST").pipe(Config.withDefault("localhost")),
  port: Config.integer("DATABASE_PORT").pipe(Config.withDefault(5433)),
  database: Config.string("DATABASE_NAME").pipe(Config.withDefault("tokendb")),
  username: Config.string("DATABASE_USER").pipe(Config.withDefault("dev")),
  password: Config.secret("DATABASE_PASSWORD"),
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
 */
export function createDrizzleClient() {
  const connectionString =
    process.env.DATABASE_URL || "postgresql://dev:dev@localhost:5433/tokendb"
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}
