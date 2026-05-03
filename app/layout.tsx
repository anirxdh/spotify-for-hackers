import type { Metadata } from 'next'
import { Share_Tech_Mono } from 'next/font/google'
import './globals.css'

const shareTechMono = Share_Tech_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-share-tech-mono',
})

export const metadata: Metadata = {
  title: 'spotify.trm v2.0.1 — music for hackers',
  description: 'A terminal-style Spotify interface for hackers and cyberpunk enthusiasts.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: '/favicon.png',
    apple: [{ url: '/favicon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${shareTechMono.variable} bg-background`}>
      <body className="font-mono antialiased">
        {children}
      </body>
    </html>
  )
}
