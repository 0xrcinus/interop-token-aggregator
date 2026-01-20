import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  serial,
  index,
  unique,
} from "drizzle-orm/pg-core"

/**
 * Tracks each fetch attempt from a provider
 */
export const providerFetches = pgTable("provider_fetches", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  success: boolean("success").notNull(),
  chainsCount: integer("chains_count"),
  tokensCount: integer("tokens_count"),
  errorMessage: text("error_message"),
})

/**
 * Normalized chain data across all providers
 * Enhanced with metadata from chain registries
 */
export const chains = pgTable("chains", {
  chainId: bigint("chain_id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  nativeCurrencyName: text("native_currency_name").notNull(),
  nativeCurrencySymbol: text("native_currency_symbol").notNull(),
  nativeCurrencyDecimals: integer("native_currency_decimals").notNull(),
  // Enhanced metadata
  shortName: text("short_name"), // e.g., "eth", "matic"
  chainType: text("chain_type"), // e.g., "mainnet", "testnet"
  vmType: text("vm_type"), // e.g., "evm", "svm" (Solana VM), null for unknown
  icon: text("icon"), // Icon/logo URL or identifier
  infoUrl: text("info_url"), // Official website
  explorers: jsonb("explorers").$type<Array<{
    name: string
    url: string
    standard: string
  }>>(), // Block explorer URLs
  rpc: jsonb("rpc").$type<string[]>(), // RPC endpoint URLs
  faucets: jsonb("faucets").$type<string[]>(), // Testnet faucet URLs
  ens: jsonb("ens").$type<{ registry?: string }>(), // ENS registry info
  features: jsonb("features").$type<Array<{ name: string }>>(), // Chain features (EIP support, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/**
 * Tracks which providers support which chains
 */
export const chainProviderSupport = pgTable(
  "chain_provider_support",
  {
    id: serial("id").primaryKey(),
    chainId: bigint("chain_id", { mode: "number" })
      .notNull()
      .references(() => chains.chainId),
    providerName: text("provider_name").notNull(),
    fetchId: integer("fetch_id")
      .notNull()
      .references(() => providerFetches.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    chainProviderIdx: index("chain_provider_idx").on(
      table.chainId,
      table.providerName
    ),
  })
)

/**
 * Token instances on specific chains from specific providers
 * raw_data stores the complete original token object from provider's API
 */
export const tokens = pgTable(
  "tokens",
  {
    id: serial("id").primaryKey(),
    providerName: text("provider_name").notNull(),
    chainId: bigint("chain_id", { mode: "number" })
      .notNull()
      .references(() => chains.chainId),
    address: text("address").notNull(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    decimals: integer("decimals"), // Optional - some providers don't provide this
    logoUri: text("logo_uri"),
    tags: jsonb("tags").$type<string[]>(),
    fetchId: integer("fetch_id")
      .notNull()
      .references(() => providerFetches.id),
    rawData: jsonb("raw_data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    providerChainAddressUnique: unique("provider_chain_address_unique").on(
      table.providerName,
      table.chainId,
      table.address
    ),
    providerChainAddressIdx: index("provider_chain_address_idx").on(
      table.providerName,
      table.chainId,
      table.address
    ),
    symbolIdx: index("symbol_idx").on(table.symbol),
  })
)
