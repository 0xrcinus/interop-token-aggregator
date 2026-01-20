import { NextResponse } from "next/server"
import { createDrizzleClient } from "@/lib/db/layer"
import { chains, tokens, chainProviderSupport } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chainId: string }> }
) {
  const { chainId } = await params
  const chainIdNum = Number(chainId)

  if (isNaN(chainIdNum)) {
    return NextResponse.json(
      { error: "Invalid chain ID" },
      { status: 400 }
    )
  }

  const db = createDrizzleClient()

  try {
    // Get chain info
    const [chainInfo] = await db
      .select({
        chainId: chains.chainId,
        name: chains.name,
        shortName: chains.shortName,
        chainType: chains.chainType,
        icon: chains.icon,
        infoUrl: chains.infoUrl,
        explorers: chains.explorers,
        nativeCurrencyName: chains.nativeCurrencyName,
        nativeCurrencySymbol: chains.nativeCurrencySymbol,
        nativeCurrencyDecimals: chains.nativeCurrencyDecimals,
      })
      .from(chains)
      .where(eq(chains.chainId, chainIdNum))

    if (!chainInfo) {
      return NextResponse.json(
        { error: "Chain not found" },
        { status: 404 }
      )
    }

    // Get providers for this chain
    const providersList = await db
      .select({ providerName: chainProviderSupport.providerName })
      .from(chainProviderSupport)
      .where(eq(chainProviderSupport.chainId, chainIdNum))

    const providers = Array.from(new Set(providersList.map((p) => p.providerName)))

    // Get tokens on this chain
    const chainTokens = await db
      .select({
        symbol: tokens.symbol,
        name: tokens.name,
        address: tokens.address,
        decimals: tokens.decimals,
        logoUri: tokens.logoUri,
        providerName: tokens.providerName,
        tags: tokens.tags,
      })
      .from(tokens)
      .where(eq(tokens.chainId, chainIdNum))
      .orderBy(tokens.symbol)

    // Parse tags
    const parsedTokens = chainTokens.map((token) => {
      let parsedTags: string[] = []
      try {
        if (token.tags) {
          if (typeof token.tags === 'string') {
            parsedTags = JSON.parse(token.tags)
          } else if (Array.isArray(token.tags)) {
            parsedTags = token.tags
          }
        }
      } catch (e) {
        parsedTags = []
      }

      return {
        ...token,
        tags: parsedTags,
      }
    })

    return NextResponse.json({
      chainId: chainInfo.chainId,
      name: chainInfo.name,
      shortName: chainInfo.shortName ?? undefined,
      chainType: chainInfo.chainType ?? undefined,
      icon: chainInfo.icon ?? undefined,
      infoUrl: chainInfo.infoUrl ?? undefined,
      explorers: chainInfo.explorers as any ?? undefined,
      nativeCurrency: {
        name: chainInfo.nativeCurrencyName,
        symbol: chainInfo.nativeCurrencySymbol,
        decimals: chainInfo.nativeCurrencyDecimals,
      },
      providers,
      totalTokens: parsedTokens.length,
      tokens: parsedTokens,
    })
  } catch (error) {
    console.error(`[API /chains/${chainId}]`, error)
    return NextResponse.json(
      { error: "Failed to fetch chain data" },
      { status: 500 }
    )
  }
}
