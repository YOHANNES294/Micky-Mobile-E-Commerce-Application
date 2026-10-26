import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { initializeOrderPayment } from "@/lib/chapa/payment-service"
import { ChapaError } from "@/lib/chapa/client"

const initializeSchema = z.object({
  phoneId: z.string().min(1, "Phone device ID is required"),
  customerName: z.string().min(2, "Customer name must be at least 2 characters"),
  customerPhone: z.string().min(9, "Valid phone number is required"),
  customerEmail: z.string().email("Valid email address is required"),
})

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate customer
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to complete checkout." },
        { status: 401 }
      )
    }

    // 2. Validate request body
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body provided" }, { status: 400 })
    }

    const validation = initializeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      )
    }

    const { phoneId, customerName, customerPhone, customerEmail } = validation.data
    const originUrl = request.nextUrl.origin

    // 3. Initialize payment through service
    const result = await initializeOrderPayment({
      userId: user.id,
      phoneId,
      customerName,
      customerPhone,
      customerEmail,
      originUrl,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error: unknown) {
    console.error("[Chapa Initialize Route Error]:", error)

    const message = error instanceof Error ? error.message : "An unexpected error occurred while initializing your payment."
    const status = (error as any)?.status && (error as any).status >= 400 && (error as any).status < 600
      ? (error as any).status
      : 500

    return NextResponse.json({ error: message }, { status })
  }
}
