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
  Truck,
  MapPin,
  Phone,
  Mail,
  Copy,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  History,
  AlertTriangle,
  ArrowRight,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import type { Order, OrderStatus } from "@/lib/types"

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  placed: { label: "Order Placed", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200" },
  payment_confirmed: { label: "Payment Confirmed", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200" },
  confirmed: { label: "Order Confirmed", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200" },
  processing: { label: "Processing & Inspection", color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-200" },
  ready_for_dispatch: { label: "Ready for Dispatch", color: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200" },
  ready_for_pickup: { label: "Ready for In-Store Pickup", color: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-200" },
  shipped: { label: "Shipped & In Transit", color: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200" },
  out_for_delivery: { label: "Out for Delivery", color: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200" },
  delivered: { label: "Delivered & Received", color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200" },
  picked_up: { label: "Picked Up & Received", color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200" },
  cancelled: { label: "Cancelled", color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200" },
  refunded: { label: "Refunded", color: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200" },
}

export function AdminOrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "paid" | "processing" | "shipped" | "delivered">("all")
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  // Tracking modal / form state
  const [activeActionOrder, setActiveActionOrder] = useState<Order | null>(null)
  const [targetStatus, setTargetStatus] = useState<OrderStatus | null>(null)
  const [actionNotes, setActionNotes] = useState("")
  const [carrierInput, setCarrierInput] = useState("Micky Express Rider")
  const [trackingNumberInput, setTrackingNumberInput] = useState("")
  const [estimatedDeliveryInput, setEstimatedDeliveryInput] = useState("Today within 2-4 hours")

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
      toast.error("Failed to load orders")
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
        toast.success(data.message || "Payment verified successfully with Chapa!")
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

  const handleStatusTransition = async (
    order: Order,
    newStatus: OrderStatus,
    customPayload?: {
      carrier?: string
      trackingNumber?: string
      estimatedDelivery?: string
      notes?: string
    }
  ) => {
    setUpdatingId(order.id)
    try {
      const payload: Record<string, any> = {
        order_status: newStatus,
        notes: customPayload?.notes || `Advanced to ${ORDER_STATUS_LABELS[newStatus]?.label || newStatus}`,
      }

      if (customPayload?.carrier) payload.shipping_carrier = customPayload.carrier
      if (customPayload?.trackingNumber) payload.tracking_number = customPayload.trackingNumber
      if (customPayload?.estimatedDelivery) payload.estimated_delivery = customPayload.estimatedDelivery

      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (response.ok && result.success) {
        toast.success(result.message || `Order updated to ${ORDER_STATUS_LABELS[newStatus]?.label}`)
        fetchOrders()
        setActiveActionOrder(null)
      } else {
        toast.error(result.error || "Failed to update order status")
      }
    } catch {
      toast.error("Failed to communicate with server")
    } finally {
      setUpdatingId(null)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      (order.transaction_ref?.toLowerCase() || "").includes(term) ||
      (order.customer_name?.toLowerCase() || "").includes(term) ||
      (order.customer_phone?.toLowerCase() || "").includes(term) ||
      (order.customer_email?.toLowerCase() || "").includes(term) ||
      (order.phone?.model.toLowerCase() || "").includes(term) ||
      (order.order_status?.toLowerCase() || "").includes(term)

    if (!matchesSearch) return false

    const status = order.order_status || (order.payment_status === "completed" ? "payment_confirmed" : "placed")
    const isPaid = order.payment_status === "completed" || order.payment_status === "successful"

    switch (activeTab) {
      case "pending":
        return !isPaid && status === "placed"
      case "paid":
        return isPaid && (status === "payment_confirmed" || status === "confirmed")
      case "processing":
        return status === "processing" || status === "ready_for_dispatch" || status === "ready_for_pickup"
      case "shipped":
        return status === "shipped" || status === "out_for_delivery"
      case "delivered":
        return status === "delivered" || status === "picked_up"
      default:
        return true
    }
  })

  return (
    <Card className="border-coral-100 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-coral-600" />
              AliExpress Post-Payment Order Workflow
            </CardTitle>
            <CardDescription>
              Fulfill customer orders, allocate device IMEIs, dispatch deliveries, and track timeline milestones
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

        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 border-b">
          {[
            { id: "all", label: "All Orders", count: orders.length },
            { id: "pending", label: "To Pay (Pending)", count: orders.filter((o) => o.payment_status === "pending").length },
            { id: "paid", label: "Paid / To Confirm", count: orders.filter((o) => (o.order_status === "payment_confirmed" || o.order_status === "confirmed") && (o.payment_status === "completed" || o.payment_status === "successful")).length },
            { id: "processing", label: "In Prep / Ready", count: orders.filter((o) => o.order_status === "processing" || o.order_status === "ready_for_dispatch").length },
            { id: "shipped", label: "Out for Delivery", count: orders.filter((o) => o.order_status === "shipped").length },
            { id: "delivered", label: "Delivered", count: orders.filter((o) => o.order_status === "delivered").length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-coral-600 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-background text-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <RotateCcw className="w-6 h-6 animate-spin text-coral-600" />
            <span>Loading orders and live status timeline...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {searchTerm ? "No orders match your search." : "No orders recorded in this tab."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const isPaid = order.payment_status === "completed" || order.payment_status === "successful"
              const isPending = order.payment_status === "pending"
              const currentStatus = order.order_status || (isPaid ? "payment_confirmed" : "placed")
              const statusMeta = ORDER_STATUS_LABELS[currentStatus] || { label: currentStatus, color: "bg-gray-100" }
              const isExpanded = expandedOrderId === order.id
              const isActioning = updatingId === order.id

              // Determine items
              const items = order.items && order.items.length > 0
                ? order.items
                : order.phone
                  ? [{ phone_id: order.phone_id, model: order.phone.model, brand: order.phone.brand, quantity: 1, price: order.amount, image: order.phone.image }]
                  : []

              return (
                <div
                  key={order.id}
                  className="border rounded-xl bg-card hover:border-coral-200 transition-all shadow-sm overflow-hidden"
                >
                  {/* Top Bar: Order & Customer Summary */}
                  <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-muted/10">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-coral-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-coral-100">
                        <Smartphone className="w-6 h-6 text-coral-600" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-base text-foreground">
                            {order.phone?.model || items[0]?.model || "Mobile Device"}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {order.phone?.brand || items[0]?.brand || "Phone"}
                          </Badge>
                          <Badge className={`text-xs border ${statusMeta.color}`}>
                            {statusMeta.label}
                          </Badge>
                        </div>

                        {/* Customer contact details */}
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1">
                            Customer: <strong className="text-foreground">{order.customer_name || "N/A"}</strong>
                          </span>
                          {order.customer_phone && (
                            <span className="flex items-center gap-1 text-foreground font-mono">
                              <Phone className="w-3 h-3 text-coral-600" /> {order.customer_phone}
                            </span>
                          )}
                          {order.customer_email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="w-3 h-3" /> {order.customer_email}
                            </span>
                          )}
                        </div>

                        {/* Order ID & Reference */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground mt-1">
                          <span>Ref: <strong>{order.transaction_ref || order.id.slice(0, 8)}</strong></span>
                          {order.transaction_ref && (
                            <button
                              onClick={() => copyToClipboard(order.transaction_ref!, "Reference")}
                              className="hover:text-foreground text-coral-600"
                              title="Copy Reference"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                          <span>• {new Date(order.created_at).toLocaleString()}</span>
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[11px]">
                            <MapPin className="w-3 h-3 text-coral-600" />
                            {order.pickup_method === "delivery"
                              ? `Delivery: ${order.delivery_address || "Addis Ababa"}`
                              : "Store Pickup: Bole Alemnesh Plaza Ground Floor"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Amount & Quick Status */}
                    <div className="flex items-center justify-between w-full md:w-auto gap-4">
                      <div className="text-left md:text-right">
                        <p className="text-xl font-extrabold text-coral-600">
                          {Number(order.amount).toLocaleString()} ETB
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 md:justify-end">
                          {isPaid ? (
                            <Badge className="bg-emerald-600 text-white gap-1 text-xs">
                              <ShieldCheck className="w-3 h-3" /> Paid (Chapa Verified)
                            </Badge>
                          ) : isPending ? (
                            <Badge className="bg-amber-500 text-white gap-1 text-xs">
                              <Clock className="w-3 h-3" /> Payment Pending
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 text-xs">
                              <XCircle className="w-3 h-3" /> {order.payment_status}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {order.transaction_ref && !isPaid && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={verifyingRef === order.transaction_ref}
                            onClick={() => handleReverify(order.transaction_ref!)}
                            className="text-xs h-8"
                          >
                            {verifyingRef === order.transaction_ref ? "Verifying..." : "Re-Verify"}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="h-8 px-2"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* AliExpress Workflow Action Bar */}
                  <div className="px-4 py-3 bg-muted/30 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-muted-foreground">Advance Stage:</span>

                      {/* 1. Payment Confirmed -> Confirm Order */}
                      {currentStatus === "payment_confirmed" && (
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleStatusTransition(order, "confirmed")}
                          className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs"
                        >
                          Confirm Order
                        </Button>
                      )}

                      {/* 2. Confirmed -> Start Processing */}
                      {currentStatus === "confirmed" && (
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => {
                            setActiveActionOrder(order)
                            setTargetStatus("processing")
                            setActionNotes("Device inspected and IMEI allocated from warehouse inventory")
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs"
                        >
                          Start Processing / Assign IMEI
                        </Button>
                      )}

                      {/* 3. Processing -> Ready for Dispatch or Pickup */}
                      {currentStatus === "processing" && (
                        order.pickup_method === "pickup" ? (
                          <Button
                            size="sm"
                            disabled={isActioning}
                            onClick={() => handleStatusTransition(order, "ready_for_pickup", { notes: "Device packed and staged at Bole Alemnesh Ground Floor pickup counter" })}
                            className="bg-teal-600 hover:bg-teal-700 text-white h-7 text-xs"
                          >
                            Mark Ready for Pickup
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={isActioning}
                            onClick={() => handleStatusTransition(order, "ready_for_dispatch", { notes: "Device packed and staged for courier dispatch" })}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white h-7 text-xs"
                          >
                            Mark Ready for Dispatch
                          </Button>
                        )
                      )}

                      {/* 4. Ready for Pickup -> Picked Up */}
                      {currentStatus === "ready_for_pickup" && (
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleStatusTransition(order, "picked_up", { notes: "Customer verified and collected device in person at Bole Alemnesh Plaza" })}
                          className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Confirm In-Store Pickup
                        </Button>
                      )}

                      {/* 4. Ready for Dispatch -> Shipped */}
                      {currentStatus === "ready_for_dispatch" && (
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => {
                            setActiveActionOrder(order)
                            setTargetStatus("shipped")
                            setCarrierInput("Micky Express Courier Rider")
                            setTrackingNumberInput(`DISP-${Math.floor(100000 + Math.random() * 900000)}`)
                            setActionNotes("Handed to courier rider for delivery")
                          }}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white h-7 text-xs"
                        >
                          <Truck className="w-3.5 h-3.5 mr-1" />
                          Hand to Courier / Ship
                        </Button>
                      )}

                      {/* 5. Shipped -> Out for Delivery */}
                      {currentStatus === "shipped" && (
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleStatusTransition(order, "out_for_delivery", { notes: "Rider is en route to customer delivery location" })}
                          className="bg-sky-600 hover:bg-sky-700 text-white h-7 text-xs"
                        >
                          <Truck className="w-3.5 h-3.5 mr-1" />
                          Mark Out for Delivery
                        </Button>
                      )}

                      {/* 6. Out for Delivery or Shipped -> Delivered */}
                      {(currentStatus === "out_for_delivery" || currentStatus === "shipped") && (
                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleStatusTransition(order, "delivered", { notes: "Customer verified and received device in good condition" })}
                          className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Mark Delivered
                        </Button>
                      )}

                      {/* Completed badges */}
                      {(currentStatus === "delivered" || currentStatus === "picked_up") && (
                        <span className="text-green-700 font-bold flex items-center gap-1 text-xs">
                          <CheckCircle2 className="w-4 h-4" /> {currentStatus === "picked_up" ? "Order Picked Up" : "Order Delivered"}
                        </span>
                      )}

                      {/* Cancel / Refund */}
                      {currentStatus !== "delivered" && currentStatus !== "cancelled" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isActioning}
                          onClick={() => {
                            if (confirm(`Are you sure you want to cancel order ${order.transaction_ref || order.id}?`)) {
                              handleStatusTransition(order, "cancelled", { notes: "Order cancelled by store operator" })
                            }
                          }}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 text-xs"
                        >
                          Cancel Order
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="text-xs text-muted-foreground h-7"
                      >
                        <History className="w-3.5 h-3.5 mr-1 text-coral-600" />
                        {isExpanded ? "Hide Details & Timeline" : "View Details & Timeline"}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Section: Items & Status Timeline History */}
                  {isExpanded && (
                    <div className="p-4 bg-muted/20 border-t space-y-4">
                      {/* Products Breakdown */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Purchased Products ({items.length})
                        </h4>
                        <div className="divide-y rounded-lg border bg-card overflow-hidden">
                          {items.map((it: any, idx: number) => (
                            <div key={idx} className="p-3 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center font-bold text-coral-600">
                                  {it.brand?.[0] || "P"}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{it.brand} {it.model}</p>
                                  <p className="text-muted-foreground text-[11px]">
                                    {it.storage ? `${it.storage} Storage • ` : ""}
                                    Qty: <strong>{it.quantity || 1}</strong>
                                  </p>
                                </div>
                              </div>
                              <div className="text-right font-extrabold text-foreground">
                                {Number(it.price || order.amount).toLocaleString()} ETB
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Delivery and Carrier Information if available */}
                      {(order.shipping_carrier || order.tracking_number || order.estimated_delivery) && (
                        <div className="p-3 bg-cyan-50 dark:bg-slate-900/40 rounded-lg border border-cyan-200 dark:border-slate-800 text-xs">
                          <h4 className="font-bold text-cyan-900 dark:text-cyan-300 flex items-center gap-1.5 mb-1.5">
                            <Truck className="w-4 h-4" /> Dispatch & Courier Tracking
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-cyan-950 dark:text-slate-300">
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Carrier / Rider:</span>
                              <strong>{order.shipping_carrier || "N/A"}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Tracking Number:</span>
                              <strong className="font-mono">{order.tracking_number || "N/A"}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Estimated Arrival:</span>
                              <strong>{order.estimated_delivery || "N/A"}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Visual Status Milestones Timeline */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-coral-600" />
                          Audit Status History ({order.status_history?.length || 1} Milestones)
                        </h4>
                        <div className="border rounded-lg bg-card p-3 space-y-3">
                          {(order.status_history && order.status_history.length > 0
                            ? order.status_history
                            : [
                                {
                                  status: order.order_status || "placed",
                                  title: ORDER_STATUS_LABELS[order.order_status || "placed"]?.label || "Order Placed",
                                  description: "Initial order recorded",
                                  timestamp: order.created_at,
                                },
                              ]
                          ).map((m: any, mIdx: number) => (
                            <div key={mIdx} className="flex items-start gap-3 text-xs">
                              <div className="w-6 h-6 rounded-full bg-coral-100 text-coral-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                                {mIdx + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <strong className="text-foreground">{m.title || m.status}</strong>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    {m.timestamp ? new Date(m.timestamp).toLocaleString() : ""}
                                  </span>
                                </div>
                                {m.description && (
                                  <p className="text-muted-foreground text-[11px] mt-0.5">{m.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Modal / Action Form for Dispatch & Details */}
        {activeActionOrder && targetStatus && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-2xl p-6 border shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-base text-foreground">
                  Advance to: {ORDER_STATUS_LABELS[targetStatus]?.label}
                </h3>
                <button
                  onClick={() => setActiveActionOrder(null)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-muted-foreground">
                Order Reference: <strong>{activeActionOrder.transaction_ref || activeActionOrder.id}</strong>
              </div>

              {targetStatus === "shipped" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Courier / Dispatch Rider</label>
                    <Input
                      value={carrierInput}
                      onChange={(e) => setCarrierInput(e.target.value)}
                      placeholder="e.g. Micky Express Courier Rider"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Tracking / Dispatch Number</label>
                    <Input
                      value={trackingNumberInput}
                      onChange={(e) => setTrackingNumberInput(e.target.value)}
                      placeholder="e.g. DISP-984321"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Estimated Delivery Time</label>
                    <Input
                      value={estimatedDeliveryInput}
                      onChange={(e) => setEstimatedDeliveryInput(e.target.value)}
                      placeholder="e.g. Today before 6:00 PM"
                      className="text-xs"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold">Operational Notes / Device IMEI</label>
                <Input
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g. Device IMEI 354892... checked and boxed"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveActionOrder(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={updatingId === activeActionOrder.id}
                  onClick={() =>
                    handleStatusTransition(activeActionOrder, targetStatus, {
                      carrier: targetStatus === "shipped" ? carrierInput : undefined,
                      trackingNumber: targetStatus === "shipped" ? trackingNumberInput : undefined,
                      estimatedDelivery: targetStatus === "shipped" ? estimatedDeliveryInput : undefined,
                      notes: actionNotes,
                    })
                  }
                  className="bg-coral-600 hover:bg-coral-700 text-white text-xs"
                >
                  Confirm & Update
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
