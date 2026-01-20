import Link from "next/link"
import { Effect } from "effect"
import { ChainApiService, ApiServicesLive } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChainIcon } from "@/components/chain-icon"
import { REVALIDATE_INTERVAL } from "@/lib/config"

// Revalidate interval as fallback (in case manual revalidation fails)
// Configure via NEXT_PUBLIC_REVALIDATE_INTERVAL env variable
export const revalidate = REVALIDATE_INTERVAL

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
        <Card>
          <CardHeader>
            <CardTitle>Chain Details</CardTitle>
            <CardDescription>
              All chains tracked across providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chain</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Providers</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Explorer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.chains.map((chain) => (
                  <TableRow key={chain.chainId}>
                    <TableCell>
                      <Link href={`/chains/${chain.chainId}`} className="flex items-center gap-2 hover:text-primary">
                        {chain.icon && <ChainIcon icon={chain.icon} name={chain.name} />}
                        <div>
                          <div className="font-medium">{chain.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {chain.chainId}
                            {chain.shortName && ` • ${chain.shortName}`}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {chain.chainType && (
                        <Badge variant={chain.chainType === "mainnet" ? "default" : "secondary"}>
                          {chain.chainType}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {chain.providers.map((provider) => (
                          <Link key={provider} href={`/providers/${provider}`}>
                            <Badge variant="secondary" className="text-xs hover:bg-secondary/80 cursor-pointer">
                              {provider}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {Number(chain.tokenCount).toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {chain.explorers && chain.explorers.length > 0 ? (
                        <a
                          href={chain.explorers[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {chain.explorers[0].name} ↗
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
