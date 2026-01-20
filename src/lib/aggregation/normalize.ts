/**
 * Normalize a token address based on chain type.
 * - EVM chains: lowercase (checksummed hex addresses are case-insensitive)
 * - Non-EVM chains (Solana, etc.): preserve case (base58 addresses are case-sensitive)
 *
 * @param address - The token address to normalize
 * @param isEvm - Whether this is an EVM chain (defaults to true for backwards compatibility)
 */
export function normalizeAddress(address: string, isEvm: boolean = true): string {
  // Non-EVM chains use case-sensitive addresses (Solana base58, etc.)
  if (!isEvm) {
    return address.trim()
  }

  // EVM chains use case-insensitive hex addresses - normalize to lowercase
  return address.toLowerCase().trim()
}

/**
 * Check if an address represents a native token
 * Native tokens use either 0x0000000000000000000000000000000000000000
 * or 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
 * (EVM chains only)
 */
export function isNativeToken(address: string): boolean {
  const normalized = normalizeAddress(address, true)
  return (
    normalized === "0x0000000000000000000000000000000000000000" ||
    normalized === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  )
}

/**
 * Normalize native token addresses to a canonical form (0x0000...)
 * This treats both 0x0000... and 0xeeee... as equivalent
 * (EVM chains only)
 */
export function normalizeNativeAddress(address: string): string {
  if (isNativeToken(address)) {
    return "0x0000000000000000000000000000000000000000"
  }
  return normalizeAddress(address, true)
}
