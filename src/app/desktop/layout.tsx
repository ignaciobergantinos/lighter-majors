// ── Desktop Layout — Transparent background for Electron ────
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Providers } from '../providers'
import '../globals.css'

const geistSans = localFont({
  src: '../fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: '../fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Lighter Majors — Desktop Widget',
  description: 'Floating desktop trade widget for Lighter exchange',
}

export default function DesktopLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-transparent text-zinc-100`}
        style={{ background: 'transparent' }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
