import { Effect } from "effect"
import { TokenApiService, ApiServicesLive } from "@/lib/api"
import { NextResponse } from "next/server"

/**
 * GET /api/tokens/[symbol]
 * Returns detailed information for a specific token symbol
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params

  type ErrorResponse =
    | { _tag: "notFound"; symbol: string }
    | { _tag: "error"; message: string }

  const program = Effect.gen(function* () {
    const tokenApi = yield* TokenApiService
    return yield* tokenApi.getTokenBySymbol(symbol)
  }).pipe(
    Effect.catchAll((error: any): Effect.Effect<ErrorResponse, never> => {
      console.error("[API /tokens/:symbol]", error)

      // Handle not found error with 404
      if (error._tag === "TokenNotFoundError") {
        return Effect.succeed({
          _tag: "notFound" as const,
          symbol: error.symbol,
        })
      }

      return Effect.succeed({
        _tag: "error" as const,
        message: error._tag === "TokenApiError" && error.message ? error.message : "Failed to fetch token details",
      })
    }),
    Effect.provide(ApiServicesLive),
    Effect.scoped
  )

  const result = await Effect.runPromise(program)

  // Handle different error types
  if ("_tag" in result && typeof result._tag === "string") {
    if (result._tag === "notFound") {
      return NextResponse.json({ error: "Token not found" }, { status: 404 })
    }
    if (result._tag === "error") {
      return NextResponse.json({ error: (result as any).message }, { status: 500 })
    }
  }

  return NextResponse.json(result)
}
