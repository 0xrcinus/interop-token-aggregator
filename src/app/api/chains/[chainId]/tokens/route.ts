import { NextResponse } from "next/server"
import { createDrizzleClient } from "@/lib/db/layer"
import { tokens } from "@/lib/db/schema"
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

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
  const offset = parseInt(searchParams.get("offset") || "0")
  const symbol = searchParams.get("symbol") || undefined

  const db = createDrizzleClient()

  try {
    // Build query for aggregated tokens with canonical address
    let dbQuery = db
      .select({
        symbol: tokens.symbol,
        // Use MODE() to get the most common name, not just MIN
        name: sql<string>`MODE() WITHIN GROUP (ORDER BY ${tokens.name})`.as('name'),
        providerCount: sql<number>`COUNT(DISTINCT ${tokens.providerName})`.as('provider_count'),
        tags: sql<string[]>`
          COALESCE(
            (
              SELECT array_agg(DISTINCT tag ORDER BY tag)
              FROM tokens t2,
              jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(t2.tags) = 'array' THEN t2.tags ELSE '[]'::jsonb END
              ) AS tag
              WHERE t2.symbol = tokens.symbol
              AND t2.chain_id = ${chainIdNum}
            ),
            ARRAY[]::text[]
          )
        `.as('tags'),
        // Calculate canonical address (mode/most common)
        // Note: Not using LOWER() to preserve case for non-EVM chains (Solana)
        canonicalAddress: sql<string>`
          MODE() WITHIN GROUP (ORDER BY ${tokens.address})
        `.as('canonical_address'),
        // Get all token instances for this symbol on this chain (for expansion)
        instances: sql<any>`
          json_agg(
            json_build_object(
              'address', ${tokens.address},
              'name', ${tokens.name},
              'decimals', ${tokens.decimals},
              'providerName', ${tokens.providerName}
            )
            ORDER BY ${tokens.providerName}
          )
        `.as('instances'),
      })
      .from(tokens)
      .where(eq(tokens.chainId, chainIdNum))
      .$dynamic()

    // Apply symbol filter if provided
    if (symbol) {
      dbQuery = dbQuery.where(sql`${tokens.symbol} ILIKE ${`%${symbol}%`}`)
    }

    // Execute query with pagination
    const tokenList = await dbQuery
      .groupBy(tokens.symbol)
      .orderBy(sql`COUNT(DISTINCT ${tokens.providerName}) DESC`, tokens.symbol)
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    let countQuery = db
      .select({
        count: sql<number>`COUNT(DISTINCT ${tokens.symbol})`,
      })
      .from(tokens)
      .where(eq(tokens.chainId, chainIdNum))
      .$dynamic()

    if (symbol) {
      countQuery = countQuery.where(sql`${tokens.symbol} ILIKE ${`%${symbol}%`}`)
    }

    const totalCountResult = await countQuery
    const total = totalCountResult[0]?.count || 0

    // Parse tags and ensure proper types for each token
    const parsedTokens = tokenList.map((token) => ({
      ...token,
      tags: Array.isArray(token.tags) ? token.tags : [],
      providerCount: Number(token.providerCount), // Ensure it's a number
      instances: Array.isArray(token.instances) ? token.instances : [],
    }))

    return NextResponse.json({
      tokens: parsedTokens,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error(`[API /chains/${chainId}/tokens]`, error)
    return NextResponse.json(
      { error: "Failed to fetch chain tokens" },
      { status: 500 }
    )
  }
}
