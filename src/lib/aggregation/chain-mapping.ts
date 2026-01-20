/**
 * Chain ID Normalization Mapping
 *
 * Different providers use different chain IDs for non-EVM chains.
 * This mapping standardizes them to canonical chain IDs.
 *
 * For EVM chains, chain IDs are standardized across providers.
 * For non-EVM chains (Solana, Starknet, Bitcoin, etc.), providers use custom IDs.
 */

export const CHAIN_ID_NORMALIZATION: Record<number, number> = {
  // Solana mainnet (canonical: 34268394551451 - Across's ID, has most tokens)
  501474: 34268394551451,               // GasZip -> Across
  792703809: 34268394551451,            // Relay -> Across
  1360108768460801: 34268394551451,     // Butter -> Across
  // Across uses its own ID as canonical: 34268394551451

  // Add more non-EVM chain mappings as needed
  // Example:
  // 23448394291968336: 1234, // Starknet (various provider IDs -> canonical)
}

/**
 * Normalizes a chain ID to its canonical form.
 * Returns the canonical ID if a mapping exists, otherwise returns the original ID.
 */
export function normalizeChainId(chainId: number): number {
  return CHAIN_ID_NORMALIZATION[chainId] ?? chainId
}

/**
 * Checks if a chain ID is a known non-EVM chain that requires normalization.
 */
export function requiresNormalization(chainId: number): boolean {
  return chainId in CHAIN_ID_NORMALIZATION
}

/**
 * Get all provider-specific chain IDs that map to a canonical chain ID.
 */
export function getProviderChainIds(canonicalChainId: number): number[] {
  return Object.entries(CHAIN_ID_NORMALIZATION)
    .filter(([_, canonical]) => canonical === canonicalChainId)
    .map(([providerId]) => parseInt(providerId, 10))
}

/**
 * Check if a chain ID is an EVM chain.
 * Defaults to true (assume EVM) if vm_type is not set in database.
 *
 * NOTE: This function uses a synchronous cache. For provider code that runs
 * during data fetching, we don't have access to the database yet, so we fall
 * back to canonical metadata for known non-EVM chains.
 *
 * For API/query code with database access, use the database directly.
 */
export function isEvmChain(chainId: number): boolean {
  const canonicalId = normalizeChainId(chainId)

  // Check canonical metadata for known non-EVM chains
  const { hasCanonicalMetadata, getCanonicalMetadata } = require("../chains/canonical-metadata")
  if (hasCanonicalMetadata(canonicalId)) {
    const canonical = getCanonicalMetadata(canonicalId)
    return canonical.vmType === "evm"
  }

  // Default to EVM for all other chains
  return true
}
