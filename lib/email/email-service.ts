import nodemailer from "nodemailer"
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
      const adminMod = await import("../supabase/admin")
      return adminMod.createAdminClient()
    } catch {
      // Fallback
    }
  }
  try {
    const serverMod = await import("../supabase/server")
    return await serverMod.createClient()
  } catch {
    return null
  }
}

/**
 * Base email layout wrapper with Micky Mobile Ethiopia branding (AliExpress style)
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
      background-color: #f1f5f9;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      padding: 24px 12px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #fed7aa;
    }
    .header {
      background: linear-gradient(135deg, #FF4747 0%, #FF6B4A 50%, #D4AF37 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header .brand {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -1px;
    }
    .header h1 {
      margin: 10px 0 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 6px 0 0;
      font-size: 13px;
      opacity: 0.95;
    }
    .content {
      padding: 32px 28px;
      font-size: 15px;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #FF4747 0%, #FF6B4A 60%, #D4AF37 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      box-shadow: 0 4px 16px rgba(255, 71, 71, 0.35);
      margin-top: 20px;
    }
    .btn:hover {
      opacity: 0.95;
    }
    .card {
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 14px;
      padding: 20px;
      margin: 20px 0;
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
    .badge-aliexpress { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
    .footer {
      background: #f8fafc;
      padding: 28px 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="brand">
          MICKY <span style="color: #ffedd5;">MOBILE</span>
        </div>
        <h1>${title}</h1>
        <p>Ethiopia's Trusted Phone Store • Bole Medhanialem, Alemenesh Plaza</p>
      </div>

      <div class="content">
        ${contentHtml}
      </div>

      <div class="footer">
        <p style="margin: 0 0 8px 0; font-weight: 700; color: #334155; font-size: 13px;">Micky Mobile Ethiopia</p>
        <p style="margin: 0 0 10px 0;">Bole Medhanialem, Alemenesh Plaza, Ground Floor (In front of Edna Mall), Addis Ababa</p>
        <p style="margin: 0 0 10px 0;">Customer Hotline: +251 93 369 4796 • Telegram: @mickymobile</p>
        <p style="margin: 16px 0 0 0; font-size: 11px; color: #94a3b8;">
          You received this email because of your notification settings at Micky Mobile Ethiopia.
          <a href="${appUrl}/client" style="color: #FF4747; text-decoration: underline; font-weight: 600;">Manage preferences</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Sends a transactional or notification email safely via Gmail SMTP (Nodemailer), Resend API, or audit log
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, category, html, text, userId, metadata } = params

  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS
  const smtpHost = process.env.SMTP_HOST || (gmailUser?.includes("@gmail.com") ? "smtp.gmail.com" : undefined)
  const resendApiKey = process.env.RESEND_API_KEY
  const senderEmail =
    process.env.SENDER_EMAIL ||
    (gmailUser ? `Micky Mobile Ethiopia <${gmailUser}>` : "Micky Mobile Ethiopia <notifications@mickymobile.et>")

  let status: "sent" | "failed" | "pending_config" = "pending_config"
  let errorMessage: string | undefined
  let emailId: string | undefined

  try {
    // 1. Direct Gmail / SMTP Transport (Nodemailer)
    if (gmailUser && gmailPass && smtpHost) {
      const port = Number(process.env.SMTP_PORT) || 465
      const secure = port === 465 || process.env.SMTP_SECURE === "true"

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      })

      const info = await transporter.sendMail({
        from: senderEmail,
        to,
        subject,
        html,
        text: text || subject,
      })

      if (info && (info.messageId || info.accepted?.length)) {
        status = "sent"
        emailId = info.messageId
      } else {
        status = "failed"
        errorMessage = "SMTP server did not return a valid messageId"
      }
    }
    // 2. Resend API integration
    else if (resendApiKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
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
      // 3. Fallback when provider credentials are not yet set
      status = "pending_config"
      console.log(`[EmailService] (Pending Config) Email prepared for ${to} [${subject}]`)
    }
  } catch (err: any) {
    status = "failed"
    errorMessage = err?.message || "Unknown error during email dispatch"
    console.error("[EmailService Error]:", err)
  }

  // Always record log in Supabase email_logs table for audit & verification
  try {
    const db = await getDbClient()
    if (db) {
      await db.from("email_logs").insert({
        user_id: userId || null,
        recipient_email: to,
        subject,
        category,
        status,
        error_message: errorMessage || null,
        metadata: metadata || {},
      })
    }
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
// AliExpress-Style Order Tracking Milestone Emails
// ==============================================================

const MILESTONE_LABELS: Record<string, { label: string; desc: string; step: number }> = {
  placed: { label: "Order Placed", desc: "Your order has been recorded in our system.", step: 1 },
  payment_confirmed: { label: "Payment Confirmed", desc: "Chapa payment verified successfully.", step: 2 },
  confirmed: { label: "Order Confirmed", desc: "Our store sales team has verified your phone specifications.", step: 2 },
  processing: { label: "Processing & QC Inspection", desc: "Phone is undergoing thorough hardware and battery inspection.", step: 3 },
  ready_for_dispatch: { label: "Ready for Dispatch", desc: "Packaged securely with Micky Mobile seal and warranty card.", step: 3 },
  ready_for_pickup: { label: "Ready for In-Store Pickup", desc: "Available at Bole Alemnesh Plaza Ground Floor right now.", step: 4 },
  shipped: { label: "Shipped & In Transit", desc: "Dispatched with Micky Mobile courier.", step: 4 },
  out_for_delivery: { label: "Out for Delivery", desc: "Our courier is on the way to your delivery address.", step: 4 },
  delivered: { label: "Delivered & Completed", desc: "Package safely delivered and signed for.", step: 5 },
  picked_up: { label: "Picked Up from Store", desc: "Package collected from Bole Alemnesh Plaza store.", step: 5 },
}

/**
 * Sends an AliExpress-style live tracking milestone update email to customer's Gmail
 */
export async function sendAliExpressOrderUpdateEmail(params: {
  order: Order
  customerEmail: string
  customerName?: string
  newStatus: string
  notes?: string
  trackingCarrier?: string
  trackingNumber?: string
}) {
  const { order, customerEmail, customerName, newStatus, notes, trackingCarrier, trackingNumber } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const phone = order.phone
  const phoneTitle = phone ? `${phone.brand} ${phone.model}` : "Flagship Smartphone"
  const refCode = order.transaction_ref || order.id.slice(0, 8)
  const milestone = MILESTONE_LABELS[newStatus] || { label: newStatus, desc: "Status updated.", step: 3 }

  const subject = `Micky Mobile: ${customerName || "Customer"}, your order #${refCode.slice(0, 8)} is ${milestone.label}`

  // 5-step AliExpress timeline visual
  const steps = [
    { num: 1, name: "Placed" },
    { num: 2, name: "Paid" },
    { num: 3, name: "Prepared" },
    { num: 4, name: "Dispatched" },
    { num: 5, name: "Delivered" },
  ]

  const timelineHtml = `
    <div style="background: #fff; border: 1px solid #fed7aa; border-radius: 12px; padding: 18px 12px; margin: 20px 0; text-align: center;">
      <table style="width: 100%; border-collapse: collapse; text-align: center;">
        <tr>
          ${steps
            .map((s) => {
              const isPastOrCurrent = s.num <= milestone.step
              const isCurrent = s.num === milestone.step
              const circleBg = isCurrent ? "#FF4747" : isPastOrCurrent ? "#16a34a" : "#e2e8f0"
              const textColor = isPastOrCurrent ? "#1e293b" : "#94a3b8"
              const checkIcon = isPastOrCurrent && !isCurrent ? "&#10003;" : s.num
              return `
                <td style="padding: 0 4px; vertical-align: top;">
                  <div style="width: 32px; height: 32px; border-radius: 50%; background: ${circleBg}; color: #fff; line-height: 32px; font-weight: bold; font-size: 13px; margin: 0 auto; box-shadow: ${isCurrent ? "0 0 10px rgba(255,71,71,0.5)" : "none"};">
                    ${checkIcon}
                  </div>
                  <div style="margin-top: 6px; font-size: 11px; font-weight: 700; color: ${textColor};">
                    ${s.name}
                  </div>
                </td>
              `
            })
            .join("")}
        </tr>
      </table>
    </div>
  `

  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <span class="badge badge-aliexpress" style="font-size: 12px; margin-bottom: 8px;">Order Milestone Update</span>
      <h2 style="margin: 8px 0 4px; color: #1e293b; font-size: 20px; font-weight: 800;">${milestone.label}</h2>
      <p style="margin: 0; color: #64748b; font-size: 14px;">${milestone.desc}</p>
      ${notes ? `<p style="margin: 8px 0 0; padding: 10px 14px; background: #fff7ed; border-left: 3px solid #f97316; border-radius: 6px; font-size: 13px; color: #9a3412;"><strong>Store Note:</strong> ${notes}</p>` : ""}
    </div>

    ${timelineHtml}

    <div class="card" style="margin-top: 16px;">
      <h3 style="margin-top: 0; font-size: 15px; color: #FF4747; text-transform: uppercase; letter-spacing: 0.5px;">Package Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; color: #64748b;">Smartphone:</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 800; color: #0f172a;">${phoneTitle}</td>
        </tr>
        ${phone?.storage ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b;">Storage & Specs:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">${phone.storage} ${phone.ram ? `• ${phone.ram} RAM` : ""}</td>
        </tr>
        ` : ""}
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b;">Total Amount:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 900; color: #FF4747; font-size: 16px;">${Number(order.amount).toLocaleString()} ETB</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b;">Fulfillment:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">${order.delivery_method === "pickup" ? "Store Pickup (Bole Alemnesh Plaza)" : "Direct City Delivery"}</td>
        </tr>
        ${trackingCarrier || order.shipping_carrier ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b;">Carrier:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">${trackingCarrier || order.shipping_carrier}</td>
        </tr>
        ` : ""}
        ${trackingNumber || order.tracking_number ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px 0; color: #64748b;">Tracking #:</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: 700;">${trackingNumber || order.tracking_number}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Reference:</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #475569;">#${refCode}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${appUrl}/client/orders" class="btn" style="width: 80%; text-align: center; display: inline-block;">
        Track Your Order Now
      </a>
      <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8;">
        Live status is updated in real-time on your customer portal and Flutter mobile app.
      </p>
    </div>
  `

  const html = wrapBrandedEmailTemplate(`Order #${refCode.slice(0, 8)}: ${milestone.label}`, contentHtml)

  return sendEmail({
    to: customerEmail,
    subject,
    category: "orders",
    html,
    userId: order.client_id,
    metadata: { orderId: order.id, status: newStatus, transactionRef: order.transaction_ref },
  })
}

// ==============================================================
// AliExpress-Style "Your Picks Are Ready" Promotional Email
// ==============================================================

export interface RecommendedPhone {
  brand: string
  model: string
  price: number
  storage?: string
  ram?: string
  image_url?: string
  badge?: string
}

/**
 * Sends an AliExpress-style "Ethio.Yoni, your picks are ready" email to customer's Gmail
 */
export async function sendAliExpressProductPicksEmail(params: {
  customerEmail: string
  customerName?: string
  recommendedPhones?: RecommendedPhone[]
}) {
  const { customerEmail, customerName, recommendedPhones } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const name = customerName || "Ethio.Yoni"

  const defaultPicks: RecommendedPhone[] = [
    {
      brand: "Samsung",
      model: "Galaxy S24 Ultra",
      price: 148000,
      storage: "512GB",
      ram: "12GB",
      badge: "Top Flagship",
      image_url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=500&q=80",
    },
    {
      brand: "Apple",
      model: "iPhone 16 Pro Max",
      price: 185000,
      storage: "256GB",
      ram: "8GB",
      badge: "New Arrival",
      image_url: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=500&q=80",
    },
    {
      brand: "Samsung",
      model: "Galaxy Z Fold6",
      price: 198000,
      storage: "512GB",
      ram: "12GB",
      badge: "Foldable AI",
      image_url: "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=500&q=80",
    },
    {
      brand: "Apple",
      model: "iPhone 15 Pro",
      price: 128000,
      storage: "128GB",
      ram: "8GB",
      badge: "Best Seller",
      image_url: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=500&q=80",
    },
  ]

  const items = recommendedPhones && recommendedPhones.length > 0 ? recommendedPhones : defaultPicks
  const subject = `AliExpress • Micky Mobile: ${name}, your picks are ready - Handpicked items, chosen for you`

  const gridHtml = `
    <div style="margin: 20px 0;">
      <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 20px;">
        <span style="font-size: 12px; font-weight: 800; color: #e11d48; text-transform: uppercase; letter-spacing: 0.5px;">Handpicked For You</span>
        <h3 style="margin: 4px 0 0; color: #881337; font-size: 16px;">Top Smartphone Recommendations in Addis Ababa</h3>
      </div>

      <table style="width: 100%; border-collapse: separate; border-spacing: 12px 12px;">
        ${[0, 2]
          .map((rowIdx) => {
            const p1 = items[rowIdx]
            const p2 = items[rowIdx + 1]
            return `
            <tr>
              ${p1 ? `
              <td style="width: 50%; vertical-align: top; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px; text-align: center;">
                ${p1.badge ? `<span style="display: inline-block; background: #FF4747; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; text-transform: uppercase;">${p1.badge}</span>` : ""}
                <div style="margin: 8px 0; font-weight: 800; font-size: 14px; color: #1e293b;">${p1.brand} ${p1.model}</div>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${p1.storage || ""} ${p1.ram ? `• ${p1.ram}` : ""}</div>
                <div style="font-size: 16px; font-weight: 900; color: #FF4747; margin-bottom: 12px;">${Number(p1.price).toLocaleString()} ETB</div>
                <a href="${appUrl}/client" style="display: block; background: #1e293b; color: #fff; text-decoration: none; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">View Deal</a>
              </td>
              ` : `<td style="width: 50%;"></td>`}

              ${p2 ? `
              <td style="width: 50%; vertical-align: top; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px; text-align: center;">
                ${p2.badge ? `<span style="display: inline-block; background: #FF4747; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; text-transform: uppercase;">${p2.badge}</span>` : ""}
                <div style="margin: 8px 0; font-weight: 800; font-size: 14px; color: #1e293b;">${p2.brand} ${p2.model}</div>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${p2.storage || ""} ${p2.ram ? `• ${p2.ram}` : ""}</div>
                <div style="font-size: 16px; font-weight: 900; color: #FF4747; margin-bottom: 12px;">${Number(p2.price).toLocaleString()} ETB</div>
                <a href="${appUrl}/client" style="display: block; background: #1e293b; color: #fff; text-decoration: none; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">View Deal</a>
              </td>
              ` : `<td style="width: 50%;"></td>`}
            </tr>
          `
          })
          .join("")}
      </table>
    </div>
  `

  const contentHtml = `
    <p style="font-size: 16px; margin-top: 0;">Hi <strong>${name}</strong>,</p>
    <p>We saw you were looking at high-end devices. Here are the latest handpicked Samsung & iPhone deals curated specially for you at Micky Mobile Bole store:</p>

    ${gridHtml}

    <div style="text-align: center; margin-top: 24px;">
      <a href="${appUrl}/client" class="btn" style="width: 80%; text-align: center; display: inline-block;">
        Browse All Selected Finds
      </a>
      <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8;">
        All phones are 100% genuine with official factory seals, 1-year warranty, and instant Bole store pickup or Addis Ababa delivery.
      </p>
    </div>
  `

  const html = wrapBrandedEmailTemplate("Handpicked Items, Chosen For You", contentHtml)

  return sendEmail({
    to: customerEmail,
    subject,
    category: "promotions",
    html,
    metadata: { type: "picks_ready", customerName: name },
  })
}

// ==============================================================
// AliExpress-Style "Something new just arrived" Email
// ==============================================================

/**
 * Sends an AliExpress-style "Something new just arrived - Browse the latest finds today" email
 */
export async function sendAliExpressNewArrivalsEmail(params: {
  customerEmail: string
  customerName?: string
  phone: RecommendedPhone
}) {
  const { customerEmail, customerName, phone } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const subject = `Micky Mobile: Something new just arrived - Browse the latest finds today`

  const contentHtml = `
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fee2e2 100%); border: 1px solid #fde047; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px;">
      <span style="font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 1px;">Fresh Arrival in Addis Ababa</span>
      <h2 style="margin: 6px 0 0; color: #78350f; font-size: 20px; font-weight: 900;">${phone.brand} ${phone.model}</h2>
    </div>

    <p style="font-size: 15px;">Hello <strong>${customerName || "Friend"}</strong>,</p>
    <p>A brand new flagship model just landed at our Bole Medhanialem showroom. Limited stock available with direct import warranty!</p>

    <div class="card" style="text-align: center; padding: 24px;">
      <div style="font-size: 22px; font-weight: 900; color: #1e293b;">${phone.brand} ${phone.model}</div>
      <div style="font-size: 14px; color: #64748b; margin: 4px 0 12px;">${phone.storage || "256GB"} ${phone.ram ? `• ${phone.ram} RAM` : ""} • Dual SIM / eSIM</div>
      <div style="font-size: 26px; font-weight: 900; color: #FF4747; margin-bottom: 16px;">${Number(phone.price).toLocaleString()} ETB</div>
      <span class="badge badge-success" style="font-size: 12px;">In Stock • Ready for Same-Day Delivery</span>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${appUrl}/client" class="btn" style="width: 80%; text-align: center; display: inline-block;">
        Order Now Before Sold Out
      </a>
    </div>
  `

  const html = wrapBrandedEmailTemplate("New Flagship Arrival", contentHtml)

  return sendEmail({
    to: customerEmail,
    subject,
    category: "products",
    html,
    metadata: { type: "new_arrival", model: phone.model },
  })
}

// ==============================================================
// Classic Transactional Templates (Preserved for compatibility)
// ==============================================================

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
