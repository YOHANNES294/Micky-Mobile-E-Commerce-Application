"use server"

import { createClient } from "@/lib/supabase/server"

export async function createDefaultAdmin() {
  const defaultEmail = "yohannesm294@gmail.com"
  const defaultPassword = "Admin@1234"

  try {
    const supabase = await createClient()

    const { data: existingUser } = await supabase
      .from("user_profiles")
      .select("email, role")
      .eq("email", defaultEmail)
      .maybeSingle()

    if (existingUser) {
      return {
        success: true,
        message: "Default admin already exists",
        alreadyExists: true,
      }
    }

    // Create the admin user using Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: defaultEmail,
      password: defaultPassword,
      options: {
        data: {
          role: "admin",
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/admin`,
      },
    })

    if (signUpError) {
      console.error("[v0] Error creating default admin:", signUpError)
      return {
        success: false,
        message: signUpError.message,
      }
    }

    // The trigger should automatically create the user_profile
    // But let's ensure the role is set to admin
    if (signUpData.user) {
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ role: "admin" })
        .eq("id", signUpData.user.id)

      if (updateError) {
        console.error("[v0] Error updating admin role:", updateError)
      }
    }

    return {
      success: true,
      message: "Default admin created successfully",
      email: defaultEmail,
      password: defaultPassword,
    }
  } catch (error) {
    console.error("[v0] Unexpected error creating default admin:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export async function checkDefaultAdminExists() {
  try {
    const supabase = await createClient()

    const { data } = await supabase
      .from("user_profiles")
      .select("email, role")
      .eq("email", "yohannesm294@gmail.com")
      .eq("role", "admin")
      .maybeSingle()

    return { exists: !!data }
  } catch {
    return { exists: false }
  }
}
