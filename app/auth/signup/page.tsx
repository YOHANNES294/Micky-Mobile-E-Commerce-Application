"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { InfoIcon } from "lucide-react"
import { BrandTitle } from "@/components/brand-title"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("email", email)
        .maybeSingle()

      if (existingUser) {
        throw new Error("An account with this email already exists")
      }

      const isDefaultAdmin = email.toLowerCase() === "yohannesm294@gmail.com"
      const userRole = isDefaultAdmin ? "admin" : "client"

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: userRole,
          },
        },
      })

      if (signUpError) throw signUpError

      if (data.user) {
        await supabase.from("user_profiles").upsert({
          id: data.user.id,
          email: data.user.email,
          role: userRole,
        })
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
    } catch (error: unknown) {
      console.error("Sign up error:", error)
      setError(error instanceof Error ? error.message : "Failed to create account")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-coral-50 via-white to-gold-50 p-6">
        <Card className="w-full max-w-md shadow-xl border-coral-100">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-coral-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-coral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-coral-700">Account Created!</h2>
              <p className="text-muted-foreground">
                Your account is ready. Redirecting to login...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-coral-50 via-white to-gold-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">
            <BrandTitle />
          </h1>
          <p className="text-muted-foreground">Ethiopia's Trusted Phone Store</p>
        </div>
        <Card className="shadow-xl border-coral-100 overflow-hidden">
          <CardHeader className="space-y-1 bg-gradient-to-r from-coral-600 to-gold-600 text-white p-6">
            <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
            <CardDescription className="text-coral-50">
              Join <BrandTitle className="inline" /> today
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <Alert className="mb-4 border-gold-200 bg-gold-50">
              <InfoIcon className="h-4 w-4 text-gold-600" />
              <AlertDescription className="text-gold-700 text-sm">
                Enter your email address and password to register.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSignUp} className="space-y-4">
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
                <Label htmlFor="password" className="font-semibold text-coral-900">
                  Password
                </Label>
                <Input
                  id="password"
                  placeholder="At least 6 characters"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-coral-200 focus:border-coral-500 focus:ring-coral-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password" className="font-semibold text-coral-900">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  placeholder="Re-enter password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link
                href="/auth/login"
                className="font-semibold text-coral-600 hover:text-coral-700 underline underline-offset-4"
              >
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
