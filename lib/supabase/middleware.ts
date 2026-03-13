import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getSupabasePublicEnv,
  logEnvironmentHealthOnce,
} from '@/lib/env'
import { logError, logInfo, logWarn, requestLogContext } from '@/lib/logger'

export async function updateSession(request: NextRequest) {
  logEnvironmentHealthOnce('middleware')

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabasePublicEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    logWarn('Missing Supabase env vars — middleware passing through', {
      ...requestLogContext(request),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseAnonKey: Boolean(supabaseAnonKey),
    })
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const pathname = request.nextUrl.pathname

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

    if (pathname.startsWith('/setup')) {
      return supabaseResponse
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      logWarn('Failed to get user in middleware', {
        ...requestLogContext(request),
        error: userError.message,
      })
    }

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      logInfo('Redirecting unauthenticated user to login', requestLogContext(request))
      return NextResponse.redirect(url)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      logWarn('Failed to load profile role in middleware', {
        ...requestLogContext(request),
        userId: user.id,
        error: profileError.message,
      })
    }

    const role = profile?.role

    if (pathname.startsWith('/supervisor') && role !== 'supervisor') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      logInfo('Redirecting non-supervisor from supervisor route', {
        ...requestLogContext(request),
        userId: user.id,
        role,
      })
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (err) {
    logError('Middleware error; passing request through', err, requestLogContext(request))
    return NextResponse.next({ request })
  }
}
