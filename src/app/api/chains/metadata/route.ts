import { Effect } from "effect"
import { ChainApiService, ApiServicesLive } from "@/lib/api"
import { NextResponse } from "next/server"

/**
 * GET /api/chains/metadata
 * Returns lightweight chain metadata (explorers only, no aggregations)
 * Used for building explorer URLs without expensive queries
 */
export async function GET() {
  const program = Effect.gen(function* () {
    const chainApi = yield* ChainApiService
    return yield* chainApi.getChainMetadata
  }).pipe(
    Effect.catchAll((error) => {
      console.error("[API /chains/metadata]", error)
      return Effect.succeed({
        _tag: "error" as const,
        message: error._tag === "ChainApiError" ? error.message : "Failed to fetch chain metadata",
      })
    }),
    Effect.provide(ApiServicesLive),
    Effect.scoped
  )

  const result = await Effect.runPromise(program)

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  return NextResponse.json({ chains: result })
}
