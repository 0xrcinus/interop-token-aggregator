import Link from "next/link"
import { Effect } from "effect"
import { TokenApiService, ApiServicesLive, type TokenDetailResponse, TokenNotFoundError } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SupportMatrix } from "@/components/support-matrix"
import { AddressDisplay } from "@/components/address-display"
import { REVALIDATE_INTERVAL } from "@/lib/config"

// Revalidate interval as fallback (in case manual revalidation fails)
// Configure via NEXT_PUBLIC_REVALIDATE_INTERVAL env variable
export const revalidate = REVALIDATE_INTERVAL

async function getTokenDetail(symbol: string): Promise<TokenDetailResponse> {
  const program = Effect.gen(function* () {
    const tokenApi = yield* TokenApiService
    return yield* tokenApi.getTokenBySymbol(symbol)
  }).pipe(Effect.provide(ApiServicesLive), Effect.scoped)

  try {
    return await Effect.runPromise(program)
  } catch (error) {
    // Re-throw with appropriate message
    if (error instanceof TokenNotFoundError) {
      throw new Error("Token not found")
    }
    console.error(`Failed to fetch token ${symbol}:`, error)
    throw new Error("Failed to fetch token details")
  }
}

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>
}) {
  const { symbol: rawSymbol } = await params
  const symbol = decodeURIComponent(rawSymbol)

  let data: TokenDetailResponse
  try {
    data = await getTokenDetail(symbol)
  } catch (error) {
    return (
      <div className="min-h-screen p-8 pb-20 sm:p-20">
        <main className="max-w-7xl mx-auto space-y-8">
          <Link href="/tokens" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Tokens
          </Link>
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-lg text-muted-foreground">
                {error instanceof Error ? error.message : "Token not found"}
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link href="/tokens" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Tokens
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold font-mono">{data.symbol}</h1>
            {data.summary.hasConflicts && (
              <Badge variant="destructive">Conflicts Detected</Badge>
            )}
          </div>
          <p className="text-lg text-muted-foreground">
            Token details across {data.summary.chainCount} chains and {data.summary.providerCount}{" "}
            providers
          </p>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardDescription>Total Instances</CardDescription>
              <CardTitle className="text-3xl">{data.summary.totalInstances}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Providers</CardDescription>
              <CardTitle className="text-3xl">{data.summary.providerCount}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Chains</CardDescription>
              <CardTitle className="text-3xl">{data.summary.chainCount}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Unique Addresses</CardDescription>
              <CardTitle className="text-3xl">{data.summary.uniqueAddresses}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tags & Providers */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Token Categories</CardTitle>
              <CardDescription>Automatically detected token types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const allTags = new Set<string>()
                  data.chains.forEach((chain) => {
                    chain.instances.forEach((instance) => {
                      instance.tags.forEach((tag) => allTags.add(tag))
                    })
                  })
                  return allTags.size > 0 ? (
                    Array.from(allTags).sort().map((tag) => (
                      <Badge key={tag} variant="outline" className="capitalize">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No tags detected</span>
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Providers</CardTitle>
              <CardDescription>Data sources for this token</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.providers.map((provider) => (
                  <Badge key={provider} variant="secondary" className="capitalize">
                    {provider}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Matrix */}
        <SupportMatrix chains={data.chains as any} providers={data.providers as any} />

        {/* Chain Details */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Chain Breakdown</h2>
          {data.chains.map((chain) => (
            <Card key={chain.chainId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      <Link href={`/chains/${chain.chainId}`} className="hover:text-primary">
                        {chain.chainName} (Chain {chain.chainId})
                      </Link>
                    </CardTitle>
                    <CardDescription>{chain.instances.length} instances</CardDescription>
                  </div>
                  {chain.instances.length > 1 &&
                    new Set(chain.instances.map((i) => i.address)).size > 1 && (
                      <Badge variant="destructive">Address Conflict</Badge>
                    )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Decimals</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chain.instances.map((instance, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Link href={`/providers/${instance.provider}`}>
                            <Badge variant="secondary" className="capitalize hover:bg-secondary/80 cursor-pointer">
                              {instance.provider}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <AddressDisplay
                            address={instance.address}
                            chainId={chain.chainId}
                            truncate
                          />
                        </TableCell>
                        <TableCell>{instance.name}</TableCell>
                        <TableCell>{instance.decimals ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap max-w-xs">
                            {instance.tags && instance.tags.length > 0 ? (
                              instance.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(instance.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Show full addresses if there are conflicts */}
                {chain.instances.length > 1 &&
                  new Set(chain.instances.map((i) => i.address)).size > 1 && (
                    <div className="mt-4 p-4 bg-destructive/10 rounded-lg">
                      <p className="text-sm font-semibold text-destructive mb-2">
                        Address Conflicts Detected:
                      </p>
                      <div className="space-y-1">
                        {Array.from(
                          new Set(chain.instances.map((i) => i.address))
                        ).map((addr, i) => (
                          <div key={i} className="font-mono text-xs bg-background p-2 rounded">
                            {addr}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
