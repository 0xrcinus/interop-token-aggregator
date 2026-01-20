import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderTokenList } from "./token-list"

interface ProviderMetadata {
  provider: string
  totalTokens: number
  uniqueSymbols: number
}

async function getProviderMetadata(provider: string): Promise<ProviderMetadata> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  const res = await fetch(`${baseUrl}/api/providers/${provider}?limit=1`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) {
    if (res.status === 404) notFound()
    throw new Error("Failed to fetch provider metadata")
  }
  const data = await res.json()
  return {
    provider: data.provider,
    totalTokens: data.totalTokens,
    uniqueSymbols: data.uniqueSymbols,
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
