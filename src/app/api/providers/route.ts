import { Effect } from "effect"
import { ProviderApiService, ApiServicesLive } from "@/lib/api"
import { NextResponse } from "next/server"

/**
 * GET /api/providers
 * Returns provider health status and fetch history
 *
 * Effect-based implementation:
 * 1. Build Effect program using service
 * 2. Handle errors in Effect domain
 * 3. Run with Effect.runPromise and convert to Next.js Response
 */
export async function GET() {
  const program = Effect.gen(function* () {
    const providerApi = yield* ProviderApiService
    return yield* providerApi.getProviders
  }).pipe(
    Effect.catchAll((error) => {
      console.error("[API /providers]", error)
      // Return a discriminated union for error handling
      return Effect.succeed({
        _tag: "error" as const,
        message: error._tag === "ProviderApiError" ? error.message : "Failed to fetch providers",
      })
    }),
    Effect.provide(ApiServicesLive),
    Effect.scoped
  )

  const result = await Effect.runPromise(program)

  // Check if result is an error
  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  return NextResponse.json(result)
}
