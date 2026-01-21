import Link from "next/link"
import { Effect } from "effect"
import { ProviderApiService, ChainApiService, ApiServicesLive } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Server, Network, Coins } from "lucide-react"

// Revalidate every 5 minutes as a fallback (in case manual revalidation fails)
export const revalidate = 300


async function getProviders() {
  const program = Effect.gen(function* () {
    const providerApi = yield* ProviderApiService
    return yield* providerApi.getProviders
  }).pipe(Effect.provide(ApiServicesLive), Effect.scoped)

  return await Effect.runPromise(program)
}

async function getChains() {
  const program = Effect.gen(function* () {
    const chainApi = yield* ChainApiService
    return yield* chainApi.getChains
  }).pipe(Effect.provide(ApiServicesLive), Effect.scoped)

  return await Effect.runPromise(program)
}

export default async function Home() {
  const [providersData, chainsData] = await Promise.all([getProviders(), getChains()])

  return (
    <div className="min-h-screen pt-8 pb-20 px-8 sm:px-20">
      <main className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <header className="space-y-3 text-center">
          <h1 className="text-5xl font-bold">Interop Token Aggregator</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Cross-chain token data from multiple bridge providers, aggregated and normalized
          </p>
        </header>

        {/* Main Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Providers Card */}
          <Link href="/providers">
            <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary h-full">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Server className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Providers</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Monitor bridge provider health and data coverage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Providers</span>
                    <span className="text-2xl font-bold">{providersData.summary.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Healthy</span>
                    <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {providersData.summary.healthy}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex flex-wrap gap-1.5">
                    {providersData.providers.slice(0, 6).map((provider) => (
                      <Badge
                        key={provider.name}
                        variant={provider.status === "healthy" ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {provider.name}
                      </Badge>
                    ))}
                    {providersData.providers.length > 6 && (
                      <Badge variant="outline" className="text-xs">
                        +{providersData.providers.length - 6} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-primary font-medium pt-2">
                  View all providers
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Chains Card */}
          <Link href="/chains">
            <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary h-full">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Network className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-2xl">Chains</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Explore supported blockchains and their tokens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Chains</span>
                    <span className="text-2xl font-bold">{chainsData.summary.totalChains}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Multi-Provider</span>
                    <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {chainsData.summary.multiProviderChains}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Browse chains by name, view token availability, and see which providers support each network
                  </p>
                </div>

                <div className="flex items-center gap-2 text-primary font-medium pt-2">
                  Browse chains
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Tokens Card */}
          <Link href="/tokens">
            <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary h-full">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Coins className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-2xl">Tokens</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Search and compare tokens across all chains
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Token Instances</span>
                    <span className="text-2xl font-bold">
                      {chainsData.summary.totalTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Searchable</span>
                    <span className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                      By symbol & tag
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Search by symbol (USDC, ETH), filter by category, and view canonical addresses
                  </p>
                </div>

                <div className="flex items-center gap-2 text-primary font-medium pt-2">
                  Search tokens
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  )
}
