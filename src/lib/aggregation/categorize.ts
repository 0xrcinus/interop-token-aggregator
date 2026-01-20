/**
 * Token categorization utilities
 * Detects token types based on symbol, name, and address patterns
 */

export type TokenTag =
  | "liquidity-pool"
  | "governance"
  | "wrapped"
  | "native"
  | "stablecoin"
  | "bridged"
  | "derivative"
  | "rebasing"
  | "yield-bearing"

/**
 * Categorize a token based on its symbol and name
 * Returns an array of tags that apply to the token
 */
export const categorizeToken = (
  symbol: string,
  name: string,
  address: string
): TokenTag[] => {
  const tags: TokenTag[] = []

  const normalizedSymbol = symbol.toLowerCase()
  const normalizedName = name.toLowerCase()

  // Liquidity Pool Tokens
  if (isLiquidityPoolToken(normalizedSymbol, normalizedName)) {
    tags.push("liquidity-pool")
  }

  // Governance Tokens
  if (isGovernanceToken(normalizedSymbol, normalizedName)) {
    tags.push("governance")
  }

  // Wrapped Tokens
  if (isWrappedToken(normalizedSymbol, normalizedName)) {
    tags.push("wrapped")
  }

  // Native Tokens (special addresses)
  if (isNativeToken(address)) {
    tags.push("native")
  }

  // Stablecoins
  if (isStablecoin(normalizedSymbol, normalizedName)) {
    tags.push("stablecoin")
  }

  // Bridged Tokens
  if (isBridgedToken(normalizedSymbol, normalizedName)) {
    tags.push("bridged")
  }

  // Rebasing Tokens
  if (isRebasingToken(normalizedSymbol, normalizedName)) {
    tags.push("rebasing")
  }

  // Yield-Bearing Tokens
  if (isYieldBearingToken(normalizedSymbol, normalizedName)) {
    tags.push("yield-bearing")
  }

  return tags
}

/**
 * Detect liquidity pool tokens
 */
const isLiquidityPoolToken = (symbol: string, name: string): boolean => {
  const lpPatterns = [
    /uni-?v2/i,
    /slp$/i,
    /^lp-/i,
    /-lp$/i,
    /pendle-?lpt/i,
    /spt-?pt\/ibt/i,
    /laminar-?v2/i,
    /cake-?lp/i,
    /balancer/i,
    /bpt$/i,
    /^v2-/i, // Uniswap V2 style
    /liquidity/i,
  ]

  return lpPatterns.some(
    (pattern) => pattern.test(symbol) || pattern.test(name)
  )
}

/**
 * Detect governance tokens
 */
const isGovernanceToken = (symbol: string, name: string): boolean => {
  const govPatterns = [
    /^voted?-/i,
    /^ve[A-Z]/,
    /^escrowed-/i,
    /^xve/i,
    /voting/i,
    /^vlcvx/i,
    /^sd[A-Z]/, // Stake DAO
  ]

  return govPatterns.some(
    (pattern) => pattern.test(symbol) || pattern.test(name)
  )
}

/**
 * Detect wrapped tokens
 */
const isWrappedToken = (symbol: string, name: string): boolean => {
  const wrappedPatterns = [
    /^w[a-z]{3,4}$/i, // wETH, wBTC, wMATIC, etc.
    /^wrapped\s/i,
    /\swrapped$/i,
  ]

  return wrappedPatterns.some(
    (pattern) => pattern.test(symbol) || pattern.test(name)
  )
}

/**
 * Detect native token addresses
 */
const isNativeToken = (address: string): boolean => {
  const nativeAddresses = [
    "0x0000000000000000000000000000000000000000",
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  ]

  return nativeAddresses.includes(address.toLowerCase())
}

/**
 * Detect stablecoins
 */
const isStablecoin = (symbol: string, name: string): boolean => {
  const stablePatterns = [
    /^usdc/i,
    /^usdt/i,
    /^dai$/i,
    /^busd/i,
    /^tusd/i,
    /^usdp/i,
    /^frax$/i,
    /^lusd/i,
    /^gusd/i,
    /^susd/i,
    /^mim$/i,
    /^ust$/i,
    /^euroc/i,
    /^eurt/i,
    /^ageur/i,
  ]

  return stablePatterns.some(
    (pattern) => pattern.test(symbol) || pattern.test(name)
  )
}

/**
 * Detect bridged tokens
 */
const isBridgedToken = (symbol: string, name: string): boolean => {
  const bridgePatterns = [
    /\.e$/i, // USDC.e, WETH.e (bridged)
    /^ce[A-Z]/, // Celer bridged
    /^any[A-Z]/, // Multichain
    /^axl[A-Z]/, // Axelar
    /^so[A-Z]/, // Synapse
    /\.so$/i, // Synapse bridged
    /bridged/i,
  ]

  return bridgePatterns.some(
    (pattern) => pattern.test(symbol) || pattern.test(name)
  )
}

/**
 * Detect derivative tokens
 */
const isDerivativeToken = (symbol: string, name: string): boolean => {
  const derivativePatterns = [
    /^s[a-z]{3,4}$/i, // sETH, sBTC, etc.
    /^a[a-z]{3,4}$/i, // aETH, aDAI (Aave)
    /^c[a-z]{3,4}$/i, // cETH, cDAI (Compound)
    /^y[a-z]{3,4}$/i, // yETH, yDAI (Yearn)
    /synthetic/i,
  ]

  return derivativePatterns.some(
    (pattern) => pattern.test(symbol) || pattern.test(name)
  )
}

/**
 * Detect rebasing tokens
 */
const isRebasingToken = (symbol: string, name: string): boolean => {
  const rebasingPatterns = [
    /^r[a-z]{3,5}$/i, // rETH, rHYPE
    /^st[a-z]{3,4}$/i, // stETH, stMATIC
    /rebase/i,
    /ampleforth/i,
    /^ampl$/i,
  ]

  return rebasingPatterns.some(
    (pattern) => pattern.test(symbol) || pattern.test(name)
  )
}

/**
 * Detect yield-bearing tokens
 */
const isYieldBearingToken = (symbol: string, name: string): boolean => {
  const yieldPatterns = [
    /^ib[a-z]/i, // interest-bearing
    /^ay[a-z]/i, // Aave yield
    /^cy[a-z]/i, // Compound yield
    /yield/i,
    /earning/i,
    /interest/i,
  ]

  return yieldPatterns.some(
    (pattern) => pattern.test(symbol) || pattern.test(name)
  )
}
