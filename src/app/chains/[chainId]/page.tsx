import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChainIcon } from "@/components/chain-icon"
import { ExternalLink } from "lucide-react"
import { TokenListForChain } from "./token-list"

interface ChainMetadata {
  chainId: number
  name: string
  shortName?: string
  chainType?: string
  icon?: string
  infoUrl?: string
  explorers?: Array<{
    name: string
    url: string
    standard: string
  }>
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  providers: string[]
  totalTokens: number
}

async function getChainMetadata(chainId: string): Promise<ChainMetadata> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  const res = await fetch(`${baseUrl}/api/chains/${chainId}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) {
    if (res.status === 404) notFound()
    throw new Error("Failed to fetch chain details")
  }
  const data = await res.json()
  return {
    chainId: data.chainId,
    name: data.name,
    shortName: data.shortName,
    chainType: data.chainType,
    icon: data.icon,
    infoUrl: data.infoUrl,
    explorers: data.explorers,
    nativeCurrency: data.nativeCurrency,
    providers: data.providers,
    totalTokens: data.totalTokens,
  }
}

export default async function ChainDetailPage({
  params,
}: {
  params: Promise<{ chainId: string }>
}) {
  const { chainId } = await params
  const data = await getChainMetadata(chainId)

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link href="/chains" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Chains
          </Link>
          <div className="flex items-center gap-3">
            {data.icon && <ChainIcon icon={data.icon} name={data.name} size={48} />}
            <div>
              <h1 className="text-4xl font-bold">{data.name}</h1>
              <p className="text-muted-foreground">
                Chain ID: {data.chainId}
                {data.shortName && ` • ${data.shortName}`}
              </p>
            </div>
          </div>
        </header>

        {/* Chain Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Chain Type</CardDescription>
              <CardTitle className="text-2xl">
                {data.chainType && (
                  <Badge variant={data.chainType === "mainnet" ? "default" : "secondary"}>
                    {data.chainType}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Native Currency</CardDescription>
              <CardTitle className="text-2xl">
                {data.nativeCurrency.symbol}
              </CardTitle>
              <CardContent className="pt-2 px-0">
                <p className="text-sm text-muted-foreground">
                  {data.nativeCurrency.name} ({data.nativeCurrency.decimals} decimals)
                </p>
              </CardContent>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Providers</CardDescription>
              <CardTitle className="text-2xl">{data.providers.length}</CardTitle>
            </CardHeader>
          </Card>

          {data.infoUrl && (
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Info</CardDescription>
                <CardContent className="pt-2 px-0">
                  <a
                    href={data.infoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Visit Website <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </CardHeader>
            </Card>
          )}

          {data.explorers && data.explorers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Block Explorers</CardDescription>
                <CardContent className="pt-2 px-0">
                  <div className="flex flex-col gap-1">
                    {data.explorers.slice(0, 2).map((explorer) => (
                      <a
                        key={explorer.url}
                        href={explorer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {explorer.name} <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Provider Support */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Support</CardTitle>
            <CardDescription>
              Interoperability providers supporting this chain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.providers.map((provider) => (
                <Link key={provider} href={`/providers/${provider}`}>
                  <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">
                    {provider}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tokens List - Using reusable component */}
        <TokenListForChain chainId={data.chainId} explorerUrl={data.explorers?.[0]?.url} />
      </main>
    </div>
  )
}
