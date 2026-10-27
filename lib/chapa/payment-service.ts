import crypto from "crypto"
import { chapa, ChapaError } from "./client"
import type { ChapaInitializeRequest, ChapaVerifyData } from "./types"
import type { Order, Payment } from "@/lib/types"
import { parsePrice } from "@/lib/utils"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { createAndDispatchNotification } from "@/lib/notifications/notification-service"
import { sendOrderConfirmationEmail, sendPaymentVerifiedEmail } from "@/lib/email/email-service"

export interface InitializePaymentParams {
  userId: string
  phoneId?: string
  items?: Array<{
    phoneId: string
    quantity: number
    model?: string
    brand?: string
    storage?: string
    price?: number
    image?: string
  }>
  customerName: string
  customerPhone: string
  customerEmail: string
  pickupMethod?: "pickup" | "delivery"
  deliveryAddress?: string
  deliveryNotes?: string
  originUrl?: string
}

export interface InitializePaymentResult {
  success: boolean
  checkoutUrl: string
  txRef: string
  orderId: string
  amount: number
  currency: string
}

export interface VerifyPaymentResult {
  success: boolean
  alreadyVerified?: boolean
  payment: Payment
  order: Order
  message: string
}

import { generateTxRef } from "./utils"
export { generateTxRef }

/**
 * Gets a Supabase client suitable for backend operations.
 * Prefers the service role client if available to ensure reliable system updates (e.g. webhooks),
 * otherwise falls back to the standard server client.
 */
async function getSystemDbClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      return createAdminClient()
    } catch {
      // Fallback to server client
    }
  }
  return await createClient()
}

/**
 * Initializes a payment flow for an order
 */
export async function initializeOrderPayment(
  params: InitializePaymentParams
): Promise<InitializePaymentResult> {
  const { userId, phoneId, items, customerName, customerPhone, customerEmail, pickupMethod, deliveryAddress, deliveryNotes, originUrl } = params

  if (!customerEmail || !customerEmail.includes("@")) {
    throw new ChapaError("A valid customer email is required", 400)
  }
  if (!customerName || customerName.trim().length === 0) {
    throw new ChapaError("Customer name is required", 400)
  }

  const db = await getSystemDbClient()

  let effectivePhoneId = phoneId || (items && items.length > 0 ? items[0].phoneId : undefined)
  let orderItems: Array<any> = []
  let totalAmount = 0
  let primaryPhone: any = null

  if (items && items.length > 0) {
    // 1. Authoritative price lookup for each item in the cart from DB
    const phoneIds = Array.from(new Set(items.map((it) => it.phoneId)))
    const { data: dbPhones, error: phonesError } = await db
      .from("phones")
      .select("*")
      .in("id", phoneIds)

    if (phonesError || !dbPhones || dbPhones.length === 0) {
      throw new ChapaError("Products in cart could not be verified in inventory", 404)
    }

    const phoneMap = new Map(dbPhones.map((p: any) => [p.id, p]))

    for (const it of items) {
      const dbPhone = phoneMap.get(it.phoneId)
      if (!dbPhone) {
        throw new ChapaError(`Product ID ${it.phoneId} not found in inventory`, 404)
      }
      const itemPrice = parsePrice(dbPhone.price)
      const qty = Math.max(1, it.quantity || 1)
      totalAmount += itemPrice * qty
      orderItems.push({
        phone_id: dbPhone.id,
        model: dbPhone.model,
        brand: dbPhone.brand,
        storage: dbPhone.storage,
        ram: dbPhone.ram,
        quantity: qty,
        price: itemPrice,
        image: dbPhone.image,
      })
    }

    effectivePhoneId = orderItems[0].phone_id
    primaryPhone = phoneMap.get(effectivePhoneId)
  } else if (effectivePhoneId) {
    // Single phone lookup from DB
    const { data: phone, error: phoneError } = await db
      .from("phones")
      .select("*")
      .eq("id", effectivePhoneId)
      .single()

    if (phoneError || !phone) {
      throw new ChapaError("The requested phone was not found in inventory", 404)
    }

    const price = parsePrice(phone.price)
    if (price <= 0) {
      throw new ChapaError("Invalid price for the selected device", 400)
    }

    totalAmount = price
    primaryPhone = phone
    orderItems = [
      {
        phone_id: phone.id,
        model: phone.model,
        brand: phone.brand,
        storage: phone.storage,
        ram: phone.ram,
        quantity: 1,
        price,
        image: phone.image,
      },
    ]
  } else {
    throw new ChapaError("No product or items specified for checkout", 400)
  }

  // 2. Generate unique transaction reference
  const txRef = generateTxRef()

  // 3. Create initial status milestone (Order Placed)
  const initialMilestone = {
    status: "placed",
    title: "Order Placed",
    description: "Order created in Micky Mobile store and awaiting payment",
    timestamp: new Date().toISOString(),
  }

  // 4. Create Order record in database with pending status
  const orderData = {
    client_id: userId,
    phone_id: effectivePhoneId,
    amount: totalAmount,
    currency: "ETB",
    payment_method: "chapa",
    payment_status: "pending",
    order_status: "placed",
    fulfillment_status: "unfulfilled",
    pickup_method: pickupMethod || "pickup",
    delivery_address: deliveryAddress?.trim() || null,
    delivery_notes: deliveryNotes?.trim() || null,
    items: orderItems,
    status_history: [initialMilestone],
    transaction_ref: txRef,
    customer_name: customerName.trim(),
    customer_phone: customerPhone?.trim() || "",
    customer_email: customerEmail.trim(),
  }

  const { data: createdOrder, error: orderError } = await db
    .from("orders")
    .insert(orderData)
    .select()
    .single()

  if (orderError || !createdOrder) {
    console.error("[PaymentService] Error inserting order:", orderError)
    throw new ChapaError("Failed to record order before payment initialization", 500)
  }

  const orderId = createdOrder.id

  // Record initial audit in order_status_history
  try {
    await db.from("order_status_history").insert({
      order_id: orderId,
      status: "placed",
      title: "Order Placed",
      notes: `Order created with reference ${txRef}`,
      updated_by: userId,
    })
  } catch {
    // Non-blocking if table migration is pending
  }

  // 5. Create Payment record in database with pending status
  const paymentData = {
    order_id: orderId,
    customer_id: userId,
    provider: "chapa",
    transaction_ref: txRef,
    amount: totalAmount,
    currency: "ETB",
    status: "pending",
  }

  const { error: paymentError } = await db
    .from("payments")
    .insert(paymentData)

  if (paymentError) {
    console.warn("[PaymentService] Notice: could not record into payments table:", paymentError.message)
  }

  // 5. Build URLs for Chapa
  const appBaseUrl = (
    originUrl ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "")

  // Chapa Global strictly requires callback_url and return_url to start with https://
  const configuredWebhook = process.env.CHAPA_WEBHOOK_URL
  const callbackUrl = configuredWebhook && configuredWebhook.startsWith("https://")
    ? configuredWebhook
    : appBaseUrl.startsWith("https://")
      ? `${appBaseUrl}/api/payments/chapa/webhook`
      : undefined

  // Chapa Global strictly enforces a 100-character limit on return_url in their database
  const configuredReturn = process.env.CHAPA_RETURN_URL
  const cleanHost = appBaseUrl.replace(/^https?:\/\//, "")
  const baseReturn = configuredReturn && configuredReturn.startsWith("https://")
    ? configuredReturn
    : appBaseUrl.startsWith("https://")
      ? `${appBaseUrl}/checkout/result`
      : `https://${cleanHost}/checkout/result`

  const returnUrl = `${baseReturn}?tx_ref=${encodeURIComponent(txRef)}`

  // Split name for Chapa
  const nameParts = customerName.trim().split(" ")
  const firstName = nameParts[0] || "Customer"
  const lastName = nameParts.slice(1).join(" ") || "Customer"

  const phoneDescription = primaryPhone
    ? `Purchase of ${primaryPhone.brand} ${primaryPhone.model}`
    : "Purchase from Micky Mobile Ethiopia"

  const chapaPayload: ChapaInitializeRequest = {
    amount: totalAmount.toString(),
    currency: "ETB",
    email: customerEmail.trim(),
    first_name: firstName,
    last_name: lastName,
    phone_number: customerPhone?.trim() || undefined,
    tx_ref: txRef,
    callback_url: callbackUrl,
    return_url: returnUrl,
    customization: {
      title: "Micky Mobile Ethiopia",
      description: phoneDescription,
    },
    meta: {
      order_id: orderId,
      phone_id: effectivePhoneId,
      customer_id: userId,
    },
  }

  // 6. Call Chapa Initialize API
  const chapaResponse = await chapa.initialize(chapaPayload)

  // Dispatch Order Placed In-App Notification & Confirmation Email
  createAndDispatchNotification({
    userId,
    title: `Order Placed #${txRef.slice(0, 8)}`,
    message: `Your order for ${phoneDescription} (${totalAmount.toLocaleString()} ETB) has been initiated.`,
    category: "orders",
    targetType: "order",
    targetId: orderId,
  }).catch(() => {})

  if (customerEmail) {
    sendOrderConfirmationEmail(
      { ...orderData, id: orderId, phone: primaryPhone } as any,
      customerEmail,
      customerName
    ).catch(() => {})
  }

  return {
    success: true,
    checkoutUrl: chapaResponse.data!.checkout_url,
    txRef,
    orderId,
    amount: totalAmount,
    currency: "ETB",
  }
}

/**
 * Server-side payment verification and order status reconciliation.
 * Idempotent: safe to invoke repeatedly from returns, webhooks, or polling.
 */
export async function verifyAndReconcilePayment(
  txRef: string,
  authContext?: { userId?: string | null; isAdmin?: boolean }
): Promise<VerifyPaymentResult> {
  if (!txRef || txRef.trim() === "") {
    throw new ChapaError("Missing transaction reference", 400)
  }

  const cleanTxRef = txRef.trim()
  const db = await getSystemDbClient()

  // 1. Fetch existing order by transaction_ref
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*")
    .eq("transaction_ref", cleanTxRef)
    .maybeSingle()

  if (orderError) {
    console.error("[PaymentService] Error looking up order:", orderError)
  }

  if (!order) {
    throw new ChapaError(`Order with transaction reference ${cleanTxRef} was not found`, 404)
  }

  // Attach phone details safely
  if (order.phone_id) {
    const { data: phoneData } = await db
      .from("phones")
      .select("*")
      .eq("id", order.phone_id)
      .maybeSingle()
    if (phoneData) {
      order.phone = phoneData
    }
  }

  // 2. Authorization check: If a user is making this request, they must own the order or be an admin
  if (authContext?.userId && !authContext.isAdmin) {
    if (order.client_id !== authContext.userId) {
      throw new ChapaError("Unauthorized: You do not have permission to verify this order", 403)
    }
  }

  // Fetch corresponding payment record if it exists
  const { data: paymentRecord } = await db
    .from("payments")
    .select("*")
    .eq("transaction_ref", cleanTxRef)
    .maybeSingle()

  // 3. Idempotency Check:
  // If payment and order are already marked as completed/successful, return immediately without re-fulfilling
  if (order.payment_status === "completed" && paymentRecord?.status === "successful") {
    return {
      success: true,
      alreadyVerified: true,
      payment: paymentRecord,
      order,
      message: "Payment has already been successfully verified and processed.",
    }
  }

  // 4. Verify transaction with Chapa official API
  const verifyResponse = await chapa.verify(cleanTxRef)
  const verifyData = verifyResponse.data

  if (!verifyData) {
    throw new ChapaError("Chapa did not return transaction verification data", 502)
  }

  const sanitizedVerification = {
    reference: verifyData.reference,
    status: verifyData.status,
    amount: verifyData.amount,
    currency: verifyData.currency,
    method: verifyData.method,
    mode: verifyData.mode,
    charge: verifyData.charge,
    verified_at: new Date().toISOString(),
  }

  // 5. Rigorous Security Checks
  const verifiedStatus = (verifyData.status || "").toLowerCase()
  const verifiedCurrency = (verifyData.currency || "").toUpperCase()
  const verifiedAmount = parseFloat(String(verifyData.amount))
  const expectedAmount = parseFloat(String(order.amount))

  // Validate Currency
  if (verifiedCurrency !== "ETB") {
    console.error(`[Chapa Security] Currency mismatch! Expected ETB, got ${verifiedCurrency} for ${cleanTxRef}`)
    await updateOrderAndPaymentStatus(db, order.id, cleanTxRef, "failed", sanitizedVerification)
    throw new ChapaError("Security alert: Payment currency mismatch", 400)
  }

  // Validate Amount (tolerance of 0.01 for floating precision)
  if (Math.abs(verifiedAmount - expectedAmount) > 0.05) {
    console.error(
      `[Chapa Security] Amount mismatch! Expected ${expectedAmount} ETB, got ${verifiedAmount} ETB for ${cleanTxRef}`
    )
    await updateOrderAndPaymentStatus(db, order.id, cleanTxRef, "failed", sanitizedVerification)
    throw new ChapaError("Security alert: Payment amount does not match order amount", 400)
  }

  // 6. Handle Chapa Provider Status
  const isSuccessful = ["success", "successful", "paid", "completed"].includes(verifiedStatus)
  if (isSuccessful) {
    const updated = await updateOrderAndPaymentStatus(
      db,
      order.id,
      cleanTxRef,
      "successful",
      sanitizedVerification,
      verifyData.reference
    )

    // Dispatch Payment Confirmation Notification & Email
    const phoneTitle = order.phone ? `${order.phone.brand} ${order.phone.model}` : "your mobile device"
    createAndDispatchNotification({
      userId: order.client_id,
      title: "Payment Confirmed! 🛡️",
      message: `Your payment of ${Number(order.amount).toLocaleString()} ETB for ${phoneTitle} has been verified successfully.`,
      category: "orders",
      targetType: "order",
      targetId: order.id,
    }).catch(() => {})

    if (order.customer_email) {
      sendPaymentVerifiedEmail(updated.payment, updated.order, order.customer_email).catch(() => {})
    }

    return {
      success: true,
      payment: updated.payment,
      order: updated.order,
      message: "Payment successfully verified.",
    }
  } else if (verifiedStatus === "pending") {
    const updated = await updateOrderAndPaymentStatus(
      db,
      order.id,
      cleanTxRef,
      "pending",
      sanitizedVerification,
      verifyData.reference
    )

    return {
      success: false,
      payment: updated.payment,
      order: updated.order,
      message: "Payment is still pending on Chapa network.",
    }
  } else {
    const status = verifiedStatus === "cancelled" ? "cancelled" : "failed"
    const updated = await updateOrderAndPaymentStatus(
      db,
      order.id,
      cleanTxRef,
      status,
      sanitizedVerification,
      verifyData.reference
    )

    return {
      success: false,
      payment: updated.payment,
      order: updated.order,
      message: `Payment ${status}.`,
    }
  }
}

/**
 * Updates order and payment records idempotently
 */
async function updateOrderAndPaymentStatus(
  db: any,
  orderId: string,
  txRef: string,
  status: "successful" | "failed" | "pending" | "cancelled",
  sanitizedVerification: Record<string, unknown>,
  providerTxId?: string
) {
  const orderPaymentStatus =
    status === "successful" ? "completed" : status === "cancelled" ? "cancelled" : status === "pending" ? "pending" : "failed"

  const orderStatus =
    status === "successful" ? "payment_confirmed" : status === "cancelled" ? "cancelled" : undefined

  // 1. Fetch current order to preserve history and perform idempotent updates
  const { data: currentOrder } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single()

  const currentHistory: Array<any> = Array.isArray(currentOrder?.status_history)
    ? currentOrder.status_history
    : []

  const hasPaymentConfirmed = currentHistory.some((h) => h.status === "payment_confirmed")

  let updatedHistory = currentHistory
  if (status === "successful" && !hasPaymentConfirmed) {
    updatedHistory = [
      ...currentHistory,
      {
        status: "payment_confirmed",
        title: "Payment Confirmed",
        description: `Payment verified securely with Chapa gateway (Ref: ${txRef})`,
        timestamp: new Date().toISOString(),
      },
    ]

    // Idempotent inventory deduction
    try {
      const itemsToDeduct = currentOrder?.items && currentOrder.items.length > 0
        ? currentOrder.items
        : currentOrder?.phone_id
          ? [{ phone_id: currentOrder.phone_id, quantity: 1 }]
          : []

      for (const item of itemsToDeduct) {
        if (!item.phone_id) continue
        const qty = item.quantity || 1
        const { data: sale } = await db
          .from("sales")
          .select("*")
          .eq("phone_id", item.phone_id)
          .maybeSingle()

        if (sale) {
          const newInv = Math.max(0, (sale.inventory_quantity || 0) - qty)
          const newSold = (sale.sold_quantity || 0) + qty
          await db
            .from("sales")
            .update({
              inventory_quantity: newInv,
              sold_quantity: newSold,
            })
            .eq("id", sale.id)
        }
      }
    } catch (stockErr) {
      console.warn("[PaymentService] Inventory deduction notice:", stockErr)
    }

    // Insert into order_status_history
    try {
      await db.from("order_status_history").insert({
        order_id: orderId,
        status: "payment_confirmed",
        title: "Payment Confirmed",
        notes: `Verified Chapa Transaction: ${txRef}`,
      })
    } catch {
      // Non-blocking
    }
  } else if (status === "cancelled" && !currentHistory.some((h) => h.status === "cancelled")) {
    updatedHistory = [
      ...currentHistory,
      {
        status: "cancelled",
        title: "Order Cancelled",
        description: "Payment cancelled by user or provider",
        timestamp: new Date().toISOString(),
      },
    ]
  }

  const updatePayload: Record<string, any> = {
    payment_status: orderPaymentStatus,
    updated_at: new Date().toISOString(),
  }
  if (orderStatus) {
    updatePayload.order_status = orderStatus
  }
  if (updatedHistory.length > 0) {
    updatePayload.status_history = updatedHistory
  }

  // 2. Update Order
  const { data: updatedOrder } = await db
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("*")
    .single()

  if (updatedOrder && updatedOrder.phone_id) {
    const { data: phoneData } = await db
      .from("phones")
      .select("*")
      .eq("id", updatedOrder.phone_id)
      .maybeSingle()
    if (phoneData) {
      updatedOrder.phone = phoneData
    }
  }

  // 3. Update Payment
  const { data: updatedPayment } = await db
    .from("payments")
    .update({
      status,
      provider_tx_id: providerTxId || null,
      raw_verification: sanitizedVerification,
      updated_at: new Date().toISOString(),
    })
    .eq("transaction_ref", txRef)
    .select()
    .maybeSingle()

  return {
    order: updatedOrder || { id: orderId, payment_status: orderPaymentStatus },
    payment: updatedPayment || { transaction_ref: txRef, status },
  }
}
