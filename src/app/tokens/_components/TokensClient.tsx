"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTokens } from "@/lib/query/hooks"

export function TokensClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemsPerPage = 100

  // Read state from URL params
  const page = parseInt(searchParams.get("page") || "1")
  const search = searchParams.get("search") || ""
  const selectedTag = searchParams.get("tag") || ""

  // Fetch tokens using TanStack Query
  const { data, isLoading, error } = useTokens({
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
    symbol: search || undefined,
    tag: selectedTag || undefined,
  })

  const tokens = data?.tokens ?? []
  const total = data?.pagination?.total ?? 0

  // Update URL when filters or page change
  const updateUrl = (updates: { page?: number; search?: string; tag?: string }) => {
    const params = new URLSearchParams(searchParams.toString())

    const newPage = updates.page ?? page
    const newSearch = updates.search ?? search
    const newTag = updates.tag ?? selectedTag

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

    if (newTag) {
      params.set("tag", newTag)
    } else {
      params.delete("tag")
    }

    router.push(`/tokens?${params.toString()}`)
  }

  return (
    <div className="min-h-screen pt-8 pb-20 px-8 sm:px-20">
      <main className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Token Search</h1>
          <p className="text-lg text-muted-foreground">
            Search and compare tokens across chains and providers
          </p>
        </header>

        {/* Search & Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter Tokens</CardTitle>
            <CardDescription>
              Search by symbol or name, filter by category (showing top 100 tokens)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                type="text"
                placeholder="Search tokens (e.g., USDC, ETH)..."
                value={search}
                onChange={(e) => updateUrl({ search: e.target.value, page: 1 })}
                className="flex-1"
              />
              <select
                value={selectedTag}
                onChange={(e) => updateUrl({ tag: e.target.value, page: 1 })}
                className="px-3 py-2 border rounded-md bg-background md:w-48"
              >
                <option value="">All Categories</option>
                <option value="stablecoin">Stablecoins</option>
                <option value="wrapped">Wrapped</option>
                <option value="liquidity-pool">Liquidity Pools</option>
                <option value="governance">Governance</option>
                <option value="bridged">Bridged</option>
                <option value="yield-bearing">Yield-Bearing</option>
                <option value="rebasing">Rebasing</option>
                <option value="native">Native</option>
              </select>
            </div>
            {(search || selectedTag) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Active filters:</span>
                {search && (
                  <Badge variant="secondary" className="cursor-pointer" onClick={() => updateUrl({ search: "", page: 1 })}>
                    Search: {search} ✕
                  </Badge>
                )}
                {selectedTag && (
                  <Badge variant="secondary" className="cursor-pointer" onClick={() => updateUrl({ tag: "", page: 1 })}>
                    Tag: {selectedTag} ✕
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>
              {isLoading ? "Loading..." : "Search Results"}
            </CardTitle>
            <CardDescription>
              {isLoading ? (
                "Fetching token data..."
              ) : total > 0 ? (
                `Showing ${(page - 1) * itemsPerPage + 1}-${Math.min(page * itemsPerPage, total)} of ${total.toLocaleString()} total tokens`
              ) : (
                "No tokens found"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading tokens...</p>
            ) : error ? (
              <p className="text-destructive">Error loading tokens: {error.message}</p>
            ) : tokens.length === 0 ? (
              <p className="text-muted-foreground">
                No tokens found matching &quot;{search}&quot;
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="hidden md:table-cell">Name</TableHead>
                      <TableHead className="hidden md:table-cell">Tags</TableHead>
                      <TableHead>Providers</TableHead>
                      <TableHead className="hidden sm:table-cell">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.map((token, index) => (
                      <TableRow key={`${token.symbol}-${index}`}>
                        <TableCell className="font-medium font-mono">
                          <Link href={`/tokens/${encodeURIComponent(token.symbol)}`} className="hover:text-primary">
                            {token.symbol}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Link href={`/tokens/${encodeURIComponent(token.symbol)}`} className="hover:text-primary">
                            {token.name}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex gap-1 flex-wrap max-w-xs">
                            {token.tags && token.tags.length > 0 ? (
                              token.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {token.providerCount} {token.providerCount === 1 ? "provider" : "providers"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Link
                            href={`/tokens/${encodeURIComponent(token.symbol)}`}
                            className="text-sm text-primary hover:underline"
                          >
                            View Details →
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
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
      </main>
    </div>
  )
}
