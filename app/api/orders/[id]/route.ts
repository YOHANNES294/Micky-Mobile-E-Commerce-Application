import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    const isAdmin = profile?.role === "admin"

    let { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, phone:phones(*)")
      .eq("id", id)
      .maybeSingle()

    if (orderError || !order) {
      const fallback = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle()

      if (fallback.data) {
        order = fallback.data
        orderError = null

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

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Authorization: User must own the order or be an admin
    if (!isAdmin && order.client_id !== user.id) {
      return NextResponse.json({ error: "Forbidden: You cannot access this order" }, { status: 403 })
    }

    // Also fetch associated payment record if available
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false })

    // Also fetch audit history
    const { data: history } = await supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true })

    return NextResponse.json({
      order,
      payments: payments || [],
      history: history || order.status_history || [],
      support_contact: {
        store_name: "Micky Mobile Ethiopia",
        address: "Bole Alemnesh Plaza Ground Floor, Addis Ababa",
        phone: "+251 93 369 4796",
      },
    }, { status: 200 })
  } catch (error: unknown) {
    console.error("[Order Detail API] Error:", error)
    return NextResponse.json({ error: "Failed to retrieve order details" }, { status: 500 })
  }
}

const VALID_STATUSES = [
  "placed",
  "payment_confirmed",
  "confirmed",
  "processing",
  "ready_for_dispatch",
  "ready_for_pickup",
  "shipped",
  "out_for_delivery",
  "delivered",
  "picked_up",
  "cancelled",
  "refunded",
] as const

const STATUS_TITLES: Record<string, string> = {
  placed: "Order Placed",
  payment_confirmed: "Payment Confirmed",
  confirmed: "Order Confirmed",
  processing: "Processing & Quality Inspection",
  ready_for_dispatch: "Ready for Dispatch",
  ready_for_pickup: "Ready for In-Store Pickup",
  shipped: "Shipped / In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered & Received",
  picked_up: "Picked Up & Received",
  cancelled: "Order Cancelled",
  refunded: "Payment Refunded",
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "Order ID is required" }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admin role verification
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required to update order workflow" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      order_status,
      shipping_carrier,
      tracking_number,
      estimated_delivery,
      delivery_notes,
      notes,
    } = body

    if (!order_status || !VALID_STATUSES.includes(order_status)) {
      return NextResponse.json(
        { error: `Invalid order_status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      )
    }

    // Fetch existing order to check current status and payment integrity
    const { data: currentOrder, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchErr || !currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Critical Security Requirement:
    // "Never let an admin manually mark an unverified Chapa payment as paid without a properly authorized reconciliation process."
    const isPaid = currentOrder.payment_status === "completed" || currentOrder.payment_status === "successful"
    const requiresVerifiedPayment = [
      "confirmed",
      "processing",
      "ready_for_dispatch",
      "ready_for_pickup",
      "shipped",
      "out_for_delivery",
      "delivered",
      "picked_up",
    ].includes(order_status)

    if (requiresVerifiedPayment && !isPaid) {
      return NextResponse.json(
        {
          error:
            "Security Policy: This order's payment has not been verified by Chapa. Please use 'Re-Verify' to verify official transaction settlement before updating fulfillment status.",
        },
        { status: 400 }
      )
    }

    // Build timeline event
    const milestoneTitle = STATUS_TITLES[order_status] || order_status
    const milestone = {
      status: order_status,
      title: milestoneTitle,
      description: notes || `Order advanced to ${milestoneTitle}`,
      timestamp: new Date().toISOString(),
      updated_by: user.id,
    }

    const currentHistory = Array.isArray(currentOrder.status_history)
      ? currentOrder.status_history
      : []

    const updatedHistory = [...currentHistory, milestone]

    // Construct update payload
    const updatePayload: Record<string, any> = {
      order_status,
      status_history: updatedHistory,
      updated_at: new Date().toISOString(),
    }

    if (shipping_carrier !== undefined) updatePayload.shipping_carrier = shipping_carrier
    if (tracking_number !== undefined) updatePayload.tracking_number = tracking_number
    if (estimated_delivery !== undefined) updatePayload.estimated_delivery = estimated_delivery
    if (delivery_notes !== undefined) updatePayload.delivery_notes = delivery_notes

    // Also sync legacy fulfillment_status for backward compatibility
    if (order_status === "delivered" || order_status === "picked_up") {
      updatePayload.fulfillment_status = "fulfilled"
    } else if (
      order_status === "processing" ||
      order_status === "ready_for_dispatch" ||
      order_status === "ready_for_pickup" ||
      order_status === "shipped" ||
      order_status === "out_for_delivery"
    ) {
      updatePayload.fulfillment_status = "processing"
    } else if (order_status === "cancelled") {
      updatePayload.fulfillment_status = "cancelled"
    }

    // Update order
    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select("*, phone:phones(*)")
      .single()

    if (updateErr) {
      console.error("[Orders API PATCH] Update error:", updateErr)
      return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
    }

    // Audit in order_status_history table
    try {
      await supabase.from("order_status_history").insert({
        order_id: id,
        status: order_status,
        title: milestoneTitle,
        notes: notes || null,
        updated_by: user.id,
      })
    } catch (auditErr) {
      console.warn("[Orders API PATCH] Audit log warning:", auditErr)
    }

    // Dispatch real-time in-app notification to customer
    try {
      const { createAndDispatchNotification } = await import("@/lib/notifications/notification-service")
      const refCode = currentOrder.transaction_ref?.slice(0, 8) || id.slice(0, 8)
      await createAndDispatchNotification({
        userId: currentOrder.client_id,
        title: `Order Update #${refCode}: ${milestoneTitle}`,
        message: notes
          ? `Your order status is now ${milestoneTitle}. Note: ${notes}`
          : `Your order has moved to ${milestoneTitle}. Open My Orders to track the live progress.`,
        category: "orders",
        targetType: "order",
        targetId: id,
      })
    } catch (notifErr) {
      console.warn("[Orders API PATCH] Notification dispatch error:", notifErr)
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order updated to ${milestoneTitle}`,
    }, { status: 200 })
  } catch (error: unknown) {
    console.error("[Orders API PATCH] Unexpected error:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}
