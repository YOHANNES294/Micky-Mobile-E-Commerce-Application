import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { NotificationCategory, NotificationItem, NotificationPreferences } from "@/lib/types"
import { sendEmail, type SendEmailParams } from "@/lib/email/email-service"

export interface CreateNotificationParams {
  userId: string
  title: string
  message: string
  category: NotificationCategory
  targetType?: "order" | "chat" | "phone" | "url" | string
  targetId?: string
  metadata?: Record<string, any>
  emailParams?: Omit<SendEmailParams, "userId" | "category">
}

async function getDbClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      return createAdminClient()
    } catch {
      // Fallback
    }
  }
  return await createClient()
}

/**
 * Retrieves user notification preferences, with safe defaults if none exist
 */
export async function getUserPreferences(userId: string): Promise<NotificationPreferences> {
  const defaultPrefs: NotificationPreferences = {
    user_id: userId,
    in_app_enabled: true,
    push_enabled: true,
    email_enabled: true,
    order_updates: true,
    support_messages: true,
    promotional_updates: false,
    sound_enabled: true,
    dont_ask_again: false,
  }

  try {
    const db = await getDbClient()
    const { data } = await db
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (data) {
      return { ...defaultPrefs, ...data }
    }
  } catch (err) {
    console.warn("[NotificationService] Error reading preferences:", err)
  }

  return defaultPrefs
}

/**
 * Updates user notification preferences
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const db = await getDbClient()
  const payload = {
    user_id: userId,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from("notification_preferences")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single()

  if (error) {
    console.error("[NotificationService] Error updating preferences:", error)
    throw error
  }

  return data
}

/**
 * Creates and dispatches a notification across In-App, Push, and Email channels
 * according to user preferences.
 */
export async function createAndDispatchNotification(
  params: CreateNotificationParams
): Promise<{ notification?: NotificationItem; emailSent: boolean; pushDispatched: boolean }> {
  const { userId, title, message, category, targetType, targetId, metadata, emailParams } = params
  const db = await getDbClient()

  // 1. Check user preferences
  const prefs = await getUserPreferences(userId)

  // Verify category specific permission
  if (category === "orders" && !prefs.order_updates) {
    return { emailSent: false, pushDispatched: false }
  }
  if (category === "messages" && !prefs.support_messages) {
    return { emailSent: false, pushDispatched: false }
  }
  if (category === "promotions" && !prefs.promotional_updates) {
    return { emailSent: false, pushDispatched: false }
  }

  let createdNotification: NotificationItem | undefined

  // 2. In-App Notification
  if (prefs.in_app_enabled) {
    try {
      const { data, error } = await db
        .from("notifications")
        .insert({
          user_id: userId,
          title,
          message,
          category,
          target_type: targetType || "url",
          target_id: targetId || null,
          metadata: metadata || {},
          is_read: false,
        })
        .select()
        .single()

      if (error) {
        console.error("[NotificationService] In-app insert error:", error)
      } else {
        createdNotification = data
      }
    } catch (inAppErr) {
      console.error("[NotificationService] In-app exception:", inAppErr)
    }
  }

  // 3. Web & Mobile Push Notification Dispatch
  let pushDispatched = false
  if (prefs.push_enabled) {
    try {
      const { data: subscriptions } = await db
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId)

      if (subscriptions && subscriptions.length > 0) {
        console.log(`[NotificationService] Found ${subscriptions.length} push subscriptions for user ${userId}`)
        pushDispatched = true
      }
    } catch (pushErr) {
      console.warn("[NotificationService] Push lookup error:", pushErr)
    }
  }

  // 4. Transactional Email Dispatch
  let emailSent = false
  if (prefs.email_enabled && emailParams) {
    const res = await sendEmail({
      to: emailParams.to,
      subject: emailParams.subject,
      category,
      html: emailParams.html,
      text: emailParams.text,
      userId,
      metadata: emailParams.metadata,
    })
    emailSent = res.success
  }

  return {
    notification: createdNotification,
    emailSent,
    pushDispatched,
  }
}

/**
 * Fetch notifications for a given user
 */
export async function getUserNotifications(userId: string, limit = 40) {
  const db = await getDbClient()

  const { data: notifications, error } = await db
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[NotificationService] Fetch notifications error:", error)
    return { notifications: [], unreadCount: 0 }
  }

  const unreadCount = (notifications || []).filter((n) => !n.is_read).length

  return {
    notifications: notifications || [],
    unreadCount,
  }
}

/**
 * Mark notification(s) as read
 */
export async function markNotificationsAsRead(userId: string, notificationId?: string) {
  const db = await getDbClient()

  let query = db.from("notifications").update({ is_read: true }).eq("user_id", userId)

  if (notificationId && notificationId !== "all") {
    query = query.eq("id", notificationId)
  }

  const { error } = await query
  if (error) {
    console.error("[NotificationService] Error marking as read:", error)
    throw error
  }

  return { success: true }
}
