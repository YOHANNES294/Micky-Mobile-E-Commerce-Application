import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserNotifications, markNotificationsAsRead } from "@/lib/notifications/notification-service"

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

    const { notifications, unreadCount } = await getUserNotifications(user.id)
    return NextResponse.json({ notifications, unreadCount }, { status: 200 })
  } catch (error: any) {
    console.error("[Notifications API GET Error]:", error)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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
    const notificationId = body.id || (body.all ? "all" : undefined)

    await markNotificationsAsRead(user.id, notificationId)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error("[Notifications API PATCH Error]:", error)
    return NextResponse.json({ error: "Failed to update notification status" }, { status: 500 })
  }
}
