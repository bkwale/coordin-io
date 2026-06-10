import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Auth callback handler.
 *
 * Supabase sends users here after email confirmation (signup) or
 * magic-link login. The URL contains a `code` query param that
 * we exchange for a session.
 *
 * Flow: Supabase email link → /auth/callback?code=xxx → exchange → redirect to /dashboard
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Called from Server Component context — ignore
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful — redirect to the intended destination
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  // If no code or exchange failed, redirect to login with error hint
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
