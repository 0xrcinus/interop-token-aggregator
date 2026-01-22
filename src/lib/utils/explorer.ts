/**
 * Block Explorer URL utilities
 *
 * Generates block explorer links for tokens and addresses on different chains
 */

// Well-known explorers for major chains (fallback if chain metadata doesn't have explorers)
const WELL_KNOWN_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  10: "https://optimistic.etherscan.io",
  56: "https://bscscan.com",
  137: "https://polygonscan.com",
  250: "https://ftmscan.com",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
  42220: "https://celoscan.io",
  43114: "https://snowtrace.io",
  34268394551451: "https://solscan.io", // Solana (Across's ID)
}

/**
 * Get the block explorer URL for a token address on a specific chain
 */
export function getTokenExplorerUrl(
  chainId: number,
  address: string,
  explorers?: Array<{ name: string; url: string; standard?: string }>
): string | null {
  // Use chain's first explorer if available
  if (explorers && explorers.length > 0) {
    const explorerBase = explorers[0].url.replace(/\/$/, "")

    // Special case for Solana (uses different URL format)
    if (chainId === 34268394551451) {
      return `${explorerBase}/token/${address}`
    }

    // Standard EVM explorer format
    return `${explorerBase}/token/${address}`
  }

  // Fallback to well-known explorers
  const wellKnownBase = WELL_KNOWN_EXPLORERS[chainId]
  if (wellKnownBase) {
    // Special case for Solana
    if (chainId === 34268394551451) {
      return `${wellKnownBase}/token/${address}`
    }

    // Standard EVM explorer format
    return `${wellKnownBase}/token/${address}`
  }

  return null
}

/**
 * Get the block explorer URL for an address (generic)
 */
export function getAddressExplorerUrl(
  chainId: number,
  address: string,
  explorers?: Array<{ name: string; url: string; standard?: string }>
): string | null {
  // Use chain's first explorer if available
  if (explorers && explorers.length > 0) {
    const explorerBase = explorers[0].url.replace(/\/$/, "")

    // Special case for Solana
    if (chainId === 34268394551451) {
      return `${explorerBase}/account/${address}`
    }

    // Standard EVM explorer format
    return `${explorerBase}/address/${address}`
  }

  // Fallback to well-known explorers
  const wellKnownBase = WELL_KNOWN_EXPLORERS[chainId]
  if (wellKnownBase) {
    // Special case for Solana
    if (chainId === 34268394551451) {
      return `${wellKnownBase}/account/${address}`
    }

    // Standard EVM explorer format
    return `${wellKnownBase}/address/${address}`
  }

  return null
}
