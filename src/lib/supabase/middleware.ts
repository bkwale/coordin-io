import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEMO_COOKIE = 'coordin_demo_start'
const DEMO_DURATION_MS = 10 * 60 * 1000 // 10 minutes

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

  // 1. Allow public routes, API routes, auth callbacks, activation links, and static assets
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/activate/')
  ) {
    return NextResponse.next()
  }

  // 2. Active demo — cookie-based 10-minute pass (no auth required)
  const demoCookie = request.cookies.get(DEMO_COOKIE)?.value
  if (demoCookie) {
    const demoStart = parseInt(demoCookie, 10)
    if (!isNaN(demoStart) && Date.now() - demoStart < DEMO_DURATION_MS) {
      // Demo still active — allow through without auth
      return NextResponse.next()
    }
    // Demo expired — clear cookie and redirect to signup
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    const expiredResponse = NextResponse.redirect(url)
    expiredResponse.cookies.set(DEMO_COOKIE, '', { path: '/', maxAge: 0 })
    return expiredResponse
  }

  // 3. Skip auth entirely if Supabase isn't configured (local dev without env vars)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR_PROJECT')
  ) {
    return NextResponse.next()
  }

  // 4. Supabase is configured — check auth
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
