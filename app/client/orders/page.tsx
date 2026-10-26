import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BrandTitle } from "@/components/brand-title"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"
import { logout } from "@/app/actions/auth-actions"
import {
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  LogOut,
  ShoppingBag,
} from "lucide-react"
import Link from "next/link"
import { NotificationCenter } from "@/components/notifications/notification-center"

export default async function ClientOrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch client orders with phones
  let { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*, phone:phones(*)")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })

  if (ordersError) {
    const fallback = await supabase
      .from("orders")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
    orders = fallback.data || []
    const phoneIds = Array.from(new Set((orders || []).map((o: any) => o.phone_id).filter(Boolean)))
    if (phoneIds.length > 0) {
      const { data: phones } = await supabase.from("phones").select("*").in("id", phoneIds)
      const phoneMap = new Map((phones || []).map((p: any) => [p.id, p]))
      orders.forEach((o: any) => {
        o.phone = phoneMap.get(o.phone_id) || null
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-50 via-white to-gold-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-coral-100 dark:border-slate-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/client">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Store
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">
                <BrandTitle />
              </h1>
              <p className="text-xs text-muted-foreground">My Device Orders</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">Client Account</p>
            </div>
            <NotificationCenter />
            <form action={logout}>
              <Button variant="outline" size="sm" className="border-coral-200">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </form>
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Order History</h2>
            <p className="text-muted-foreground text-sm">
              Track your smartphone purchases and verified payments
            </p>
          </div>
          <Link href="/client">
            <Button className="bg-coral-600 hover:bg-coral-700 text-white">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Shop More
            </Button>
          </Link>
        </div>

        {(!orders || orders.length === 0) ? (
          <Card className="p-12 text-center border-dashed">
            <div className="w-16 h-16 bg-coral-100 dark:bg-coral-950 rounded-full flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-coral-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">No Orders Placed Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
              Browse our collection of premium Samsung and iPhone devices and complete your purchase securely with Chapa.
            </p>
            <Link href="/client">
              <Button className="bg-coral-600 hover:bg-coral-700 text-white">
                Browse Phones
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const isPaid = order.payment_status === "completed"
              const isPending = order.payment_status === "pending"
              const isFailed = order.payment_status === "failed" || order.payment_status === "cancelled"

              return (
                <Card
                  key={order.id}
                  className="overflow-hidden border-coral-100 dark:border-slate-800 hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Left: Device Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-coral-50 to-gold-50 dark:from-slate-800 dark:to-slate-900 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border">
                          {order.phone?.image ? (
                            <img
                              src={order.phone.image}
                              alt={order.phone.model}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Smartphone className="w-8 h-8 text-coral-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-lg text-foreground">
                              {order.phone?.model || "Smartphone Device"}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {order.phone?.brand || "Device"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Order Ref: <span className="font-mono">{order.transaction_ref || order.id.slice(0, 8)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Placed on {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Right: Payment Status & Action */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
                        <div className="text-left sm:text-right">
                          <p className="text-xl font-extrabold text-coral-600">
                            {Number(order.amount).toLocaleString()} ETB
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 sm:justify-end">
                            {isPaid && (
                              <Badge className="bg-green-600 text-white gap-1 text-xs">
                                <CheckCircle2 className="w-3 h-3" /> Paid (Chapa)
                              </Badge>
                            )}
                            {isPending && (
                              <Badge className="bg-amber-500 text-white gap-1 text-xs">
                                <Clock className="w-3 h-3" /> Pending
                              </Badge>
                            )}
                            {isFailed && (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <XCircle className="w-3 h-3" /> {order.payment_status}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Link href={`/client/orders/${order.id}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            Details
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
