import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    const isAdmin = profile?.role === "admin"

    let query = supabase
      .from("orders")
      .select("*, phone:phones(*)")
      .order("created_at", { ascending: false })

    if (!isAdmin) {
      query = query.eq("client_id", user.id)
    }

    let { data: orders, error: ordersError } = await query

    // If join syntax errored, fallback to standard select and manual phone lookup
    if (ordersError) {
      let fallbackQuery = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })

      if (!isAdmin) {
        fallbackQuery = fallbackQuery.eq("client_id", user.id)
      }

      const fallbackRes = await fallbackQuery
      if (fallbackRes.data) {
        orders = fallbackRes.data
        ordersError = null

        // Fetch phones for orders
        const phoneIds = Array.from(new Set(orders.map((o: any) => o.phone_id).filter(Boolean)))
        if (phoneIds.length > 0) {
          const { data: phones } = await supabase.from("phones").select("*").in("id", phoneIds)
          const phoneMap = new Map((phones || []).map((p: any) => [p.id, p]))
          orders.forEach((o: any) => {
            o.phone = phoneMap.get(o.phone_id) || null
          })
        }
      }
    }

    if (ordersError) {
      console.error("[Orders API] Error fetching orders:", ordersError)
      return NextResponse.json({ error: "Failed to load orders" }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] }, { status: 200 })
  } catch (error: unknown) {
    console.error("[Orders API] Unexpected error:", error)
    return NextResponse.json({ error: "Failed to retrieve orders" }, { status: 500 })
  }
}
