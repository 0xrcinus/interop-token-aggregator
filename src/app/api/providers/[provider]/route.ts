import { NextResponse } from "next/server"
import { createDrizzleClient } from "@/lib/db/layer"
import { tokens, chains } from "@/lib/db/schema"
import { eq, sql, desc } from "drizzle-orm"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
  const offset = parseInt(searchParams.get("offset") || "0")
  const symbol = searchParams.get("symbol") || undefined

  const db = createDrizzleClient()

  try {
    // Build query for aggregated tokens grouped by symbol
    let dbQuery = db
      .select({
        symbol: tokens.symbol,
        // Use MODE() to get the most common name
        name: sql<string>`MODE() WITHIN GROUP (ORDER BY ${tokens.name})`.as('name'),
        chainCount: sql<number>`COUNT(DISTINCT ${tokens.chainId})`.as('chain_count'),
        tags: sql<string[]>`
          COALESCE(
            (
              SELECT array_agg(DISTINCT tag ORDER BY tag)
              FROM tokens t2,
              jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(t2.tags) = 'array' THEN t2.tags ELSE '[]'::jsonb END
              ) AS tag
              WHERE t2.symbol = tokens.symbol
              AND t2.provider_name = ${provider}
            ),
            ARRAY[]::text[]
          )
        `.as('tags'),
        // Get all chains where this token exists
        chains: sql<any>`
          json_agg(
            json_build_object(
              'chainId', ${tokens.chainId},
              'chainName', ${chains.name},
              'address', ${tokens.address},
              'decimals', ${tokens.decimals},
              'name', ${tokens.name}
            )
            ORDER BY ${chains.name}
          )
        `.as('chains'),
      })
      .from(tokens)
      .leftJoin(chains, eq(tokens.chainId, chains.chainId))
      .where(eq(tokens.providerName, provider))
      .$dynamic()

    // Apply symbol filter if provided
    if (symbol) {
      dbQuery = dbQuery.where(sql`${tokens.symbol} ILIKE ${`%${symbol}%`}`)
    }

    // Execute query with pagination
    const tokenList = await dbQuery
      .groupBy(tokens.symbol)
      .orderBy(sql`COUNT(DISTINCT ${tokens.chainId}) DESC`, tokens.symbol)
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    let countQuery = db
      .select({
        count: sql<number>`COUNT(DISTINCT ${tokens.symbol})`,
      })
      .from(tokens)
      .where(eq(tokens.providerName, provider))
      .$dynamic()

    if (symbol) {
      countQuery = countQuery.where(sql`${tokens.symbol} ILIKE ${`%${symbol}%`}`)
    }

    const totalCountResult = await countQuery
    const total = totalCountResult[0]?.count || 0

    // Get total token instances for stats
    const totalInstancesResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(tokens)
      .where(eq(tokens.providerName, provider))

    const totalInstances = totalInstancesResult[0]?.count || 0

    // Parse tags and ensure proper types for each token
    const parsedTokens = tokenList.map((token) => ({
      ...token,
      tags: Array.isArray(token.tags) ? token.tags : [],
      chainCount: Number(token.chainCount), // Ensure it's a number
      chains: Array.isArray(token.chains) ? token.chains : [],
    }))

    return NextResponse.json({
      provider,
      totalTokens: totalInstances,
      uniqueSymbols: total,
      tokens: parsedTokens,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error(`[API /providers/${provider}]`, error)
    return NextResponse.json(
      { error: "Failed to fetch provider data" },
      { status: 500 }
    )
  }
}
