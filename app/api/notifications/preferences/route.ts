import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserPreferences, updateUserPreferences } from "@/lib/notifications/notification-service"

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

    const preferences = await getUserPreferences(user.id)
    return NextResponse.json({ preferences }, { status: 200 })
  } catch (error: any) {
    console.error("[Preferences API GET Error]:", error)
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 })
  }
}

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
    const updated = await updateUserPreferences(user.id, body)

    return NextResponse.json({ preferences: updated }, { status: 200 })
  } catch (error: any) {
    console.error("[Preferences API POST Error]:", error)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}
