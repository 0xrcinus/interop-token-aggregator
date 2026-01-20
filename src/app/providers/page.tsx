import Link from "next/link"
import { Effect } from "effect"
import { ProviderApiService, ApiServicesLive } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react"
import { REVALIDATE_INTERVAL } from "@/lib/config"

// Revalidate interval as fallback (in case manual revalidation fails)
// Configure via NEXT_PUBLIC_REVALIDATE_INTERVAL env variable
export const revalidate = REVALIDATE_INTERVAL

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
    <div className="min-h-screen p-8 pb-20 sm:p-20">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold">Provider Status</h1>
          <p className="text-lg text-muted-foreground">
            Monitor health and fetch history for all {data.summary.total} bridge providers
          </p>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Providers</CardDescription>
              <CardTitle className="text-3xl">{data.summary.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Healthy Providers</CardDescription>
              <CardTitle className="text-3xl text-green-600 dark:text-green-400">
                {data.summary.healthy}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Error Providers</CardDescription>
              <CardTitle className="text-3xl text-red-600 dark:text-red-400">
                {data.summary.error}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Success Rate</TableHead>
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
                    <TableCell>
                      {provider.status === "healthy" ? (
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm">Healthy</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">Error</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={
                        parseFloat(provider.successRate) === 100 ? "default" :
                        parseFloat(provider.successRate) >= 80 ? "secondary" :
                        "destructive"
                      }>
                        {provider.successRate}
                      </Badge>
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
