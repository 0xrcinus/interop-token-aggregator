import Link from "next/link"
import { notFound } from "next/navigation"
import { Effect } from "effect"
import { ProviderApiService, ApiServicesLive, type ProviderMetadata } from "@/lib/api"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderTokenList } from "./token-list"
import { REVALIDATE_INTERVAL } from "@/lib/config"

// Revalidate interval as fallback (in case manual revalidation fails)
// Configure via NEXT_PUBLIC_REVALIDATE_INTERVAL env variable
export const revalidate = REVALIDATE_INTERVAL

async function getProviderMetadata(providerName: string): Promise<ProviderMetadata> {
  const program = Effect.gen(function* () {
    const providerApi = yield* ProviderApiService
    return yield* providerApi.getProviderMetadata(providerName)
  }).pipe(Effect.provide(ApiServicesLive), Effect.scoped)

  try {
    return await Effect.runPromise(program)
  } catch (error) {
    console.error(`Failed to fetch provider ${providerName}:`, error)
    notFound()
  }
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ provider: string }>
}) {
  const { provider } = await params
  const data = await getProviderMetadata(provider)

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link href="/providers" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Providers
          </Link>
          <h1 className="text-4xl font-bold capitalize">{provider}</h1>
          <p className="text-lg text-muted-foreground">
            Viewing {data.totalTokens.toLocaleString()} token instances across {data.uniqueSymbols.toLocaleString()} unique symbols
          </p>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Token Instances</CardDescription>
              <CardTitle className="text-3xl">{data.totalTokens.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Unique Symbols</CardDescription>
              <CardTitle className="text-3xl">{data.uniqueSymbols.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Average Chains per Token</CardDescription>
              <CardTitle className="text-3xl">
                {(data.totalTokens / data.uniqueSymbols).toFixed(1)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tokens List - Using reusable component */}
        <ProviderTokenList provider={provider} />
      </main>
    </div>
  )
}
