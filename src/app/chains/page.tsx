import Link from "next/link"
import { Effect } from "effect"
import { ChainApiService, ApiServicesLive } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChainsClient } from "./_components/ChainsClient"

// Revalidate every 5 minutes as a fallback (in case manual revalidation fails)
export const revalidate = 300


async function getChains() {
  const program = Effect.gen(function* () {
    const chainApi = yield* ChainApiService
    return yield* chainApi.getChains
  }).pipe(Effect.provide(ApiServicesLive), Effect.scoped)

  return await Effect.runPromise(program)
}

export default async function ChainsPage() {
  const data = await getChains()

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold">Chain Coverage</h1>
          <p className="text-lg text-muted-foreground">
            View which chains are supported by which providers
          </p>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardDescription>Total Chains</CardDescription>
              <CardTitle className="text-3xl">{data.summary.totalChains}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Multi-Provider Chains</CardDescription>
              <CardTitle className="text-3xl text-blue-600 dark:text-blue-400">
                {data.summary.multiProviderChains}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Supported by 2+ providers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Total Tokens</CardDescription>
              <CardTitle className="text-3xl text-purple-600 dark:text-purple-400">
                {data.summary.totalTokens.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Across all chains
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chains Table */}
        <ChainsClient chains={data.chains} />
      </main>
    </div>
  )
}
