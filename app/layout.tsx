import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { SolanaProviders } from '@/lib/providers'
import { QueryProvider } from '@/lib/providers/query-provider'
import { WalletProvider, AuthProvider, RoleProvider, MinerRegistryProvider } from '@/lib/contexts'
import { ErrorBoundary } from '@/components/error-boundary'
import './globals.css'

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'NeuroGrid Protocol | The Liquidity Layer for AI Compute',
  description:
    'Decentralized GPU computing exchange powered by NeuroGrid proprietary tunnel protocol and Proof-of-Inference. Community-driven, anti-VC, fair launch.',
  keywords: ['GPU', 'decentralized', 'computing', 'AI', 'blockchain', 'PoI', 'RTX4090'],
  icons: {
    icon: '/images/neurogrid-logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#00FF41',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistMono.variable} ${inter.variable} font-mono antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark">
          <QueryProvider>
          <SolanaProviders>
            <WalletProvider>
              <AuthProvider>
                <RoleProvider>
                <MinerRegistryProvider>
                  <TooltipProvider delayDuration={200}>
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                    <Toaster richColors position="top-center" />
                  </TooltipProvider>
                </MinerRegistryProvider>
              </RoleProvider>
              </AuthProvider>
            </WalletProvider>
          </SolanaProviders>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
