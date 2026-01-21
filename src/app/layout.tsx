import type { Metadata } from "next"
import "./globals.css"
import { QueryProvider } from "@/components/query-provider"
import { NavMenu } from "@/components/nav-menu"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Interop Token Aggregator",
  description: "Aggregate token data from 12+ bridge providers across 217+ chains. Identify coverage gaps and conflicts in cross-chain token metadata.",
  keywords: ["blockchain", "cross-chain", "bridge", "tokens", "interoperability", "DeFi", "aggregation"],
  authors: [{ name: "Wonderland", url: "https://wonderland.xyz" }],
  openGraph: {
    title: "Interop Token Aggregator",
    description: "Aggregate token data from 12+ bridge providers across 217+ chains. Identify coverage gaps and conflicts.",
    type: "website",
    url: "https://token-aggregator.wonderland.xyz",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interop Token Aggregator",
    description: "Aggregate token data from 12+ bridge providers across 217+ chains. Identify coverage gaps and conflicts.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <NavMenu />
        <QueryProvider>{children}</QueryProvider>
        <footer className="border-t py-4 mt-12">
          <div className="max-w-7xl mx-auto px-8 sm:px-20">
            <Link
              href="https://wonderland.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <span>Built by</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Wonderland"
                width={20}
                height={20}
                className="opacity-60 group-hover:opacity-100 transition-opacity"
              />
              <span className="font-semibold">Wonderland</span>
            </Link>
          </div>
        </footer>
      </body>
    </html>
  )
}
