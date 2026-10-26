import { NextResponse, type NextRequest } from "next/server"
import { chapa } from "@/lib/chapa/client"
import { verifyAndReconcilePayment } from "@/lib/chapa/payment-service"
import type { ChapaWebhookPayload } from "@/lib/chapa/types"

export async function POST(request: NextRequest) {
  try {
    // 1. Extract signature from headers
    const signature =
      request.headers.get("chapa-signature") ||
      request.headers.get("x-chapa-signature")

    const rawBody = await request.text()

    // 2. Validate webhook signature using constant-time comparison
    const isValid = chapa.verifyWebhookSignature(signature, rawBody)
    if (!isValid) {
      console.warn("[Chapa Webhook] Rejected unauthorized webhook call: Invalid signature header.")
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      )
    }

    // 3. Parse payload safely
    let payload: ChapaWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 })
    }

    const txRef = payload.tx_ref
    if (!txRef) {
      console.warn("[Chapa Webhook] Received webhook payload missing tx_ref:", payload)
      return NextResponse.json({ error: "Missing tx_ref in webhook body" }, { status: 400 })
    }

    console.log(`[Chapa Webhook] Received validated event for reference ${txRef}. Starting server-to-server reconciliation...`)

    // 4. Perform authoritative server-to-server verification before marking paid/fulfilled
    try {
      await verifyAndReconcilePayment(txRef)
    } catch (reconcileError) {
      console.error(`[Chapa Webhook] Error during reconciliation for ${txRef}:`, reconcileError)
      // Even if reconciliation encountered an issue, respond with 200 or 500 depending on transient state
    }

    // 5. Always acknowledge Chapa webhook receipt
    return NextResponse.json({ status: "success", received: true }, { status: 200 })
  } catch (error: unknown) {
    console.error("[Chapa Webhook Route Exception]:", error)
    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    )
  }
}
