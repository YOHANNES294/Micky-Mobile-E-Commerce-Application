"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTheme } from "next-themes"
import { BrandTitle } from "@/components/brand-title"

export default function SetupPage() {
  const [progress, setProgress] = useState(0)
  const router = useRouter()
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme("light")
  }, [setTheme])

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer)
          setTimeout(() => router.push("/auth/login"), 500)
          return 100
        }
        return p + 2.5
      })
    }, 60)

    return () => clearInterval(timer)
  }, [router])

  // scale grow animation
  const scale = 0.7 + (progress / 100) * 0.3

  const size = 220
  const stroke = 10
  const imageSize = 140
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-coral-50 via-white to-gold-50 text-foreground light">

      {/* Loader + Logo */}
      <div
        className="relative transition-transform duration-300 ease-out"
        style={{ width: size, height: size, transform: `scale(${scale})` }}
      >
        {/* Subtle theme glow */}
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-2xl" />

        {/* Circular loader */}
        <svg
          width={size}
          height={size}
          className="-rotate-90 relative z-10"
        >
          <defs>
            <linearGradient id="themeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="oklch(var(--primary))" />
              <stop offset="100%" stopColor="oklch(var(--secondary))" />
            </linearGradient>
          </defs>

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="oklch(var(--muted))"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#themeGradient)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-150"
          />
        </svg>

        {/* Logo */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div
            className="rounded-full overflow-hidden bg-card"
            style={{ width: imageSize, height: imageSize }}
          >
            <Image
              src="/miko.png"
              alt="Micky Mobile"
              width={imageSize}
              height={imageSize}
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* Branding */}
      <div
        className={`mt-10 text-center transition-all duration-700 ${progress > 35 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
      >
        <h1 className="text-5xl font-bold tracking-tight">
          <BrandTitle />
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Ethiopia’s Trusted Phone Store
        </p>
      </div>

      {/* Progress */}
      <p className="mt-8 text-sm text-muted-foreground">
        Loading system… {Math.round(progress)}%
      </p>
    </div>
  )
}
