"use client"

import { useState } from "react"

interface ChainIconProps {
  icon: string
  name: string
  size?: number
}

export function ChainIcon({ icon, name, size = 24 }: ChainIconProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return null
  }

  return (
    <img
      src={`https://icons.llamao.fi/icons/chains/rsz_${icon}.jpg`}
      alt={name}
      className="rounded-full"
      style={{ width: size, height: size }}
      onError={() => setHasError(true)}
    />
  )
}
