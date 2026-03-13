import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Guard: if env vars are missing (e.g. not set on Vercel), fail open
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase env vars — middleware passing through')
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const pathname = request.nextUrl.pathname

    // Public routes — pass through without auth check
    if (
      pathname === '/login' ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/') ||
      pathname === '/manifest.webmanifest' ||
      pathname.startsWith('/icons') ||
      pathname === '/sw.js' ||
      pathname === '/favicon.ico'
    ) {
      return supabaseResponse
    }

    // Setup route — protected by secret env var, not auth
    if (pathname.startsWith('/setup')) {
      return supabaseResponse
    }

    // Refresh session — required for Server Components to read auth state
    const { data: { user } } = await supabase.auth.getUser()

    // Unauthenticated users → login
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Get user role for route protection
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Supervisor-only routes
    if (pathname.startsWith('/supervisor') && role !== 'supervisor') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (err) {
    // If middleware throws for any reason, fail open to avoid 500s
    console.error('Middleware error:', err)
    return NextResponse.next({ request })
  }
}
