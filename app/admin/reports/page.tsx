import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReportsDashboard } from "@/components/admin/reports-dashboard"

export default async function ReportsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: userData } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

  if (userData?.role !== "admin") {
    redirect("/client")
  }

  // Fetch all phones with sales data
  const { data: phones } = await supabase.from("phones").select("*").order("created_at", { ascending: false })

  // Fetch sales data
  const { data: sales } = await supabase
    .from("sales")
    .select(`
      *,
      phones:phone_id (
        model,
        brand,
        price
      )
    `)
    .order("sale_date", { ascending: false })

  return <ReportsDashboard phones={phones || []} sales={sales || []} userEmail={user.email || ""} />
}
