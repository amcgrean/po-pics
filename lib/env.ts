import { logInfo, logWarn } from './logger'

let hasLoggedEnvironment = false

function readEnv(name: string): string | undefined {
  const rawValue = process.env[name]
  if (typeof rawValue !== 'string') {
    return undefined
  }

  const trimmedValue = rawValue.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

export function getEnv(name: string): string | undefined {
  return readEnv(name)
}

export function getSupabasePublicEnv() {
  return {
    url: readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

export function hasSupabasePublicEnv() {
  const { url, anonKey } = getSupabasePublicEnv()
  return Boolean(url && anonKey)
}

export function logEnvironmentHealthOnce(source: string) {
  if (hasLoggedEnvironment) {
    return
  }

  const { url, anonKey } = getSupabasePublicEnv()
  const serviceRole = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  const setupSecret = readEnv('SETUP_SECRET')

  logInfo(`Environment health snapshot from ${source}`, {
    hasSupabaseUrl: Boolean(url),
    hasSupabaseAnonKey: Boolean(anonKey),
    hasServiceRoleKey: Boolean(serviceRole),
    hasSetupSecret: Boolean(setupSecret),
  })

  if (!url || !anonKey) {
    logWarn('Missing public Supabase env vars; auth-dependent flows may fail')
  }

  hasLoggedEnvironment = true
}
