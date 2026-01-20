"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { AddressDisplay } from "@/components/address-display"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useChainTokens } from "@/lib/query/hooks"

// Type for token instance from API response
type TokenInstance = {
  address: string
  name: string
  decimals: number | null
  providerName: string
}

// Tag color mapping
const tagColors: Record<string, string> = {
  stablecoin: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  wrapped: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  native: "bg-green-500/10 text-green-700 dark:text-green-400",
  bridged: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "liquidity-pool": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  "yield-bearing": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  rebasing: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
  governance: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
}

interface TokenListForChainProps {
  chainId: number
  explorerUrl?: string
}

export function TokenListForChain({ chainId, explorerUrl }: TokenListForChainProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const itemsPerPage = 50

  // Read state from URL params
  const page = parseInt(searchParams.get("page") || "1")
  const search = searchParams.get("search") || ""

  // Fetch chain tokens using TanStack Query
  const { data, isLoading, error } = useChainTokens({
    chainId,
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
    search: search || undefined,
  })

  const tokens = data?.tokens ?? []
  const total = data?.pagination?.total ?? 0

  // Update URL when filters or page change
  const updateUrl = (updates: { page?: number; search?: string }) => {
    const params = new URLSearchParams(searchParams.toString())

    const newPage = updates.page ?? page
    const newSearch = updates.search ?? search

    if (newPage > 1) {
      params.set("page", newPage.toString())
    } else {
      params.delete("page")
    }

    if (newSearch) {
      params.set("search", newSearch)
    } else {
      params.delete("search")
    }

    router.push(`/chains/${chainId}?${params.toString()}`)
  }

  const toggleExpand = (symbol: string) => {
    const newExpanded = new Set(expandedRows)

    if (newExpanded.has(symbol)) {
      newExpanded.delete(symbol)
    } else {
      newExpanded.add(symbol)
    }

    setExpandedRows(newExpanded)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Tokens</CardTitle>
        <CardDescription>
          Search and browse tokens on this chain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <Input
          type="text"
          placeholder="Search tokens (e.g., USDC, ETH)..."
          value={search}
          onChange={(e) => updateUrl({ search: e.target.value, page: 1 })}
        />

        {search && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Active filter:</span>
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => updateUrl({ search: "", page: 1 })}
            >
              Search: {search} ✕
            </Badge>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <p className="text-muted-foreground">Loading tokens...</p>
        ) : error ? (
          <p className="text-destructive">Error loading tokens: {error.message}</p>
        ) : tokens.length === 0 ? (
          <p className="text-muted-foreground">
            No tokens found{search ? ` matching "${search}"` : ""}
          </p>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * itemsPerPage + 1}-
              {Math.min(page * itemsPerPage, total)} of {total.toLocaleString()} tokens
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Providers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token, index) => {
                  const isExpanded = expandedRows.has(token.symbol)

                  return (
                    <React.Fragment key={`${token.symbol}-${index}`}>
                      <TableRow>
                        <TableCell>
                          <button
                            onClick={() => toggleExpand(token.symbol)}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="Show provider details"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium font-mono">
                          <Link
                            href={`/tokens/${encodeURIComponent(token.symbol)}`}
                            className="hover:text-primary"
                          >
                            {token.symbol}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/tokens/${encodeURIComponent(token.symbol)}`}
                            className="hover:text-primary"
                          >
                            {token.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <AddressDisplay
                            address={token.canonicalAddress}
                            explorerUrl={explorerUrl ? `${explorerUrl}/address/${token.canonicalAddress}` : undefined}
                            truncate
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap max-w-xs">
                            {token.tags && token.tags.length > 0 ? (
                              token.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    tagColors[tag] ||
                                    "bg-gray-500/10 text-gray-700 dark:text-gray-400"
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {token.providerCount}{" "}
                            {token.providerCount === 1 ? "provider" : "providers"}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-0">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-none hover:bg-transparent">
                                  <TableHead className="text-xs h-8">Address</TableHead>
                                  <TableHead className="text-xs h-8">Name</TableHead>
                                  <TableHead className="text-xs h-8 text-right">Decimals</TableHead>
                                  <TableHead className="text-xs h-8">Providers</TableHead>
                                  <TableHead className="text-xs h-8">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(() => {
                                  // Safety check for instances array
                                  if (!token.instances || !Array.isArray(token.instances)) {
                                    return (
                                      <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                          No instance data available
                                        </TableCell>
                                      </TableRow>
                                    )
                                  }

                                  const byAddress = new Map<string, TokenInstance[]>()
                                  token.instances.forEach(instance => {
                                    // Don't lowercase - preserve original case (important for Solana base58)
                                    const addr = instance.address
                                    if (!byAddress.has(addr)) {
                                      byAddress.set(addr, [])
                                    }
                                    byAddress.get(addr)!.push(instance)
                                  })

                                  return Array.from(byAddress.entries()).map(([address, addressInstances]) => {
                                    const isCanonical = address === token.canonicalAddress
                                    const hasConflict = new Set(addressInstances.map(i => i.name)).size > 1 ||
                                                       new Set(addressInstances.map(i => i.decimals).filter(d => d !== null)).size > 1

                                    return (
                                      <TableRow
                                        key={address}
                                        className={`border-muted/30 hover:bg-transparent ${hasConflict ? 'bg-destructive/5' : ''}`}
                                      >
                                        <TableCell className="py-2">
                                          <AddressDisplay
                                            address={address}
                                            explorerUrl={explorerUrl ? `${explorerUrl}/address/${address}` : undefined}
                                            truncate
                                          />
                                        </TableCell>
                                        <TableCell className="py-2 text-sm">{addressInstances[0].name}</TableCell>
                                        <TableCell className="py-2 text-sm text-right">
                                          {addressInstances[0].decimals ?? <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <div className="flex flex-wrap gap-1">
                                            {addressInstances.map((instance, idx) => (
                                              <Link
                                                key={`${instance.providerName}-${idx}`}
                                                href={`/providers/${instance.providerName}`}
                                              >
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs hover:bg-muted cursor-pointer"
                                                >
                                                  {instance.providerName}
                                                </Badge>
                                              </Link>
                                            ))}
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <div className="flex gap-1">
                                            {isCanonical && (
                                              <Badge variant="outline" className="text-xs">
                                                Canonical
                                              </Badge>
                                            )}
                                            {hasConflict && (
                                              <Badge variant="destructive" className="text-xs">
                                                Conflict
                                              </Badge>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })
                                })()}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {total > itemsPerPage && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => updateUrl({ page: page - 1 })}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm border rounded-md bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <div className="text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(total / itemsPerPage)}
                </div>
                <button
                  onClick={() => updateUrl({ page: page + 1 })}
                  disabled={page >= Math.ceil(total / itemsPerPage)}
                  className="px-4 py-2 text-sm border rounded-md bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
