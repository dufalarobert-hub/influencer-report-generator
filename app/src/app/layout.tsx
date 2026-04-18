import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NiftyMinds - Influencer Report Generator',
  description: 'Internal tool for generating influencer marketing reports',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sk">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
