import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createAndDispatchNotification } from "@/lib/notifications/notification-service"
import { sendSupportReplyEmail, sendAdminNewInquiryAlertEmail } from "@/lib/email/email-service"

// In-memory sliding window rate limiter (max 20 notification dispatches per minute per user)
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 20

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(userId) || []
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }
  validTimestamps.push(now)
  rateLimitMap.set(userId, validTimestamps)
  return true
}

const ALLOWED_CATEGORIES = new Set(["orders", "messages", "products", "promotions", "account"])

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

    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: "Too many notification requests. Please slow down." }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.title || !body.message) {
      return NextResponse.json({ error: "Missing required notification fields" }, { status: 400 })
    }

    const {
      recipientId,
      title,
      message,
      category = "messages",
      targetType,
      targetId,
      metadata,
      emailDetails,
    } = body

    if (typeof title !== "string" || title.trim().length === 0 || title.length > 150) {
      return NextResponse.json({ error: "Invalid title length (max 150 chars)" }, { status: 400 })
    }

    if (typeof message !== "string" || message.trim().length === 0 || message.length > 2000) {
      return NextResponse.json({ error: "Invalid message length (max 2000 chars)" }, { status: 400 })
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    let db: any = supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        db = createAdminClient()
      } catch {}
    }

    // Authorization verification:
    // If notifying a specific user other than themselves, caller must be admin
    if (recipientId && recipientId !== "admin" && recipientId !== user.id) {
      const { data: callerProfile } = await db
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (callerProfile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden: Only admins can notify other users" }, { status: 403 })
      }
    }

    // 1. If recipient is "admin", broadcast notification to all admins
    if (recipientId === "admin") {
      const { data: admins } = await db
        .from("user_profiles")
        .select("id, email")
        .eq("role", "admin")

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await createAndDispatchNotification({
            userId: admin.id,
            title,
            message,
            category,
            targetType: targetType || "chat",
            targetId,
            metadata,
          })

          // Send admin email if inquiry
          if (emailDetails?.customerEmail && admin.email) {
            await sendAdminNewInquiryAlertEmail({
              adminEmail: admin.email,
              customerEmail: emailDetails.customerEmail,
              messageContent: message,
              phoneInfo: emailDetails.phoneInfo,
              chatId: targetId || "",
            })
          }
        }
      }
      return NextResponse.json({ success: true, count: admins?.length || 0 }, { status: 200 })
    }

    // 2. Specific recipient notification (e.g. customer)
    if (recipientId) {
      // Build email params if applicable
      let emailParams: any = undefined
      if (category === "messages" && emailDetails?.customerEmail) {
        // Send email in background
        sendSupportReplyEmail({
          customerEmail: emailDetails.customerEmail,
          customerName: emailDetails.customerName,
          replyContent: message,
          phoneInfo: emailDetails.phoneInfo,
          userId: recipientId,
          chatId: targetId || "",
        }).catch((e) => console.error("[Notify Route] Support email error:", e))
      }

      const result = await createAndDispatchNotification({
        userId: recipientId,
        title,
        message,
        category,
        targetType,
        targetId,
        metadata,
        emailParams,
      })

      return NextResponse.json({ success: true, result }, { status: 200 })
    }

    return NextResponse.json({ error: "No recipient specified" }, { status: 400 })
  } catch (err: any) {
    console.error("[Notification Send API Error]:", err)
    return NextResponse.json({ error: err?.message || "Failed to trigger notification" }, { status: 500 })
  }
}
