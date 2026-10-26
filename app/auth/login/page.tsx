"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Phone, MapPin } from "lucide-react"
import { useTheme } from "next-themes"
import { BrandTitle } from "@/components/brand-title"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme("light")
  }, [setTheme])

  // Typewriter animation state
  const fullAddress = "Bole Alemnesh Plaza Ground Floor"
  const [displayedAddress, setDisplayedAddress] = useState("")

  useEffect(() => {
    let index = 0
    const interval = setInterval(() => {
      if (index < fullAddress.length) {
        setDisplayedAddress(fullAddress.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 80)

    return () => clearInterval(interval)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: signInError, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      const { data: userData, error: userError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle()

      if (userData?.role === "admin" || email === "yohannesm294@gmail.com") {
        router.push("/admin")
      } else {
        router.push("/client")
      }

      router.refresh()
    } catch (error: unknown) {
      console.error("Login error:", error)
      setError(error instanceof Error ? error.message : "Invalid email or password")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-coral-100 via-white to-gold-200 p-6 light">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">
            <BrandTitle />
          </h1>
          <p className="text-muted-foreground">Ethiopia's Trusted Phone Store</p>
        </div>
        <Card className="shadow-xl border-coral-100 overflow-hidden">
          <CardHeader className="space-y-1 bg-gradient-to-r from-coral-600 to-gold-600 text-white p-6">
            <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
            <CardDescription className="text-coral-50">Enter your email and password to access your account</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="font-semibold text-coral-900">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-coral-200 focus:border-coral-500 focus:ring-coral-500"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="font-semibold text-coral-900">
                    Password
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-coral-600 hover:text-coral-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  placeholder="Enter your password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-coral-200 focus:border-coral-500 focus:ring-coral-500"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-coral-600 to-gold-600 hover:from-coral-700 hover:to-gold-700 text-white font-semibold py-6 shadow-md"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Footer with Address Icon + Phone Icon + Animation */}
            <div className="text-center text-sm space-y-4">
              <div>
                <span className="text-muted-foreground">Don't have an account? </span>
                <Link
                  href="/auth/signup"
                  className="font-semibold text-coral-600 hover:text-coral-700 underline underline-offset-4"
                >
                  Create Account
                </Link>
              </div>

              <div className="flex flex-col gap-3 border-t border-coral-50 pt-4">
                {/* Address with MapPin Icon + Typewriter Animation */}
                <div className="flex items-center justify-center gap-2 text-gray-800">
                  <MapPin className="w-5 h-5 text-coral-600" />
                  <div className="font-bold text-lg min-h-[2rem]">
                    <span className="inline-block">
                      {displayedAddress}
                      {displayedAddress.length < fullAddress.length && (
                        <span className="inline-block w-0.5 h-6 bg-coral-600 ml-1 align-middle animate-pulse" />
                      )}
                    </span>
                  </div>
                </div>

                {/* Phone Number with Icon */}
                <div className="flex items-center justify-center gap-2 text-muted-foreground hover:text-coral-600 transition-colors cursor-pointer">
                  <Phone className="w-5 h-5" />
                  <a href="tel:+251933694796" className="font-medium text-base">
                    +251 93 369 4796
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
