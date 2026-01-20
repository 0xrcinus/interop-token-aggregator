import type { Metadata } from "next"
import "./globals.css"
import { QueryProvider } from "@/components/query-provider"

export const metadata: Metadata = {
  title: "Interop Token Aggregator",
  description: "Cross-chain token data aggregation and comparison",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
