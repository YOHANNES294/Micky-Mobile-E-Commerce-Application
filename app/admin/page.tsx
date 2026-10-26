import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

  if (userData?.role !== "admin") {
    redirect("/client")
  }

  // Fetch all phones
  const { data: phones } = await supabase.from("phones").select("*").order("created_at", { ascending: false })

  return <AdminDashboard initialPhones={phones || []} userEmail={user.email || ""} />
}
