import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BrandTitle } from "@/components/brand-title"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import { logout } from "@/app/actions/auth-actions"
import {
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  ShieldCheck,
  MapPin,
  PhoneCall,
  Calendar,
  CreditCard,
  RotateCcw,
} from "lucide-react"
import Link from "next/link"

interface OrderPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch user role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const isAdmin = profile?.role === "admin"

  // Query order with joined phone details
  let { data: order, error } = await supabase
    .from("orders")
    .select("*, phone:phones(*)")
    .eq("id", id)
    .maybeSingle()

  if (error || !order) {
    const fallback = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (fallback.data) {
      order = fallback.data
      error = null
      if (order.phone_id) {
        const { data: phoneData } = await supabase
          .from("phones")
          .select("*")
          .eq("id", order.phone_id)
          .maybeSingle()
        if (phoneData) {
          order.phone = phoneData
        }
      }
    }
  }

  if (error || !order) {
    notFound()
  }

  // Authorization check
  if (!isAdmin && order.client_id !== user.id) {
    redirect("/client")
  }

  // Fetch corresponding payment record
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("transaction_ref", order.transaction_ref)
    .maybeSingle()

  const isPaid = order.payment_status === "completed"
  const isPending = order.payment_status === "pending"
  const isFailed = order.payment_status === "failed" || order.payment_status === "cancelled"

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-white to-gold-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-coral-100 dark:border-slate-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/client/orders">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                All Orders
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">
                <BrandTitle />
              </h1>
              <p className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? "Administrator" : "Client"}</p>
            </div>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          {/* Status Banner */}
          <Card className="border-coral-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div
              className={`p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isPaid
                  ? "bg-gradient-to-r from-green-600 to-emerald-700"
                  : isPending
                  ? "bg-gradient-to-r from-amber-500 to-yellow-600"
                  : "bg-gradient-to-r from-red-600 to-rose-700"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  {isPaid ? (
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  ) : isPending ? (
                    <Clock className="w-7 h-7 text-white" />
                  ) : (
                    <XCircle className="w-7 h-7 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold">
                    {isPaid
                      ? "Payment Verified & Confirmed"
                      : isPending
                      ? "Payment Pending Verification"
                      : "Payment Unsuccessful"}
                  </h2>
                  <p className="text-xs text-white/80 mt-0.5">
                    {isPaid
                      ? "Your transaction has been securely processed and authenticated via Chapa."
                      : isPending
                      ? "Awaiting confirmation from your bank or mobile wallet provider."
                      : "The payment attempt failed or was cancelled."}
                  </p>
                </div>
              </div>

              <Badge className="bg-white text-gray-900 font-bold px-3 py-1 text-sm shadow-sm">
                {order.payment_status.toUpperCase()}
              </Badge>
            </div>

            <CardContent className="p-6 space-y-6">
              {/* Product Card */}
              {order.phone && (
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Purchased Device
                  </h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border bg-muted/30">
                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden border flex-shrink-0">
                      {order.phone.image ? (
                        <img
                          src={order.phone.image}
                          alt={order.phone.model}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Smartphone className="w-10 h-10 text-coral-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-bold text-foreground">{order.phone.model}</h4>
                        <Badge variant="outline">{order.phone.brand}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Specs: {order.phone.storage} Storage • {order.phone.ram} RAM • {order.phone.sim} SIM
                        {order.phone.battery ? ` • Battery: ${order.phone.battery}` : ""}
                        {order.phone.network ? ` • ${order.phone.network}` : ""}
                      </p>
                      <p className="text-lg font-bold text-coral-600 mt-2">
                        {Number(order.amount).toLocaleString()} ETB
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment & Transaction Details */}
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Transaction & Verification Info
                </h3>
                <div className="bg-muted/40 rounded-xl border divide-y text-sm">
                  <div className="p-3.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Transaction Reference (tx_ref):</span>
                    <span className="font-mono font-bold text-foreground">
                      {order.transaction_ref || "N/A"}
                    </span>
                  </div>

                  {payment?.provider_tx_id && (
                    <div className="p-3.5 flex justify-between items-center">
                      <span className="text-muted-foreground">Chapa Provider Reference:</span>
                      <span className="font-mono text-foreground">{payment.provider_tx_id}</span>
                    </div>
                  )}

                  <div className="p-3.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Payment Gateway:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-green-600" /> Chapa Payment Gateway
                    </span>
                  </div>

                  <div className="p-3.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Total Verified Amount:</span>
                    <span className="font-extrabold text-base text-coral-600">
                      {Number(order.amount).toLocaleString()} {order.currency || "ETB"}
                    </span>
                  </div>

                  <div className="p-3.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Order Date:</span>
                    <span className="text-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>

                  {order.customer_name && (
                    <div className="p-3.5 flex justify-between items-center">
                      <span className="text-muted-foreground">Customer:</span>
                      <span className="text-foreground font-medium">
                        {order.customer_name} ({order.customer_phone || order.customer_email})
                      </span>
                    </div>
                  )}

                  <div className="p-3.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Fulfillment Status:</span>
                    <Badge variant="outline" className="capitalize">
                      {order.fulfillment_status || "Unfulfilled (Ready for pickup)"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Store Contact & Location Details */}
              <div className="p-4 bg-coral-50/60 dark:bg-coral-950/20 border border-coral-200 dark:border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-coral-800 dark:text-coral-300 font-bold text-sm">
                  <MapPin className="w-4 h-4 text-coral-600" />
                  <span>Store Pickup Location</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alemnesh Plaza Ground Floor, Bole Medhanialem, Addis Ababa, Ethiopia.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <PhoneCall className="w-4 h-4 text-coral-600" />
                  <span className="text-sm font-mono font-bold">+251 93 369 4796</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-6 bg-muted/20 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <Link href="/client/orders">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Orders
                </Button>
              </Link>

              {isPending && order.transaction_ref && (
                <Link href={`/checkout/result?tx_ref=${encodeURIComponent(order.transaction_ref)}`}>
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Verify Status Now
                  </Button>
                </Link>
              )}

              {isFailed && (
                <Link href="/client">
                  <Button className="bg-coral-600 hover:bg-coral-700 text-white">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry Payment
                  </Button>
                </Link>
              )}

              {isPaid && (
                <Link href="/client">
                  <Button className="bg-coral-600 hover:bg-coral-700 text-white">
                    Continue Shopping
                  </Button>
                </Link>
              )}
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  )
}
