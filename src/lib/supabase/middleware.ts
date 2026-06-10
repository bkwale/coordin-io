import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = [
  '/',
  '/welcome',
  '/faq',
  '/demo-access',
  '/use-cases',
  '/features/brpd',
  '/features/quotes',
  '/book-demo',
  '/login',
  '/signup',
  '/forgot-password',
]

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes, API routes, auth callbacks, and static assets
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next()
  }

  // Demo mode — skip auth entirely if Supabase isn't configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR_PROJECT')
  ) {
    return NextResponse.next()
  }

  // Supabase is configured — check auth
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
