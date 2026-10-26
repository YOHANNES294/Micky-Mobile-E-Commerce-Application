import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Micky Mobile Ethiopia - Samsung & iPhone Store",
  description: "Ethiopia's trusted phone store for Samsung and iPhone devices",
  generator: "JO Developer",
  icons: {
    icon: [
      {
        url: "/miko.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/miko.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/miko.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
