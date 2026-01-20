import { Effect } from "effect"
import { TokenApiService, ApiServicesLive, TokenListQuery } from "@/lib/api"
import { NextResponse } from "next/server"

/**
 * GET /api/tokens
 * Returns aggregated list of tokens grouped by symbol
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000)
  const offset = parseInt(searchParams.get("offset") || "0")
  const symbol = searchParams.get("symbol") || undefined
  const tag = searchParams.get("tag") || undefined
  const chainIdParam = searchParams.get("chainId")
  const chainId = chainIdParam ? parseInt(chainIdParam) : undefined

  const query = new TokenListQuery({ limit, offset, symbol, tag, chainId })

  const program = Effect.gen(function* () {
    const tokenApi = yield* TokenApiService
    return yield* tokenApi.getTokens(query)
  }).pipe(
    Effect.catchAll((error) => {
      console.error("[API /tokens]", error)
      return Effect.succeed({
        _tag: "error" as const,
        message: error._tag === "TokenApiError" ? error.message : "Failed to fetch tokens",
      })
    }),
    Effect.provide(ApiServicesLive),
    Effect.scoped
  )

  const result = await Effect.runPromise(program)

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  return NextResponse.json(result)
}
