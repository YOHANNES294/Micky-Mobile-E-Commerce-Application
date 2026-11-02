import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  sendAliExpressOrderUpdateEmail,
  sendAliExpressProductPicksEmail,
  sendAliExpressNewArrivalsEmail,
} from "@/lib/email/email-service"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      type = "picks_ready",
      to,
      customerName,
      orderId,
      newStatus = "shipped",
      notes,
      carrier,
      trackingNumber,
      phone,
      recommendedPhones,
    } = body

    const targetEmail = to || user.email
    if (!targetEmail) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 })
    }

    const targetName = customerName || user.user_metadata?.full_name || "Ethio.Yoni"

    let result: any

    switch (type) {
      case "picks_ready": {
        result = await sendAliExpressProductPicksEmail({
          customerEmail: targetEmail,
          customerName: targetName,
          recommendedPhones,
        })
        break
      }

      case "new_arrival": {
        const arrivalPhone = phone || {
          brand: "Samsung",
          model: "Galaxy S24 Ultra",
          price: 148000,
          storage: "512GB",
          ram: "12GB",
          badge: "New Flagship",
        }
        result = await sendAliExpressNewArrivalsEmail({
          customerEmail: targetEmail,
          customerName: targetName,
          phone: arrivalPhone,
        })
        break
      }

      case "order_update": {
        let order: any = null
        if (orderId) {
          const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
          const { data: orderData } = await db
            .from("orders")
            .select("*, phone:phones(*)")
            .eq("id", orderId)
            .maybeSingle()
          order = orderData
        }

        if (!order) {
          // Fallback mock order for test email
          order = {
            id: orderId || "mock-order-001",
            client_id: user.id,
            amount: 148000,
            payment_method: "chapa",
            payment_status: "completed",
            transaction_ref: "MCK-" + Date.now().toString(36).toUpperCase(),
            delivery_method: "delivery",
            shipping_carrier: carrier || "Micky Express Bole Courier",
            tracking_number: trackingNumber || "ET-MCK-84920",
            phone: {
              brand: "Samsung",
              model: "Galaxy S24 Ultra Titanium 512GB",
              storage: "512GB",
              ram: "12GB",
            },
          }
        }

        result = await sendAliExpressOrderUpdateEmail({
          order,
          customerEmail: targetEmail,
          customerName: targetName,
          newStatus,
          notes: notes || "Dispatched from Micky Mobile Bole Alemnesh Plaza branch.",
          trackingCarrier: carrier || order.shipping_carrier,
          trackingNumber: trackingNumber || order.tracking_number,
        })
        break
      }

      default:
        return NextResponse.json({ error: `Unsupported email template type: ${type}` }, { status: 400 })
    }

    return NextResponse.json({
      success: result.success,
      status: result.status,
      id: result.id,
      error: result.error,
      template: type,
      recipient: targetEmail,
      message:
        result.status === "sent"
          ? `AliExpress-style notification successfully sent to ${targetEmail}`
          : `Email prepared for ${targetEmail} (status: ${result.status})`,
    })
  } catch (err: any) {
    console.error("[Email API Route Error]:", err)
    return NextResponse.json({ error: err?.message || "Failed to process email dispatch" }, { status: 500 })
  }
}
