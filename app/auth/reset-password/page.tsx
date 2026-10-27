"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function ResetPasswordPage() {
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isCheckingSession, setIsCheckingSession] = useState(true)
    const [hasActiveSession, setHasActiveSession] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        let mounted = true

        async function verifySession() {
            try {
                // If URL contains a code query param (PKCE flow), exchange it
                if (typeof window !== "undefined") {
                    const url = new URL(window.location.href)
                    const code = url.searchParams.get("code")
                    if (code) {
                        const { error } = await supabase.auth.exchangeCodeForSession(code)
                        if (error) {
                            console.warn("Failed to exchange code:", error.message)
                        }
                    }
                }

                const { data: { session } } = await supabase.auth.getSession()
                if (mounted) {
                    if (session) {
                        setHasActiveSession(true)
                    }
                    setIsCheckingSession(false)
                }
            } catch (e) {
                if (mounted) {
                    setIsCheckingSession(false)
                }
            }
        }

        verifySession()

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || session) {
                setHasActiveSession(true)
                setIsCheckingSession(false)
            }
        })

        return () => {
            mounted = false
            authListener.subscription.unsubscribe()
        }
    }, [supabase])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters")
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }

        setIsLoading(true)

        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        })

        setIsLoading(false)

        if (error) {
            toast.error(error.message || "Failed to update password. Please try again.")
        } else {
            setIsSuccess(true)
            toast.success("Password updated successfully!")
            setTimeout(() => {
                router.push("/auth/login")
            }, 2500)
        }
    }

    if (isCheckingSession) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-coral-50 via-white to-gold-50 p-6">
                <Card className="w-full max-w-md shadow-xl border-coral-100 p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-coral-600 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">Validating recovery link...</p>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-coral-50 via-white to-gold-50 p-6">
            <Card className="w-full max-w-md shadow-xl border-coral-100 overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-coral-500 to-gold-500" />

                {isSuccess ? (
                    <CardContent className="pt-8 pb-6 text-center space-y-4">
                        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-gray-900">Password Changed!</CardTitle>
                        <CardDescription>
                            Your password has been reset successfully. Redirecting you to login...
                        </CardDescription>
                        <Button
                            onClick={() => router.push("/auth/login")}
                            className="w-full mt-4 bg-coral-600 hover:bg-coral-700 text-white"
                        >
                            Proceed to Login
                        </Button>
                    </CardContent>
                ) : (
                    <form onSubmit={handleUpdatePassword}>
                        <CardHeader>
                            <div className="w-12 h-12 rounded-full bg-coral-100 flex items-center justify-center mb-4 text-coral-600">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-gray-900">Set New Password</CardTitle>
                            <CardDescription>
                                Enter and confirm your new secure password below.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {!hasActiveSession && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                    Note: If this recovery session has expired or was already used, please request a new verification code from the Forgot Password page.
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-9 border-coral-200 focus:border-coral-500"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-9 border-coral-200 focus:border-coral-500"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="flex flex-col gap-3">
                            <Button
                                type="submit"
                                className="w-full bg-coral-600 hover:bg-coral-700 text-white"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Save New Password
                            </Button>
                            <Link
                                href="/auth/login"
                                className="flex items-center text-sm text-muted-foreground hover:text-gray-900 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back to Login
                            </Link>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    )
}
