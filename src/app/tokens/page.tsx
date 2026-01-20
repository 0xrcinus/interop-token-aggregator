import { Suspense } from "react"
import { TokensClient } from "./_components/TokensClient"

export default function TokensPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 pb-20 sm:p-20">Loading...</div>}>
      <TokensClient />
    </Suspense>
  )
}
