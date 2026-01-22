import Link from "next/link"
import { notFound } from "next/navigation"
import { Effect } from "effect"
import { ProviderApiService, ApiServicesLive, type ProviderMetadata } from "@/lib/api"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderTokenList } from "./token-list"
import { getProviderInfo } from "@/lib/providers/metadata"
import { ExternalLink } from "lucide-react"

// Revalidate every 5 minutes as a fallback (in case manual revalidation fails)
export const revalidate = 300


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
  const providerInfo = getProviderInfo(provider)

  return (
    <div className="min-h-screen pt-8 pb-20 px-8 sm:px-20">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">{providerInfo?.displayName || provider}</h1>
            <p className="text-lg text-muted-foreground">
              {providerInfo?.description || `Viewing ${data.totalTokens.toLocaleString()} token instances across ${data.uniqueSymbols.toLocaleString()} unique symbols`}
            </p>
          </div>

          {/* Provider Links */}
          {providerInfo && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                {providerInfo.website && (
                  <a
                    href={providerInfo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Website
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {providerInfo.docs && (
                  <a
                    href={providerInfo.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Documentation
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {/* Implementation Notes */}
              {providerInfo.notes && providerInfo.notes.length > 0 && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground">Implementation notes:</div>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    {providerInfo.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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
