"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ShoppingBag,
  PhoneCall,
  Copy,
  Loader2,
  Smartphone,
  ExternalLink,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { BrandTitle } from "@/components/brand-title"
import { toast } from "sonner"

interface VerifyResult {
  success: boolean
  alreadyVerified?: boolean
  payment?: {
    id?: string
    transaction_ref: string
    provider_tx_id?: string
    amount: number
    currency: string
    status: string
  }
  order?: {
    id: string
    amount: number
    payment_status: string
    fulfillment_status?: string
    customer_name?: string
    phone?: {
      id: string
      brand: string
      model: string
      storage: string
      ram: string
      image?: string
      price: string
    }
  }
  message?: string
  error?: string
}

function CheckoutResultContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const txRef = searchParams.get("tx_ref")
  const orderId = searchParams.get("order_id")

  const [isLoading, setIsLoading] = useState(true)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verifyTransaction = async () => {
    if (!txRef) {
      setError("No transaction reference provided in URL.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/payments/chapa/verify?tx_ref=${encodeURIComponent(txRef)}`)
      const data = await response.json()

      if (!response.ok && !data.order) {
        setError(data.error || "Failed to verify transaction with payment provider.")
      } else {
        setResult(data)
      }
    } catch {
      setError("Network connection issue while verifying payment. Please retry.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    verifyTransaction()
  }, [txRef])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  const paymentStatus = result?.order?.payment_status || (result?.success ? "completed" : "pending")

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-white to-gold-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col items-center justify-center p-4">
      {/* Header Brand */}
      <div className="mb-6 text-center">
        <Link href="/client" className="inline-block">
          <h1 className="text-3xl font-extrabold tracking-tight">
            <BrandTitle />
          </h1>
        </Link>
        <p className="text-xs text-muted-foreground mt-1">Official Ethiopian Mobile Marketplace</p>
      </div>

      <Card className="w-full max-w-lg shadow-xl border-coral-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        {/* Loading State */}
        {isLoading && (
          <CardContent className="pt-12 pb-12 flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-coral-100 dark:bg-coral-950/60 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-coral-600 animate-spin" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Verifying Payment</CardTitle>
              <CardDescription className="text-base mt-1">
                Communicating with Chapa gateway to confirm your transaction status...
              </CardDescription>
            </div>
          </CardContent>
        )}

        {/* Error or Unknown State */}
        {!isLoading && error && (
          <>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-2">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-red-700 dark:text-red-400">
                Verification Issue
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-2 pt-4">
              <Button onClick={verifyTransaction} className="w-full bg-coral-600 hover:bg-coral-700 text-white">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retry Verification
              </Button>
              <Link href="/client" className="w-full">
                <Button variant="outline" className="w-full">
                  Return to Store
                </Button>
              </Link>
            </CardFooter>
          </>
        )}

        {/* Success / Completed State */}
        {!isLoading && !error && paymentStatus === "completed" && (
          <>
            <CardHeader className="text-center pb-3">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-2xl font-bold text-foreground">Payment Confirmed!</CardTitle>
                <Badge className="bg-green-600 text-white">Verified</Badge>
              </div>
              <CardDescription className="text-sm">
                Thank you, {result?.order?.customer_name || "Valued Customer"}! Your payment has been received and verified.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              {/* Product Info Card */}
              {result?.order?.phone && (
                <div className="bg-muted/70 rounded-xl p-4 border flex items-center gap-3">
                  <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {result.order.phone.image ? (
                      <img
                        src={result.order.phone.image}
                        alt={result.order.phone.model}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Smartphone className="w-7 h-7 text-coral-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground text-sm truncate">
                      {result.order.phone.model}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {result.order.phone.brand} • {result.order.phone.storage} • {result.order.phone.ram}
                    </p>
                    <p className="text-sm font-extrabold text-coral-600 mt-0.5">
                      {result.order.amount?.toLocaleString()} ETB
                    </p>
                  </div>
                </div>
              )}

              {/* Transaction Details */}
              <div className="bg-muted/40 rounded-xl p-4 border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Transaction Reference:</span>
                  <div className="flex items-center gap-1 font-mono font-bold text-foreground">
                    <span>{txRef}</span>
                    <button
                      onClick={() => copyToClipboard(txRef || "", "Reference")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {result?.payment?.provider_tx_id && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Chapa Trans ID:</span>
                    <span className="font-mono text-foreground">{result.payment.provider_tx_id}</span>
                  </div>
                )}

                {result?.order?.id && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-mono text-foreground">{result.order.id.slice(0, 8)}...</span>
                  </div>
                )}

                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <span className="font-bold text-green-600 uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified Paid
                  </span>
                </div>
              </div>

              {/* Store Pickup Notice */}
              <div className="p-3 bg-coral-50 dark:bg-coral-950/30 border border-coral-200 dark:border-coral-900 rounded-xl space-y-1">
                <p className="text-xs font-bold text-coral-800 dark:text-coral-300 uppercase">
                  Device Ready For Pickup / Delivery
                </p>
                <p className="text-xs text-muted-foreground">
                  Location: Alemnesh Plaza Ground Floor, Bole Medhanialem, Addis Ababa.
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-mono font-bold text-foreground">+251 93 369 4796</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard("+251933694796", "Phone number")}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copy
                  </Button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pt-2">
              {result?.order?.id && (
                <Link href={`/client/orders/${result.order.id}`} className="w-full">
                  <Button className="w-full bg-gradient-to-r from-coral-600 to-gold-600 hover:from-coral-700 hover:to-gold-700 text-white font-semibold">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    View Order Details
                  </Button>
                </Link>
              )}
              <Link href="/client" className="w-full">
                <Button variant="outline" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </CardFooter>
          </>
        )}

        {/* Pending State */}
        {!isLoading && !error && paymentStatus === "pending" && (
          <>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                Payment Pending
              </CardTitle>
              <CardDescription>
                Your payment is currently being processed by your bank or mobile wallet provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="bg-muted p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-mono font-bold">{txRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider:</span>
                  <span>Chapa (Telebirr / CBE / Cards)</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                If money was deducted from your account, it may take 1-2 minutes to settle. Click below to re-check.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 pt-2">
              <Button onClick={verifyTransaction} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                <RotateCcw className="w-4 h-4 mr-2" />
                Refresh Verification Status
              </Button>
              <Link href="/client" className="w-full">
                <Button variant="outline" className="w-full">
                  Return to Marketplace
                </Button>
              </Link>
            </CardFooter>
          </>
        )}

        {/* Failed or Cancelled State */}
        {!isLoading && !error && (paymentStatus === "failed" || paymentStatus === "cancelled") && (
          <>
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-2">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-red-700 dark:text-red-400">
                Payment {paymentStatus === "cancelled" ? "Cancelled" : "Failed"}
              </CardTitle>
              <CardDescription>
                {paymentStatus === "cancelled"
                  ? "You cancelled the payment on Chapa checkout."
                  : "The transaction was declined by the payment provider."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="bg-muted p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-mono">{txRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="capitalize font-bold text-red-600">{paymentStatus}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Your account was not charged. You can retry with the same or another payment method.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 pt-2">
              <Link href="/client" className="w-full">
                <Button className="w-full bg-coral-600 hover:bg-coral-700 text-white">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry Checkout
                </Button>
              </Link>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  )
}

export default function CheckoutResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-coral-600 animate-spin" />
        </div>
      }
    >
      <CheckoutResultContent />
    </Suspense>
  )
}
