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

    return NextResponse.json({ order, payments: payments || [] }, { status: 200 })
  } catch (error: unknown) {
    console.error("[Order Detail API] Error:", error)
    return NextResponse.json({ error: "Failed to retrieve order details" }, { status: 500 })
  }
}
