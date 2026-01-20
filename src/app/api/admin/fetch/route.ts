import { Effect } from "effect"
import { AdminApiService, AdminApiServicesLive } from "@/lib/api"
import { NextResponse } from "next/server"

/**
 * POST /api/admin/fetch
 * Triggers the provider fetch job
 * Requires ADMIN_SECRET header for authentication
 *
 * Effect-based implementation:
 * 1. Validate authentication
 * 2. Use AdminApiService to trigger fetch
 * 3. Run Effect program and return results
 */
export async function POST(request: Request) {
  // Check authentication
  const adminSecret = request.headers.get("x-admin-secret")
  const expectedSecret = process.env.ADMIN_SECRET

  if (!expectedSecret) {
    return NextResponse.json({ error: "Admin secret not configured" }, { status: 500 })
  }

  if (adminSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Build Effect program
  const program = Effect.gen(function* () {
    const adminApi = yield* AdminApiService
    return yield* adminApi.triggerFetch
  }).pipe(
    Effect.catchAll((error) => {
      console.error("[API /admin/fetch]", error)
      return Effect.succeed({
        _tag: "error" as const,
        message: error._tag === "AdminApiError" ? error.message : "Failed to trigger fetch",
      })
    }),
    Effect.provide(AdminApiServicesLive),
    Effect.scoped
  )

  const result = await Effect.runPromise(program)

  if ("_tag" in result && result._tag === "error") {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  return NextResponse.json(result)
}
