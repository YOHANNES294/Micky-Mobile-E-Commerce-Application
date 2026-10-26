"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Smartphone,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  RotateCcw,
  Package,
  CreditCard,
  Copy,
  ExternalLink,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import type { Order } from "@/lib/types"

export function AdminOrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null)

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/orders")
      const data = await response.json()
      if (response.ok && data.orders) {
        setOrders(data.orders)
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleReverify = async (txRef: string) => {
    if (!txRef) return
    setVerifyingRef(txRef)
    try {
      const response = await fetch(`/api/payments/chapa/verify?tx_ref=${encodeURIComponent(txRef)}`)
      const data = await response.json()
      if (response.ok && data.success) {
        toast.success("Payment verified successfully!")
        fetchOrders()
      } else {
        toast.error(data.message || data.error || "Verification failed.")
      }
    } catch {
      toast.error("Could not verify transaction at this time.")
    } finally {
      setVerifyingRef(null)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase()
    return (
      order.transaction_ref?.toLowerCase().includes(term) ||
      order.customer_name?.toLowerCase().includes(term) ||
      order.customer_phone?.toLowerCase().includes(term) ||
      order.phone?.model.toLowerCase().includes(term) ||
      order.payment_status.toLowerCase().includes(term)
    )
  })

  return (
    <Card className="border-coral-100 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold">Customer Orders & Chapa Payments</CardTitle>
            <CardDescription>
              Monitor transactions, verified Chapa payment references, and fulfillment states
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reference, customer, model..."
                className="pl-9 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchOrders} className="h-9">
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {searchTerm ? "No orders match your search." : "No orders recorded in the system yet."}
          </div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {filteredOrders.map((order) => {
              const isPaid = order.payment_status === "completed"
              const isPending = order.payment_status === "pending"

              return (
                <div
                  key={order.id}
                  className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-coral-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border">
                      <Smartphone className="w-6 h-6 text-coral-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">
                          {order.phone?.model || "Phone Device"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {order.phone?.brand || "Device"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                        <span>Customer: <strong className="text-foreground">{order.customer_name || "N/A"}</strong></span>
                        {order.customer_phone && <span>• {order.customer_phone}</span>}
                        {order.customer_email && <span>• {order.customer_email}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mt-1">
                        <span>Ref: {order.transaction_ref || order.id.slice(0, 8)}</span>
                        {order.transaction_ref && (
                          <button
                            onClick={() => copyToClipboard(order.transaction_ref!, "Reference")}
                            className="hover:text-foreground"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                        <span>• {new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto gap-4">
                    <div className="text-left md:text-right">
                      <p className="text-lg font-extrabold text-coral-600">
                        {Number(order.amount).toLocaleString()} ETB
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 md:justify-end">
                        {isPaid ? (
                          <Badge className="bg-green-600 text-white gap-1 text-xs">
                            <ShieldCheck className="w-3 h-3" /> Paid (Verified)
                          </Badge>
                        ) : isPending ? (
                          <Badge className="bg-amber-500 text-white gap-1 text-xs">
                            <Clock className="w-3 h-3" /> Pending
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <XCircle className="w-3 h-3" /> {order.payment_status}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {order.transaction_ref && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={verifyingRef === order.transaction_ref}
                        onClick={() => handleReverify(order.transaction_ref!)}
                        className="text-xs"
                      >
                        {verifyingRef === order.transaction_ref ? "Checking..." : "Re-Verify"}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
