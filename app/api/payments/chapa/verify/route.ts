import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyAndReconcilePayment } from "@/lib/chapa/payment-service"
import { ChapaError } from "@/lib/chapa/client"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const txRef = searchParams.get("tx_ref")

  return handleVerification(request, txRef)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const txRef = body?.tx_ref

  return handleVerification(request, txRef)
}

async function handleVerification(request: NextRequest, txRef: string | null | undefined) {
  if (!txRef || txRef.trim() === "") {
    return NextResponse.json(
      { error: "Transaction reference (tx_ref) query parameter is required" },
      { status: 400 }
    )
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let isAdmin = false
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
      isAdmin = profile?.role === "admin"
    }

    const result = await verifyAndReconcilePayment(txRef, {
      userId: user?.id || null,
      isAdmin,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error: unknown) {
    console.error("[Chapa Verify Route Error]:", error)

    const message = error instanceof Error ? error.message : "Unable to verify transaction at this time. Please try again."
    const status = (error as any)?.status && (error as any).status >= 400 && (error as any).status < 600
      ? (error as any).status
      : 500

    return NextResponse.json({ error: message }, { status })
  }
}
