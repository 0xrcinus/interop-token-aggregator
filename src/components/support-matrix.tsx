import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, AlertTriangle } from "lucide-react"

interface SupportMatrixProps {
  chains: Array<{
    chainId: number
    chainName: string
    instances: Array<{
      provider: string
      address: string
      decimals: number | null
    }>
  }>
  providers: string[]
}

/**
 * Support Matrix Component
 * Shows which providers support which chains for a given token
 * - Green check = supported
 * - Orange warning = supported but with conflicts (different addresses on same chain)
 * - Blank = not supported
 */
export function SupportMatrix({ chains, providers }: SupportMatrixProps) {
  // Build a matrix: chain -> provider -> support status
  const matrix = new Map<number, Map<string, { supported: boolean; hasConflict: boolean }>>()
  const chainProviderCounts = new Map<number, number>()

  for (const chain of chains) {
    const providerMap = new Map<string, { supported: boolean; hasConflict: boolean }>()

    // Count instances per address to find the majority
    // Note: Preserving case for non-EVM chains (Solana, etc.)
    const addressCounts = new Map<string, number>()
    for (const instance of chain.instances) {
      const addr = instance.address
      addressCounts.set(addr, (addressCounts.get(addr) || 0) + 1)
    }

    // Find the majority address (most common)
    let majorityAddress = ""
    let maxCount = 0
    for (const [addr, count] of addressCounts) {
      if (count > maxCount) {
        maxCount = count
        majorityAddress = addr
      }
    }

    // Only flag as conflict if provider uses a minority address
    let supportedCount = 0
    for (const provider of providers) {
      const providerInstance = chain.instances.find((i) => i.provider === provider)
      const isSupported = providerInstance !== undefined

      if (isSupported) {
        supportedCount++
      }

      // Only flag conflict if this provider uses a non-majority address
      const hasConflict = isSupported &&
                          addressCounts.size > 1 &&
                          providerInstance.address !== majorityAddress

      providerMap.set(provider, {
        supported: isSupported,
        hasConflict,
      })
    }

    matrix.set(chain.chainId, providerMap)
    chainProviderCounts.set(chain.chainId, supportedCount)
  }

  // Sort chains by provider count descending
  const sortedChains = [...chains].sort((a, b) => {
    const countA = chainProviderCounts.get(a.chainId) || 0
    const countB = chainProviderCounts.get(b.chainId) || 0
    return countB - countA
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Support Matrix</CardTitle>
        <CardDescription>
          Shows which providers support this token on each chain
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 border-b-2 font-semibold text-sm">Chain</th>
                {providers.map((provider) => (
                  <th
                    key={provider}
                    className="text-center p-3 border-b-2 font-semibold text-sm capitalize"
                  >
                    {provider}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedChains.map((chain) => {
                const providerMap = matrix.get(chain.chainId)
                const providerCount = chainProviderCounts.get(chain.chainId) || 0
                return (
                  <tr key={chain.chainId} className="hover:bg-muted/50">
                    <td className="p-3 border-b text-sm font-medium">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span>{chain.chainName}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {chain.chainId}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {providerCount} {providerCount === 1 ? "provider" : "providers"}
                        </span>
                      </div>
                    </td>
                    {providers.map((provider) => {
                      const status = providerMap?.get(provider)
                      return (
                        <td key={provider} className="p-3 border-b text-center">
                          {status?.supported && (
                            <div className="flex justify-center">
                              {status.hasConflict ? (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                  <span className="text-xs text-orange-600">Conflict</span>
                                </div>
                              ) : (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span>Supported</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span>Uses minority address (conflict)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border border-dashed rounded" />
            <span>Not supported</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
