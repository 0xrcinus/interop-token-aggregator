import { Effect } from "effect"
import Link from "next/link"
import { ProviderApiService, ApiServicesLive } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight } from "lucide-react"

// Revalidate every 5 minutes as a fallback (in case manual revalidation fails)
export const revalidate = 300


async function getProviders() {
  const program = Effect.gen(function* () {
    const providerApi = yield* ProviderApiService
    return yield* providerApi.getProviders
  }).pipe(Effect.provide(ApiServicesLive), Effect.scoped)

  return await Effect.runPromise(program)
}

export default async function ProvidersPage() {
  const data = await getProviders()

  return (
    <div className="min-h-screen pt-8 pb-20 px-8 sm:px-20">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Providers</h1>
          <p className="text-lg text-muted-foreground">
            Browse all {data.summary.total} bridge providers and their token coverage
          </p>
        </header>

        {/* Providers Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Providers</CardTitle>
            <CardDescription>
              Click on a provider to view detailed token information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Chains</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Fetches</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.providers.map((provider) => (
                  <TableRow key={provider.name} className="hover:bg-muted/50">
                    <TableCell className="font-medium capitalize">
                      <Link href={`/providers/${provider.name}`} className="hover:text-primary">
                        {provider.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {provider.lastFetch.chainsCount ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {provider.lastFetch.tokensCount?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-mono text-green-600 dark:text-green-400">
                          {provider.stats.successfulFetches}
                        </span>
                        {provider.stats.failedFetches > 0 && (
                          <span className="text-xs font-mono text-red-600 dark:text-red-400">
                            {provider.stats.failedFetches} failed
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(provider.lastFetchedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/providers/${provider.name}`}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        View
                        <ArrowRight className="h-3 w-3" />
                      </Link>
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
