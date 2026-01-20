import { Effect, Layer } from "effect"
import { config } from "dotenv"
import { AdminApiService, AdminApiServiceLive } from "../lib/api/admin"
import { AllProvidersLive } from "../lib/providers"
import { ChainRegistryLive } from "../lib/chains/registry"

// Load environment variables
config({ path: ".env.local" })

/**
 * Main program to fetch data from all providers
 * Uses AdminApiService to keep logic consistent with API endpoint
 */
const program = Effect.gen(function* () {
  console.log("=".repeat(60))
  console.log("Starting provider fetch job...")
  console.log("=".repeat(60))
  console.log("")

  const adminApi = yield* AdminApiService
  const result = yield* adminApi.triggerFetch

  console.log("")
  console.log("=".repeat(60))
  console.log("Fetch job completed")
  console.log(`Duration: ${result.durationMs}ms`)
  console.log("=".repeat(60))
  console.log("")

  console.log(`Successes: ${result.summary.successful}`)
  console.log(`Failures: ${result.summary.failed}`)

  if (result.summary.failed > 0) {
    console.log("")
    console.log("Failed providers:")
    result.results.forEach((r) => {
      if (!r.success) {
        console.log(`  - ${r.provider}: ${r.error}`)
      }
    })
  }

  if (result.summary.successful > 0) {
    console.log("")
    console.log("Summary:")
    result.results.forEach((r) => {
      if (r.success) {
        console.log(
          `  ${r.provider}: ${r.chainsCount} chains, ${r.tokensCount} tokens`
        )
      }
    })
  }

  if (result.chainEnrichment) {
    console.log("")
    console.log(
      `Enriched ${result.chainEnrichment.enrichedCount} out of ${result.chainEnrichment.totalChains} chains`
    )
  }

  return { successes: result.summary.successful, failures: result.summary.failed }
})

/**
 * Run the program with all required layers
 * AdminApiServiceLive needs AllProvidersLive and ChainRegistryLive
 */
const AppLive = Layer.mergeAll(
  AdminApiServiceLive,
  ChainRegistryLive
).pipe(Layer.provideMerge(AllProvidersLive))

Effect.runPromise(program.pipe(Effect.provide(AppLive), Effect.scoped))
  .then(({ successes, failures }) => {
    console.log("")
    console.log("Job finished successfully")
    process.exit(failures > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error("")
    console.error("Job failed with error:")
    console.error(error)
    process.exit(1)
  })
