"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { AddressDisplay } from "@/components/address-display"
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react"
import { useProviderTokens } from "@/lib/query/hooks"

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

interface ProviderTokenListProps {
  provider: string
}

export function ProviderTokenList({ provider }: ProviderTokenListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const itemsPerPage = 50

  // Read state from URL params
  const page = parseInt(searchParams.get("page") || "1")
  const search = searchParams.get("search") || ""

  // Fetch provider tokens using TanStack Query
  const { data, isLoading, error } = useProviderTokens({
    provider,
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

    router.push(`/providers/${provider}?${params.toString()}`)
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
        <CardTitle>Supported Tokens</CardTitle>
        <CardDescription>
          Search and browse tokens available through this provider
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
                  <TableHead>Tags</TableHead>
                  <TableHead>Chains</TableHead>
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
                            title="Show chain details"
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
                            {token.chainCount} {token.chainCount === 1 ? "chain" : "chains"}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-none hover:bg-transparent">
                                  <TableHead className="text-xs h-8">Chain</TableHead>
                                  <TableHead className="text-xs h-8">Name</TableHead>
                                  <TableHead className="text-xs h-8">Address</TableHead>
                                  <TableHead className="text-xs h-8 text-right">Decimals</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {token.chains.map((chain) => (
                                  <TableRow key={`${chain.chainId}-${chain.address}`} className="border-muted/30 hover:bg-transparent">
                                    <TableCell className="py-2">
                                      <Link
                                        href={`/chains/${chain.chainId}`}
                                        className="text-sm hover:text-primary"
                                      >
                                        {chain.chainName}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="py-2 text-sm">{chain.name}</TableCell>
                                    <TableCell className="py-2">
                                      <AddressDisplay address={chain.address} truncate />
                                    </TableCell>
                                    <TableCell className="py-2 text-sm text-right">
                                      {chain.decimals ?? <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                  </TableRow>
                                ))}
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
