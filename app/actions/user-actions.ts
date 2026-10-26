"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { User } from "@/lib/types"

export async function getUsers() {
    try {
        const supabase = await createClient()

        // Fetch users from 'user_profiles' table which contains email and role
        const { data: users, error } = await supabase
            .from("user_profiles")
            .select("*")
            .order("created_at", { ascending: false })

        if (error) {
            console.error("Error fetching users:", error)
            return { success: false, error: error.message }
        }

        return { success: true, users: users as User[] }
    } catch (error) {
        console.error("Unexpected error fetching users:", error)
        return { success: false, error: "Failed to fetch users" }
    }
}

export async function deleteUser(userId: string) {
    try {
        const supabaseAdmin = createAdminClient()

        // 1. Delete from Supabase Auth (admin privilege required)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (authError) {
            console.error("Error deleting user from auth:", authError)
            return { success: false, error: authError.message }
        }

        // 2. Delete from user_profiles table (should cascade, but good to ensure/handle if not)
        const supabase = await createClient()
        const { error: dbError } = await supabase.from("user_profiles").delete().eq("id", userId)

        if (dbError) {
            console.warn("User deleted from Auth but failed to remove from user_profiles (might have cascaded):", dbError)
        }

        return { success: true }
    } catch (error) {
        console.error("Unexpected error deleting user:", error)
        return { success: false, error: "Failed to delete user" }
    }
}

export async function resetUserPassword(email: string) {
    try {
        const supabaseAdmin = createAdminClient()

        const appUrl = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? "http://localhost:3002"

        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${appUrl}/auth/callback`,
        })

        if (error) {
            console.error("Error sending reset password email:", error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error) {
        console.error("Unexpected error resetting password:", error)
        return { success: false, error: "Failed to send reset email" }
    }
}

export async function createAdminAccount(data: { email: string; password: string }) {
    try {
        const supabaseAdmin = createAdminClient()

        // 1. Create the user in Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: { role: "admin" }
        })

        if (authError) {
            console.error("Error creating admin user:", authError)
            return { success: false, error: authError.message }
        }

        if (!authData.user) {
            return { success: false, error: "Failed to create user" }
        }

        // 2. The trigger should automatically create the user_profile, 
        // but we ensure the role is set correctly if needed (though the trigger should handle it from metadata)
        // Let's explicitly update it to be sure
        const supabase = await createClient()
        const { error: profileError } = await supabase
            .from("user_profiles")
            .update({ role: "admin" })
            .eq("id", authData.user.id)

        if (profileError) {
            console.error("Error updating admin role profile:", profileError)
            // We don't necessarily fail here if the user was created in Auth
        }

        return { success: true, user: authData.user }
    } catch (error) {
        console.error("Unexpected error creating admin:", error)
        return { success: false, error: "Failed to create admin account" }
    }
}
