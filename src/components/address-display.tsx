"use client"

import { useState } from "react"
import { Copy, Check, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddressDisplayProps {
  address: string | null | undefined
  chainId?: number
  explorerUrl?: string
  truncate?: boolean
  className?: string
}

/**
 * Display a blockchain address with copy functionality and optional explorer link
 * @param address - The blockchain address to display
 * @param chainId - Optional chain ID for default explorer URL
 * @param explorerUrl - Optional custom explorer URL (overrides chainId)
 * @param truncate - Whether to show truncated address (default: false)
 * @param className - Additional CSS classes
 */
export function AddressDisplay({
  address,
  chainId,
  explorerUrl,
  truncate = false,
  className,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false)

  // Safety check for undefined/null address
  if (!address) {
    return <span className="text-muted-foreground text-sm">No address</span>
  }

  const displayAddress = truncate
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy address:", err)
    }
  }

  // Build explorer URL if not provided
  const finalExplorerUrl = explorerUrl || (chainId ? `/chains/${chainId}` : undefined)

  return (
    <div className={cn("flex items-center gap-1.5 font-mono text-sm", className)}>
      <span className="select-all">{displayAddress}</span>

      <button
        onClick={handleCopy}
        className="inline-flex items-center justify-center p-1 rounded hover:bg-muted transition-colors"
        title="Copy address"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        )}
      </button>

      {finalExplorerUrl && (
        <a
          href={finalExplorerUrl}
          target={explorerUrl ? "_blank" : undefined}
          rel={explorerUrl ? "noopener noreferrer" : undefined}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center p-1 rounded hover:bg-muted transition-colors"
          title="View in explorer"
        >
          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </a>
      )}
    </div>
  )
}
