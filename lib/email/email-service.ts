import type { Order, Payment } from "../types"

export interface SendEmailParams {
  to: string
  subject: string
  category: "orders" | "messages" | "products" | "promotions" | "account"
  html: string
  text?: string
  userId?: string
  metadata?: Record<string, any>
}

export interface SendEmailResult {
  success: boolean
  id?: string
  status: "sent" | "failed" | "pending_config"
  error?: string
}

async function getDbClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const adminMod = await import("@/lib/supabase/admin")
      return adminMod.createAdminClient()
    } catch {
      // Fallback
    }
  }
  const serverMod = await import("@/lib/supabase/server")
  return await serverMod.createClient()
}

/**
 * Base email layout wrapper with Micky Mobile Ethiopia branding
 */
export function wrapBrandedEmailTemplate(title: string, contentHtml: string): string {
  const currentYear = new Date().getFullYear()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
      border: 1px solid #fed7aa;
    }
    .header {
      background: linear-gradient(135deg, #FF6B4A 0%, #E85535 50%, #D4AF37 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 8px 0 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 4px 0 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .content {
      padding: 32px 28px;
      font-size: 15px;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #FF6B4A 0%, #D4AF37 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(255, 107, 74, 0.25);
      margin-top: 16px;
    }
    .footer {
      background: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-pending { background: #fef3c7; color: #b45309; }
    .card {
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="container">
      <div class="header">
        <div style="font-size: 28px; font-weight: 900; letter-spacing: -1px;">
          MICKY <span style="color: #ffedd5;">MOBILE</span>
        </div>
        <h1>${title}</h1>
        <p>Ethiopia's Trusted Phone Store • Alemenesh Plaza, Bole</p>
      </div>

      <div class="content">
        ${contentHtml}
      </div>

      <div class="footer">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #334155;">Micky Mobile Ethiopia</p>
        <p style="margin: 0 0 12px 0;">Alemenesh Plaza, In Front of Edna Mall, Bole Medhanialem, Addis Ababa</p>
        <p style="margin: 0 0 12px 0;">Customer Support: +251 91 123 4567 • info@mickymobile.et</p>
        <p style="margin: 16px 0 0 0; font-size: 11px; color: #94a3b8;">
          You received this email according to your Micky Mobile notification preferences. 
          <a href="${appUrl}/client" style="color: #FF6B4A; text-decoration: underline;">Manage preferences</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Sends a transactional email safely
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, category, html, text, userId, metadata } = params
  const resendApiKey = process.env.RESEND_API_KEY
  const senderEmail = process.env.SENDER_EMAIL || "Micky Mobile Ethiopia <notifications@mickymobile.et>"

  let status: "sent" | "failed" | "pending_config" = "pending_config"
  let errorMessage: string | undefined
  let emailId: string | undefined

  try {
    if (resendApiKey) {
      // Send with Resend API
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [to],
          subject,
          html,
          text: text || subject,
        }),
      })

      const data = await response.json()
      if (response.ok && data.id) {
        status = "sent"
        emailId = data.id
      } else {
        status = "failed"
        errorMessage = data.message || "Failed to deliver email through Resend API"
      }
    } else {
      // Safe fallback when provider is not yet set up
      status = "pending_config"
      console.log(`[EmailService] (Pending Config) Email prepared for ${to} [${subject}]`)
    }
  } catch (err: any) {
    status = "failed"
    errorMessage = err?.message || "Unknown error during email dispatch"
    console.error("[EmailService Error]:", err)
  }

  // Always log to email_logs table for audit & verification
  try {
    const db = await getDbClient()
    await db.from("email_logs").insert({
      user_id: userId || null,
      recipient_email: to,
      subject,
      category,
      status,
      error_message: errorMessage || null,
      metadata: metadata || {},
    })
  } catch (logErr) {
    console.warn("[EmailService] Could not write to email_logs table:", logErr)
  }

  return {
    success: status === "sent" || status === "pending_config",
    status,
    id: emailId,
    error: errorMessage,
  }
}

// ==============================================================
// Pre-built Branded Transactional Email Templates
// ==============================================================

/**
 * 1. Order Confirmation Email
 */
export async function sendOrderConfirmationEmail(order: Order, customerEmail: string, customerName?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const phoneName = order.phone ? `${order.phone.brand} ${order.phone.model}` : "Mobile Device"
  const title = `Order Confirmation #${order.transaction_ref || order.id.slice(0, 8)}`

  const html = wrapBrandedEmailTemplate(
    title,
    `
      <p style="font-size: 16px;">Dear <strong>${customerName || "Customer"}</strong>,</p>
      <p>Thank you for choosing Micky Mobile! We have received your order and our sales team is preparing it for you.</p>

      <div class="card">
        <h3 style="margin-top: 0; color: #FF6B4A; font-size: 16px;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e7e5e4;">
            <td style="padding: 8px 0; color: #64748b;">Device:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700;">${phoneName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e7e5e4;">
            <td style="padding: 8px 0; color: #64748b;">Total Amount:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #FF6B4A;">${Number(order.amount).toLocaleString()} ETB</td>
          </tr>
          <tr style="border-bottom: 1px solid #e7e5e4;">
            <td style="padding: 8px 0; color: #64748b;">Payment Method:</td>
            <td style="padding: 8px 0; text-align: right; text-transform: uppercase;">${order.payment_method}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Reference:</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace;">${order.transaction_ref || order.id}</td>
          </tr>
        </table>
      </div>

      <p style="text-align: center;">
        <a href="${appUrl}/client/orders" class="btn">View Your Order Status</a>
      </p>
    `
  )

  return sendEmail({
    to: customerEmail,
    subject: `[Micky Mobile] Order Confirmation #${order.transaction_ref || order.id.slice(0, 8)}`,
    category: "orders",
    html,
    userId: order.client_id,
    metadata: { orderId: order.id, transactionRef: order.transaction_ref },
  })
}

/**
 * 2. Payment Verified Success Email
 */
export async function sendPaymentVerifiedEmail(payment: Payment, order: Order, customerEmail: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const phoneName = order.phone ? `${order.phone.brand} ${order.phone.model}` : "Mobile Device"
  const title = "Payment Successfully Verified!"

  const html = wrapBrandedEmailTemplate(
    title,
    `
      <div style="text-align: center; margin-bottom: 24px;">
        <span class="badge badge-success" style="font-size: 14px; padding: 6px 16px;">Verified • ${payment.provider.toUpperCase()}</span>
      </div>

      <p style="font-size: 16px;">We are pleased to inform you that your payment of <strong>${Number(payment.amount).toLocaleString()} ETB</strong> has been successfully verified.</p>
      
      <div class="card">
        <h3 style="margin-top: 0; color: #15803d; font-size: 16px;">Payment Details</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e7e5e4;">
            <td style="padding: 8px 0; color: #64748b;">Item:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700;">${phoneName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e7e5e4;">
            <td style="padding: 8px 0; color: #64748b;">Amount Paid:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #15803d;">${Number(payment.amount).toLocaleString()} ETB</td>
          </tr>
          <tr style="border-bottom: 1px solid #e7e5e4;">
            <td style="padding: 8px 0; color: #64748b;">Payment Ref:</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace;">${payment.transaction_ref}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Date:</td>
            <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleDateString()}</td>
          </tr>
        </table>
      </div>

      <p>Our store team is now preparing your device for pickup or delivery.</p>

      <p style="text-align: center;">
        <a href="${appUrl}/client/orders" class="btn">Track Order & Receipt</a>
      </p>
    `
  )

  return sendEmail({
    to: customerEmail,
    subject: `[Micky Mobile] Payment Confirmed — ${phoneName}`,
    category: "orders",
    html,
    userId: order.client_id,
    metadata: { paymentId: payment.id, orderId: order.id, transactionRef: payment.transaction_ref },
  })
}

/**
 * 3. Customer Support Reply Email
 */
export async function sendSupportReplyEmail(params: {
  customerEmail: string
  customerName?: string
  replyContent: string
  phoneInfo?: string
  userId?: string
  chatId: string
}) {
  const { customerEmail, customerName, replyContent, phoneInfo, userId, chatId } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const title = "New Reply From Micky Mobile Team"

  const html = wrapBrandedEmailTemplate(
    title,
    `
      <p style="font-size: 16px;">Hello <strong>${customerName || "Customer"}</strong>,</p>
      <p>Our sales support team has replied to your inquiry${phoneInfo ? ` regarding <strong>${phoneInfo}</strong>` : ""}:</p>

      <div class="card" style="border-left: 4px solid #FF6B4A; background: #fff7ed;">
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${replyContent}</p>
      </div>

      <p style="text-align: center;">
        <a href="${appUrl}/client" class="btn">Reply to Message</a>
      </p>
    `
  )

  return sendEmail({
    to: customerEmail,
    subject: `[Micky Mobile] Response to your inquiry${phoneInfo ? ` (${phoneInfo})` : ""}`,
    category: "messages",
    html,
    userId,
    metadata: { chatId },
  })
}

/**
 * 4. Admin Alert for New Customer Message / Inquiry
 */
export async function sendAdminNewInquiryAlertEmail(params: {
  adminEmail: string
  customerEmail: string
  messageContent: string
  phoneInfo?: string
  chatId: string
}) {
  const { adminEmail, customerEmail, messageContent, phoneInfo, chatId } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const title = "New Customer Inquiry Received"

  const html = wrapBrandedEmailTemplate(
    title,
    `
      <p style="font-size: 16px;">A customer (<strong>${customerEmail}</strong>) just sent an inquiry${phoneInfo ? ` regarding <strong>${phoneInfo}</strong>` : ""}:</p>

      <div class="card" style="border-left: 4px solid #D4AF37; background: #fefce8;">
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${messageContent}</p>
      </div>

      <p style="text-align: center;">
        <a href="${appUrl}/admin" class="btn">Open Admin Chat Dashboard</a>
      </p>
    `
  )

  return sendEmail({
    to: adminEmail,
    subject: `[Admin Alert] Customer Inquiry from ${customerEmail}${phoneInfo ? ` (${phoneInfo})` : ""}`,
    category: "messages",
    html,
    metadata: { chatId, customerEmail },
  })
}
