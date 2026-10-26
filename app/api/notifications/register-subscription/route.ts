import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

    const body = await request.json().catch(() => null)
    if (!body || !body.endpoint) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 })
    }

    const { endpoint, keys, device_type, device_token } = body
    const p256dh = keys?.p256dh || null
    const auth = keys?.auth || null

    let db: any = supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        db = createAdminClient()
      } catch {}
    }

    const { error: upsertError } = await db.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        device_type: device_type || "web",
        device_token: device_token || null,
        user_agent: request.headers.get("user-agent") || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    )

    if (upsertError) {
      console.error("[Push Subscriptions Upsert Error]:", upsertError)
      return NextResponse.json({ error: "Failed to record subscription" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error("[Register Subscription Route Error]:", error)
    return NextResponse.json({ error: "Unexpected subscription error" }, { status: 500 })
  }
}
