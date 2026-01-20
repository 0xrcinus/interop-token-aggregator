/**
 * Canonical metadata for non-EVM chains that may not be in Chainlist API
 * or have incorrect/missing metadata from external sources.
 *
 * This provides authoritative data for major non-EVM chains.
 */

interface CanonicalChainMetadata {
  chainId: number
  name: string
  shortName: string
  chainType: string
  vmType: string // VM type: "evm", "svm" (Solana), etc.
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  icon?: string
  infoUrl?: string
  explorers?: Array<{
    name: string
    url: string
    standard: string
  }>
  rpc?: string[]
}

export const CANONICAL_CHAIN_METADATA: Record<number, CanonicalChainMetadata> = {
  // Solana mainnet (using Across's chain ID as canonical)
  34268394551451: {
    chainId: 34268394551451,
    name: "Solana",
    shortName: "sol",
    chainType: "mainnet",
    vmType: "svm", // Solana Virtual Machine
    nativeCurrency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
    },
    icon: "https://icons.llamao.fi/icons/chains/rsz_solana.jpg",
    infoUrl: "https://solana.com",
    explorers: [
      {
        name: "Solscan",
        url: "https://solscan.io",
        standard: "none",
      },
      {
        name: "Solana Explorer",
        url: "https://explorer.solana.com",
        standard: "none",
      },
    ],
    rpc: ["https://api.mainnet-beta.solana.com"],
  },

  // Add more non-EVM chains as needed
  // Example: Starknet, Bitcoin, Cosmos, etc.
}

/**
 * Get canonical metadata for a chain ID if it exists
 */
export function getCanonicalMetadata(chainId: number): CanonicalChainMetadata | undefined {
  return CANONICAL_CHAIN_METADATA[chainId]
}

/**
 * Check if a chain has canonical metadata defined
 */
export function hasCanonicalMetadata(chainId: number): boolean {
  return chainId in CANONICAL_CHAIN_METADATA
}
