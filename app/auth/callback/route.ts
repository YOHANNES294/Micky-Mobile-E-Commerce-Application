import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (code) {
        const supabase = await createClient()
        const { error, data } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.user) {
            // Check or ensure user profile exists
            let { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', data.user.id)
                .maybeSingle()

            const isAdmin = data.user.email === 'yohannesm294@gmail.com'

            if (!profile && data.user.email) {
                const { data: newProfile } = await supabase
                    .from('user_profiles')
                    .insert({
                        id: data.user.id,
                        email: data.user.email,
                        role: isAdmin ? 'admin' : 'client'
                    })
                    .select('role')
                    .maybeSingle()
                profile = newProfile
            }

            if (profile?.role === 'admin' || isAdmin) {
                return NextResponse.redirect(`${origin}/admin`)
            } else {
                return NextResponse.redirect(`${origin}/client`)
            }
        }
    }

    // return the user to login with error parameter
    return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate user`)
}
