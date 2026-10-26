"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Smartphone,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Loader2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  ArrowLeft,
  Clock,
} from "lucide-react"
import type { Phone, PaymentMethod } from "@/lib/types"
import { BrandTitle } from "@/components/brand-title"
import { createClient } from "@/lib/supabase/client"
import { parsePrice } from "@/lib/utils"

interface CheckoutModalProps {
  phone: Phone
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (orderId: string) => void
}

type CheckoutStep = "method" | "chapa_details" | "chapa_processing" | "manual_pay" | "success" | "failed" | "pending"

export function CheckoutModal({ phone, open, onOpenChange, onSuccess }: CheckoutModalProps) {
  const [step, setStep] = useState<CheckoutStep>("method")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)

  // Customer form fields
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")

  // Transaction state
  const [transactionRef, setTransactionRef] = useState("")
  const [manualTxRef, setManualTxRef] = useState("")
  const [orderId, setOrderId] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Prepopulate customer details from authenticated user
  useEffect(() => {
    if (open) {
      setStep("method")
      setErrorMessage(null)
      const fetchUser = async () => {
        try {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user) {
            setCustomerEmail(user.email || "")
            const metaName = user.user_metadata?.full_name || user.user_metadata?.name || ""
            if (metaName) setCustomerName(metaName)
            const metaPhone = user.user_metadata?.phone || ""
            if (metaPhone) setCustomerPhone(metaPhone)
          }
        } catch {
          // Ignore
        }
      }
      fetchUser()
    }
  }, [open])

  const numericPrice = parsePrice(phone.price)

  const handleMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method)
    setErrorMessage(null)
    if (method === "chapa") {
      setStep("chapa_details")
    } else {
      setStep("manual_pay")
    }
  }

  // Chapa Initialization
  const handleInitiateChapa = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      if (!customerName.trim()) {
        throw new Error("Please enter your full name")
      }
      if (!customerEmail.trim() || !customerEmail.includes("@")) {
        throw new Error("Please enter a valid email address")
      }
      if (!customerPhone.trim() || customerPhone.length < 9) {
        throw new Error("Please enter a valid phone number (e.g. 0911223344)")
      }

      const response = await fetch("/api/payments/chapa/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneId: phone.id,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize Chapa payment session")
      }

      setTransactionRef(data.txRef)
      setOrderId(data.orderId)
      setCheckoutUrl(data.checkoutUrl)
      setStep("chapa_processing")

      // Redirect user to Chapa hosted payment page
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to initiate payment")
    } finally {
      setIsLoading(false)
    }
  }

  // Poll / Check verification status from modal if needed
  const handleCheckChapaStatus = async () => {
    if (!transactionRef) return
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/payments/chapa/verify?tx_ref=${encodeURIComponent(transactionRef)}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setStep("success")
        if (data.order?.id) {
          onSuccess(data.order.id)
        }
      } else if (data.order?.payment_status === "pending") {
        setStep("pending")
      } else {
        setStep("failed")
        setErrorMessage(data.message || data.error || "Payment verification incomplete.")
      }
    } catch {
      setErrorMessage("Could not reach verification server. Please retry.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle manual transfer submission
  const handleSubmitManualRef = () => {
    if (manualTxRef.length > 5) {
      setStep("success")
      onSuccess("ORD-" + Math.random().toString(36).substring(2, 9).toUpperCase())
    } else {
      setErrorMessage("Please enter a valid transaction reference.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step !== "method" && step !== "chapa_processing" && step !== "success" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2 text-muted-foreground"
                onClick={() => setStep("method")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle className="text-xl">
                {step === "method" && "Select Payment Method"}
                {step === "chapa_details" && "Checkout with Chapa"}
                {step === "chapa_processing" && "Redirecting to Chapa..."}
                {step === "manual_pay" && `Pay with ${paymentMethod?.toUpperCase()}`}
                {step === "success" && "Payment Confirmed! 🎉"}
                {step === "pending" && "Payment Pending"}
                {step === "failed" && "Payment Failed"}
              </DialogTitle>
              <DialogDescription>
                {step === "method" && "Choose how you want to pay for your device."}
                {step === "chapa_details" && "Verify order details and enter your contact information."}
                {step === "chapa_processing" && "Opening Chapa secure gateway..."}
                {step === "manual_pay" && "Follow the bank transfer instructions below."}
                {step === "success" && "Your transaction has been verified successfully."}
                {step === "pending" && "Your payment is currently being processed by the provider."}
                {step === "failed" && "The payment was not completed or was cancelled."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* STEP 1: Method Selection */}
        {step === "method" && (
          <div className="grid gap-3 py-2">
            {/* Chapa Primary Option */}
            <Button
              variant="outline"
              className="h-auto py-4 px-4 justify-between border-2 border-green-500/30 hover:border-green-600 hover:bg-green-50/50 dark:hover:bg-green-950/30 transition-all text-left group"
              onClick={() => handleMethodSelect("chapa")}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">Chapa Gateway</span>
                    <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">Recommended</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Telebirr, CBE Birr, Awash, Bank Cards
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </Button>

            {/* Telebirr Manual */}
            <Button
              variant="outline"
              className="h-16 justify-between border-coral-200 hover:bg-coral-50 hover:border-coral-500 dark:hover:bg-coral-950/20 transition-all"
              onClick={() => handleMethodSelect("telebirr")}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-coral-100 dark:bg-coral-950 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-5 h-5 text-coral-600" />
                </div>
                <div className="text-left">
                  <div className="font-bold">Telebirr Direct</div>
                  <div className="text-xs text-muted-foreground">Manual Mobile Money Transfer</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Button>

            {/* CBE Manual */}
            <Button
              variant="outline"
              className="h-16 justify-between border-gold-200 hover:bg-gold-50 hover:border-gold-500 dark:hover:bg-gold-950/20 transition-all"
              onClick={() => handleMethodSelect("cbe")}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold-100 dark:bg-gold-950 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-gold-600">CBE</span>
                </div>
                <div className="text-left">
                  <div className="font-bold">CBE Direct Transfer</div>
                  <div className="text-xs text-muted-foreground">Commercial Bank of Ethiopia</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        )}

        {/* STEP 2: Chapa Order Summary & Details */}
        {step === "chapa_details" && (
          <div className="space-y-4 py-2">
            {/* Order Summary */}
            <div className="bg-muted/70 p-4 rounded-xl border space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-foreground">{phone.model}</h4>
                  <p className="text-xs text-muted-foreground">
                    {phone.brand} • {phone.storage} • {phone.ram} RAM
                  </p>
                </div>
                <Badge variant="outline" className="font-medium text-xs">
                  Qty: 1
                </Badge>
              </div>

              <div className="border-t pt-2 flex justify-between items-baseline">
                <span className="text-sm font-medium text-muted-foreground">Total Price:</span>
                <span className="text-2xl font-extrabold text-coral-600">
                  {numericPrice.toLocaleString()} ETB
                </span>
              </div>
            </div>

            {/* Customer Contact Details */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-name">Full Name / ሙሉ ስም</Label>
                <Input
                  id="cust-name"
                  placeholder="e.g. Abebe Bikila"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cust-phone">Phone Number</Label>
                  <Input
                    id="cust-phone"
                    placeholder="0911223344"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cust-email">Email Address</Label>
                  <Input
                    id="cust-email"
                    type="email"
                    placeholder="name@email.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg flex items-center gap-2 text-xs text-green-800 dark:text-green-300">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-green-600" />
              <span>Payments are processed securely via Chapa's PCI-DSS compliant infrastructure.</span>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-bold h-12 text-base shadow-md"
              onClick={handleInitiateChapa}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Initiating Checkout...
                </>
              ) : (
                <>Pay with Chapa ({numericPrice.toLocaleString()} ETB)</>
              )}
            </Button>
          </div>
        )}

        {/* STEP 3: Chapa Processing / Redirecting */}
        {step === "chapa_processing" && (
          <div className="py-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center animate-pulse">
              <CreditCard className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Connecting to Chapa Checkout</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Please complete your payment on Chapa's checkout page. You will be redirected automatically.
              </p>
            </div>

            {checkoutUrl && (
              <div className="space-y-3 w-full">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    window.location.href = checkoutUrl
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Payment Page Directly
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCheckChapaStatus}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  I Have Completed Payment — Verify Now
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Manual Payment Flow (Preserved for compatibility) */}
        {step === "manual_pay" && (
          <div className="space-y-6 py-2">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount to Pay</span>
                <span className="font-bold text-lg">{phone.price} ETB</span>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-semibold mb-2 uppercase text-muted-foreground">Payment Details</p>
                {paymentMethod === "telebirr" ? (
                  <div className="space-y-1">
                    <p className="text-sm">
                      Merchant/Phone: <span className="font-mono font-bold">0911223344</span>
                    </p>
                    <p className="text-sm">
                      Account Name:{" "}
                      <span className="font-bold">
                        <BrandTitle />
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm">
                      Account No: <span className="font-mono font-bold">100012345678</span>
                    </p>
                    <p className="text-sm">
                      Bank: <span className="font-bold">Commercial Bank of Ethiopia</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref">Transaction Reference (TXN ID)</Label>
              <Input
                id="ref"
                placeholder="Enter reference number from confirmation SMS"
                value={manualTxRef}
                onChange={(e) => setManualTxRef(e.target.value)}
              />
            </div>

            <Button className="w-full bg-coral-600 hover:bg-coral-700 text-white" onClick={handleSubmitManualRef}>
              Verify Payment
            </Button>
          </div>
        )}

        {/* STEP 5: Success Screen */}
        {step === "success" && (
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950/60 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground">Payment Verified! 🎉</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your order for <span className="font-semibold text-foreground">{phone.model}</span> has been confirmed.
              </p>
            </div>

            {transactionRef && (
              <div className="bg-muted p-3 rounded-lg w-full text-left space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction Reference:</span>
                  <span className="font-mono font-bold text-foreground">{transactionRef}</span>
                </div>
                {orderId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID:</span>
                    <span className="font-mono text-foreground">{orderId.slice(0, 8)}...</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="font-bold text-green-600">{numericPrice.toLocaleString()} ETB</span>
                </div>
              </div>
            )}

            <div className="w-full p-3 bg-coral-50 dark:bg-coral-950/30 border border-coral-200 dark:border-coral-900 rounded-lg">
              <p className="text-xs text-coral-800 dark:text-coral-300 uppercase font-bold mb-1">
                Store Pick-Up Contact
              </p>
              <div className="flex items-center justify-between">
                <span className="text-base font-mono font-bold">+251 93 369 4796</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText("+251933694796")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Button
              className="w-full bg-coral-600 hover:bg-coral-700 text-white"
              onClick={() => onOpenChange(false)}
            >
              Done / ጨርስ
            </Button>
          </div>
        )}

        {/* STEP 6: Pending Screen */}
        {step === "pending" && (
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Payment Pending</h3>
              <p className="text-sm text-muted-foreground mt-1">
                We are waiting for payment confirmation from your provider or Chapa network.
              </p>
            </div>

            <div className="space-y-2 w-full pt-2">
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleCheckChapaStatus}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Check Status Again
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep("method")}>
                Choose Another Payment Method
              </Button>
            </div>
          </div>
        )}

        {/* STEP 7: Failed / Cancelled Screen */}
        {step === "failed" && (
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Payment Incomplete</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The payment attempt was not completed or was cancelled. Your card/account was not charged.
              </p>
            </div>

            <div className="space-y-2 w-full pt-2">
              <Button
                className="w-full bg-coral-600 hover:bg-coral-700 text-white"
                onClick={() => setStep("chapa_details")}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retry Payment
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep("method")}>
                Choose Another Payment Method
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
