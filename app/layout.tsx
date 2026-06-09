import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HACCP Digital Register',
  description: 'Sistema digitale per la gestione dei registri HACCP, tracciabilità lotti e cicli di abbattimento termico.',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0a0f1e" />
      </head>
      <body>{children}</body>
    </html>
  )
}
