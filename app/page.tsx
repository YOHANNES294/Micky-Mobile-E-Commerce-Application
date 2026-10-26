import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()

  // If user is already authenticated, route directly according to their role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.role === "admin") {
      redirect("/admin")
    }
    redirect("/client")
  }

  const { data: adminExists, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", "yohannesm294@gmail.com")
    .eq("role", "admin")
    .maybeSingle()

  // If no admin exists, redirect to setup page
  if (!adminExists || error) {
    redirect("/setup")
  }

  // Otherwise, redirect to login page
  redirect("/auth/login")
}
