"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChainIcon } from "@/components/chain-icon"

interface Chain {
  chainId: number
  name: string
  shortName: string | null
  chainType: string | null
  icon: string | null
  explorers: Array<{ name: string; url: string }> | null
  providers: string[]
  tokenCount: string
}

interface ChainsClientProps {
  chains: Chain[]
}

export function ChainsClient({ chains }: ChainsClientProps) {
  const [search, setSearch] = useState("")

  const filteredChains = chains.filter((chain) => {
    const searchLower = search.toLowerCase()
    return (
      chain.name.toLowerCase().includes(searchLower) ||
      chain.shortName?.toLowerCase().includes(searchLower) ||
      chain.chainId.toString().includes(searchLower) ||
      chain.providers.some((p) => p.toLowerCase().includes(searchLower))
    )
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chain Details</CardTitle>
        <CardDescription>
          All chains tracked across providers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="text"
          placeholder="Search chains by name, ID, or provider..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        {search && (
          <div className="text-sm text-muted-foreground">
            Showing {filteredChains.length} of {chains.length} chains
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chain</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead>Providers</TableHead>
              <TableHead className="hidden sm:table-cell">Tokens</TableHead>
              <TableHead className="hidden lg:table-cell">Explorer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChains.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No chains found matching &quot;{search}&quot;
                </TableCell>
              </TableRow>
            ) : (
              filteredChains.map((chain) => (
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
                  <TableCell className="hidden md:table-cell">
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
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline">
                      {Number(chain.tokenCount).toLocaleString()}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
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
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
