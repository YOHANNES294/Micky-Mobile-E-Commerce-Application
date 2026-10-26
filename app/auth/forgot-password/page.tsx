// "use client"
// export const dynamic = "force-dynamic"
// import { useState } from "react"
// import { createClient } from "@/lib/supabase/client"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
// import { ArrowLeft, KeyRound, Mail, CheckCircle2, Loader2, Lock } from "lucide-react"
// import Link from "next/link"
// import { useRouter } from "next/navigation"
// import { toast } from "sonner"

// export default function ForgotPasswordPage() {
//     const [step, setStep] = useState<"email" | "otp" | "password">("email")
//     const [email, setEmail] = useState("")
//     const [otp, setOtp] = useState("")
//     const [newPassword, setNewPassword] = useState("")
//     const [isLoading, setIsLoading] = useState(false)
//     const router = useRouter()
//     const supabase = createClient()

//     const handleSendCode = async (e: React.FormEvent) => {
//         e.preventDefault()
//         if (!email) return

//         setIsLoading(true)

//         // Use signInWithOtp to force a code (OTP) flow instead of a link.
//         // This will log the user in temporarily to allow password change.
//         const { error } = await supabase.auth.signInWithOtp({
//             email,
//             options: {
//                 shouldCreateUser: false
//             }
//         })

//         setIsLoading(false)
//         if (error) {
//             toast.error(error.message)
//         } else {
//             toast.success("Verification code sent to your email")
//             setStep("otp")
//         }
//     }

//     const handleVerifyOtp = async (e: React.FormEvent) => {
//         e.preventDefault()
//         if (otp.length !== 6) return

//         setIsLoading(true)
//         const { error } = await supabase.auth.verifyOtp({
//             email,
//             token: otp,
//             type: 'email'
//         })

//         setIsLoading(false)
//         if (error) {
//             toast.error(error.message)
//         } else {
//             toast.success("Code verified successfully")
//             setStep("password")
//         }
//     }

//     const handleResetPassword = async (e: React.FormEvent) => {
//         e.preventDefault()
//         if (newPassword.length < 6) {
//             toast.error("Password must be at least 6 characters")
//             return
//         }

//         setIsLoading(true)
//         const { error } = await supabase.auth.updateUser({
//             password: newPassword
//         })

//         setIsLoading(false)
//         if (error) {
//             toast.error(error.message)
//         } else {
//             toast.success("Password reset successfully!")
//             router.push("/auth/login")
//         }
//     }

//     return (
//         <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-coral-50 via-white to-gold-50 p-6">
//             <Card className="w-full max-w-md shadow-xl border-coral-100 overflow-hidden">
//                 <div className="h-1.5 w-full bg-gradient-to-r from-coral-500 to-gold-500" />

//                 {step === "email" && (
//                     <form onSubmit={handleSendCode}>
//                         <CardHeader>
//                             <div className="w-12 h-12 rounded-full bg-coral-100 flex items-center justify-center mb-4 text-coral-600">
//                                 <KeyRound className="w-6 h-6" />
//                             </div>
//                             <CardTitle className="text-2xl font-bold text-gray-900">Forgot Password?</CardTitle>
//                             <CardDescription>
//                                 Enter your email address and we will send you a verification code to reset your password.
//                             </CardDescription>
//                         </CardHeader>
//                         <CardContent className="space-y-4">
//                             <div className="space-y-2">
//                                 <Label htmlFor="email">Email Address</Label>
//                                 <div className="relative">
//                                     <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
//                                     <Input
//                                         id="email"
//                                         type="email"
//                                         placeholder="name@example.com"
//                                         className="pl-9 border-coral-200 focus:border-coral-500"
//                                         value={email}
//                                         onChange={(e) => setEmail(e.target.value)}
//                                         required
//                                         disabled={isLoading}
//                                     />
//                                 </div>
//                             </div>
//                         </CardContent>
//                         <CardFooter className="flex flex-col gap-3">
//                             <Button
//                                 type="submit"
//                                 className="w-full bg-coral-600 hover:bg-coral-700 text-white"
//                                 disabled={isLoading}
//                             >
//                                 {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
//                                 Send Verification Code
//                             </Button>
//                             <Link href="/auth/login" className="flex items-center text-sm text-muted-foreground hover:text-gray-900 transition-colors">
//                                 <ArrowLeft className="w-4 h-4 mr-1" />
//                                 Back to Login
//                             </Link>
//                         </CardFooter>
//                     </form>
//                 )}

//                 {step === "otp" && (
//                     <form onSubmit={handleVerifyOtp}>
//                         <CardHeader>
//                             <div className="w-12 h-12 rounded-full bg-gold-100 flex items-center justify-center mb-4 text-gold-600">
//                                 <Mail className="w-6 h-6" />
//                             </div>
//                             <CardTitle className="text-2xl font-bold text-gray-900">Check your Email</CardTitle>
//                             <CardDescription>
//                                 We've sent a 6-digit verification code to <span className="font-medium text-gray-900">{email}</span>.
//                             </CardDescription>
//                         </CardHeader>
//                         <CardContent className="space-y-6 flex flex-col items-center">
//                             <InputOTP
//                                 maxLength={6}
//                                 value={otp}
//                                 onChange={setOtp}
//                                 disabled={isLoading}
//                             >
//                                 <InputOTPGroup>
//                                     <InputOTPSlot index={0} />
//                                     <InputOTPSlot index={1} />
//                                     <InputOTPSlot index={2} />
//                                 </InputOTPGroup>
//                                 <InputOTPSeparator />
//                                 <InputOTPGroup>
//                                     <InputOTPSlot index={3} />
//                                     <InputOTPSlot index={4} />
//                                     <InputOTPSlot index={5} />
//                                 </InputOTPGroup>
//                             </InputOTP>
//                             <p className="text-xs text-muted-foreground text-center">
//                                 Use the code sent to your email to verify your identity.
//                             </p>
//                         </CardContent>
//                         <CardFooter className="flex flex-col gap-3">
//                             <Button
//                                 type="submit"
//                                 className="w-full bg-gold-600 hover:bg-gold-700 text-white"
//                                 disabled={isLoading || otp.length !== 6}
//                             >
//                                 {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
//                                 Verify Code
//                             </Button>
//                             <button
//                                 type="button"
//                                 onClick={() => setStep("email")}
//                                 className="text-sm text-muted-foreground hover:text-gray-900 transition-colors"
//                             >
//                                 Change Email
//                             </button>
//                         </CardFooter>
//                     </form>
//                 )}

//                 {step === "password" && (
//                     <form onSubmit={handleResetPassword}>
//                         <CardHeader>
//                             <div className="w-12 h-12 rounded-full bg-coral-100 flex items-center justify-center mb-4 text-coral-600">
//                                 <CheckCircle2 className="w-6 h-6" />
//                             </div>
//                             <CardTitle className="text-2xl font-bold text-gray-900">Set New Password</CardTitle>
//                             <CardDescription>
//                                 Your identity has been verified. Please create a strong new password for your account.
//                             </CardDescription>
//                         </CardHeader>
//                         <CardContent className="space-y-4">
//                             <div className="space-y-2">
//                                 <Label htmlFor="new-password">New Password</Label>
//                                 <div className="relative">
//                                     <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
//                                     <Input
//                                         id="new-password"
//                                         type="password"
//                                         placeholder="••••••••"
//                                         className="pl-9 border-coral-200 focus:border-coral-500"
//                                         value={newPassword}
//                                         onChange={(e) => setNewPassword(e.target.value)}
//                                         required
//                                         minLength={6}
//                                         disabled={isLoading}
//                                     />
//                                 </div>
//                             </div>
//                         </CardContent>
//                         <CardFooter className="flex flex-col gap-3">
//                             <Button
//                                 type="submit"
//                                 className="w-full bg-coral-600 hover:bg-coral-700 text-white"
//                                 disabled={isLoading}
//                             >
//                                 {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
//                                 Update Password
//                             </Button>
//                         </CardFooter>
//                     </form>
//                 )}
//             </Card>
//         </div>
//     )
// }
"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { ArrowLeft, KeyRound, Mail, CheckCircle2, Loader2, Lock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<"email" | "otp" | "password">("email")
    const [email, setEmail] = useState("")
    const [otp, setOtp] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const router = useRouter()
    const supabase = createClient()

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setIsLoading(true)

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback`,
        })

        setIsLoading(false)

        if (error) {
            toast.error(error.message)
        } else {
            toast.success("Reset code sent — check your email for the 6-digit code")
            setStep("otp")
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (otp.length !== 6) return

        setIsLoading(true)

        const { error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: "recovery",
        })

        setIsLoading(false)

        if (error) {
            toast.error(error.message)
        } else {
            toast.success("Code verified successfully")
            setStep("password")
        }
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters")
            return
        }

        setIsLoading(true)

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        })

        setIsLoading(false)

        if (error) {
            toast.error(error.message)
        } else {
            toast.success("Password reset successfully!")
            router.push("/auth/login")
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-coral-50 via-white to-gold-50 p-6">
            <Card className="w-full max-w-md shadow-xl border-coral-100 overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-coral-500 to-gold-500" />

                {/* Step 1: Email */}
                {step === "email" && (
                    <form onSubmit={handleSendCode}>
                        <CardHeader>
                            <div className="w-12 h-12 rounded-full bg-coral-100 flex items-center justify-center mb-4 text-coral-600">
                                <KeyRound className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-gray-900">Forgot Password?</CardTitle>
                            <CardDescription>
                                Enter your email address and we will send you a verification code to reset your password.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        className="pl-9 border-coral-200 focus:border-coral-500"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
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
                                Send Verification Code
                            </Button>

                            <Link href="/auth/login" className="flex items-center text-sm text-muted-foreground hover:text-gray-900 transition-colors">
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back to Login
                            </Link>
                        </CardFooter>
                    </form>
                )}

                {/* Step 2: OTP */}
                {step === "otp" && (
                    <form onSubmit={handleVerifyOtp}>
                        <CardHeader>
                            <div className="w-12 h-12 rounded-full bg-gold-100 flex items-center justify-center mb-4 text-gold-600">
                                <Mail className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-gray-900">Check your Email</CardTitle>
                            <CardDescription>
                                We've sent a 6-digit verification code to <span className="font-medium text-gray-900">{email}</span>.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6 flex flex-col items-center">
                            <InputOTP
                                maxLength={6}
                                value={otp}
                                onChange={setOtp}
                                disabled={isLoading}
                            >
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                </InputOTPGroup>
                                <InputOTPSeparator />
                                <InputOTPGroup>
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                </InputOTPGroup>
                            </InputOTP>

                            <p className="text-xs text-muted-foreground text-center">
                                Use the code sent to your email to verify your identity.
                            </p>
                        </CardContent>

                        <CardFooter className="flex flex-col gap-3">
                            <Button
                                type="submit"
                                className="w-full bg-gold-500 hover:bg-gold-600 text-gray-900"
                                disabled={isLoading || otp.length !== 6}
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Verify Code
                            </Button>

                            <button
                                type="button"
                                onClick={() => setStep("email")}
                                className="text-sm text-muted-foreground hover:text-gray-900 transition-colors"
                                disabled={isLoading}
                            >
                                Change Email
                            </button>
                        </CardFooter>
                    </form>
                )}

                {/* Step 3: New Password */}
                {step === "password" && (
                    <form onSubmit={handleResetPassword}>
                        <CardHeader>
                            <div className="w-12 h-12 rounded-full bg-coral-100 flex items-center justify-center mb-4 text-coral-600">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-gray-900">Set New Password</CardTitle>
                            <CardDescription>
                                Your identity has been verified. Please create a strong new password for your account.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
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
                        </CardContent>

                        <CardFooter className="flex flex-col gap-3">
                            <Button
                                type="submit"
                                className="w-full bg-coral-600 hover:bg-coral-700 text-white"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Update Password
                            </Button>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    )
}