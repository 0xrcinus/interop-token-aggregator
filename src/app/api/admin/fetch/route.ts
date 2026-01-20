import { Effect } from "effect"
import { AdminApiService, AdminApiServicesLive } from "@/lib/api"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

/**
 * POST/GET /api/admin/fetch
 * Triggers the provider fetch job
 *
 * Authentication:
 * - POST: Requires x-admin-secret header matching ADMIN_SECRET env var
 * - GET: Supports both x-admin-secret header AND Vercel Cron (Authorization: Bearer CRON_SECRET)
 *
 * Effect-based implementation:
 * 1. Validate authentication
 * 2. Use AdminApiService to trigger fetch
 * 3. Run Effect program and return results
 * 4. Revalidate static pages to reflect new data
 */

async function handleFetch(request: Request) {
  // Check authentication - support both manual trigger and Vercel Cron
  const adminSecret = request.headers.get("x-admin-secret")
  const authHeader = request.headers.get("authorization")
  const expectedSecret = process.env.ADMIN_SECRET
  const cronSecret = process.env.CRON_SECRET

  // Manual trigger authentication
  const isValidAdminAuth = expectedSecret && adminSecret === expectedSecret

  // Vercel Cron authentication (GET requests only)
  const isValidCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isValidAdminAuth && !isValidCronAuth) {
    if (!expectedSecret && !cronSecret) {
      return NextResponse.json({ error: "Admin secret not configured" }, { status: 500 })
    }
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

  // Revalidate all static pages that depend on token/chain/provider data
  // This ensures the UI reflects the newly fetched data
  console.log("[API /admin/fetch] Revalidating static pages...")
  revalidatePath("/", "layout") // Revalidate home page and all nested routes
  revalidatePath("/chains")
  revalidatePath("/providers")
  revalidatePath("/tokens")
  console.log("[API /admin/fetch] Revalidation complete")

  return NextResponse.json({
    ...result,
    triggeredBy: isValidCronAuth ? "vercel-cron" : "manual",
  })
}

// Export both GET and POST handlers
export async function POST(request: Request) {
  return handleFetch(request)
}

export async function GET(request: Request) {
  return handleFetch(request)
}
