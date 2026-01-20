import { Effect } from "effect"
import { ChainApiService, ApiServicesLive } from "@/lib/api"
import { NextResponse } from "next/server"

/**
 * GET /api/chains
 * Returns list of all chains with provider support and token counts
 */
export async function GET() {
  const program = Effect.gen(function* () {
    const chainApi = yield* ChainApiService
    return yield* chainApi.getChains
  }).pipe(
    Effect.catchAll((error) => {
      console.error("[API /chains]", error)
      return Effect.succeed({
        _tag: "error" as const,
        message: error._tag === "ChainApiError" ? error.message : "Failed to fetch chains",
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
