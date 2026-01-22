/**
 * Manual Chain Metadata Overrides
 *
 * This file contains manual corrections for chain metadata that is incorrect
 * or outdated in both chainlist.org and chainid.network.
 *
 * These overrides are applied AFTER merging data from both sources, ensuring
 * we have the most accurate information possible.
 */

import type { ChainMetadata } from "./registry"

/**
 * Partial metadata overrides for specific chains
 * Only the fields specified will be overridden
 */
export const MANUAL_CHAIN_OVERRIDES: Record<number, Partial<ChainMetadata>> = {
  // HyperEVM (999) - Fix broken explorer
  999: {
    explorers: [
      {
        name: "Hypurrscan",
        url: "https://hypurrscan.io",
        standard: "EIP3091",
      },
    ],
  },

  // Add more overrides here as needed
  // Example:
  // 1: {
  //   name: "Ethereum Mainnet (corrected)",
  //   rpc: ["https://custom-rpc.example.com"],
  // },
}

/**
 * Applies manual overrides to chain metadata
 */
export const applyManualOverrides = (chain: ChainMetadata): ChainMetadata => {
  const override = MANUAL_CHAIN_OVERRIDES[chain.chainId]

  if (!override) {
    return chain
  }

  // Merge override with existing chain data
  return {
    ...chain,
    ...override,
  }
}
