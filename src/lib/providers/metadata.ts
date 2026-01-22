/**
 * Provider Links and Information
 *
 * Contains documentation links, API endpoints, and other metadata for each provider.
 * Used in the provider detail pages to show users where to find more information.
 */

export interface ProviderInfo {
  name: string
  displayName: string
  description: string
  website?: string
  docs?: string
  apiEndpoint?: string
  github?: string
  notes?: string[]
}

export const PROVIDER_INFO: Record<string, ProviderInfo> = {
  relay: {
    name: "relay",
    displayName: "Relay",
    description: "Cross-chain bridge protocol supporting both EVM and non-EVM chains",
    website: "https://relay.link",
    docs: "https://docs.relay.link/references/api/get-chains",
    apiEndpoint: "https://api.relay.link/chains",
    notes: [
      "Filters to EVM chains only (excludes Solana, Bitcoin, etc.)",
      "Handles missing nativeCurrency with fallback values",
    ],
  },
  lifi: {
    name: "lifi",
    displayName: "LiFi",
    description: "Multi-chain liquidity aggregation protocol with the widest chain coverage",
    website: "https://li.fi",
    docs: "https://docs.li.fi/api-reference/fetch-all-known-tokens",
    apiEndpoint: "https://li.quest/v1/tokens",
    notes: [
      "Largest dataset (12,692 tokens) requiring batch inserts",
      "Sanitizes null bytes: str?.replace(/\\0/g, '') to prevent PostgreSQL errors",
      "Infers chains from token chainIds (no chains endpoint)",
    ],
  },
  across: {
    name: "across",
    displayName: "Across",
    description: "Optimistic bridge protocol focused on L2 rollups",
    website: "https://across.to",
    docs: "https://docs.across.to/reference/api-reference",
    apiEndpoint: "https://across.to/api",
    notes: [
      "Fetches chains and tokens from separate endpoints in parallel",
      "Uses logoUrl field instead of logoURI",
    ],
  },
  stargate: {
    name: "stargate",
    displayName: "Stargate",
    description: "Omnichain liquidity transport protocol powered by LayerZero",
    website: "https://stargate.finance",
    docs: "https://docs.stargate.finance/developers/api-docs/overview",
    apiEndpoint: "https://stargate.finance/api/v1",
    notes: [
      "Maps chainKey strings to numeric chainIds",
      "Filters to EVM chains only",
    ],
  },
  debridge: {
    name: "debridge",
    displayName: "deBridge",
    description: "Cross-chain interoperability protocol with the largest token catalog",
    website: "https://debridge.finance",
    docs: "https://docs.debridge.com/api-reference/utils/get-v10supported-chains-info",
    apiEndpoint: "https://dln.debridge.finance/v1.0",
    notes: [
      "Largest token catalog (16,712 tokens)",
      "Fetches tokens per-chain (not all at once)",
      "Excludes non-EVM chains: Solana, Tron, Sei, Injective",
      "Validates EVM addresses with /^0x[a-fA-F0-9]{40}$/ regex",
    ],
  },
  mayan: {
    name: "mayan",
    displayName: "Mayan",
    description: "Solana-focused bridge connecting SVM and EVM ecosystems",
    website: "https://mayan.finance",
    docs: "https://docs.mayan.finance/integration/quote-api#supported-tokens",
    apiEndpoint: "https://price-api.mayan.finance/v3/tokens",
    notes: [
      "Maps Wormhole chain IDs to EVM equivalents (e.g., 2 → 1 for Ethereum)",
      "Excludes non-EVM chains by name filter",
      "Uses 'contract' field for EVM addresses (not 'mint')",
    ],
  },
  rhino: {
    name: "rhino",
    displayName: "Rhino.fi",
    description: "Layer 2 focused bridge and trading platform",
    website: "https://rhino.fi",
    docs: "https://docs.rhino.fi/api-reference/configs/configs-chains-&-tokens",
    apiEndpoint: "https://api.rhino.fi/bridge/configs",
    notes: [
      "Nested structure with object keys as chain identifiers",
      "Uses object key as token symbol (not 'token' field)",
      "Decimals field is optional",
    ],
  },
  gaszip: {
    name: "gaszip",
    displayName: "GasZip",
    description: "Native gas token provider supporting 161+ chains",
    website: "https://gas.zip",
    docs: "https://dev.gas.zip/gas/api/chains",
    apiEndpoint: "https://backend.gas.zip/v2/chains",
    notes: [
      "Native gas tokens only (no ERC20s)",
      "Filters mainnet === true",
      "Uses 0x0000000000000000000000000000000000000000 for native token address",
    ],
  },
  aori: {
    name: "aori",
    displayName: "Aori",
    description: "High-performance orderbook DEX with LayerZero integration",
    website: "https://aori.io",
    docs: "https://docs.aori.io/reference/chains",
    apiEndpoint: "https://api.aori.io",
    notes: [
      "Minimal metadata: no token names (uses symbol), no decimals",
      "Uses chainKey as chain name",
      "Includes LayerZero endpoint ID (eid) field",
    ],
  },
  eco: {
    name: "eco",
    displayName: "Eco",
    description: "Stablecoin-focused protocol with curated token support",
    website: "https://eco.com",
    docs: "https://eco.com/docs/getting-started/routes/chain-support",
    apiEndpoint: undefined, // Static data only
    notes: [
      "Static data only (no API)",
      "6 stablecoins across 10 chains",
      "Curated token list: USDC, USDT, USDCe, USDbC, oUSDT, USDT0",
    ],
  },
  meson: {
    name: "meson",
    displayName: "Meson",
    description: "Stablecoin swap protocol optimized for low slippage",
    website: "https://meson.fi",
    docs: "https://meson.dev/api/endpoints/list-chains",
    apiEndpoint: "https://relayer.meson.fi/api/v1/list",
    notes: [
      "Parses chain IDs as hex (0x prefix) or decimal",
      "No token names (uses uppercase 'id'), no decimals field",
      "Optional token address (skips if missing)",
    ],
  },
  butter: {
    name: "butter",
    displayName: "Butter",
    description: "Token list service with curated multi-chain coverage",
    website: "https://butternetwork.io",
    docs: "https://docs.butternetwork.io/butter-swap-integration/integration-guide",
    apiEndpoint: "https://bs-tokens-api.chainservice.io/api",
    notes: [
      "Paginated API with pageSize=100",
      "Rate limited to 5 major networks (Ethereum, BSC, Polygon, Arbitrum, Optimism)",
      "Uses concurrency: 5 to respect rate limits",
    ],
  },
}

export function getProviderInfo(providerName: string): ProviderInfo | undefined {
  return PROVIDER_INFO[providerName.toLowerCase()]
}
