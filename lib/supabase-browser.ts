import { createBrowserClient } from '@supabase/ssr'
import { slugDelHost } from './empresa-host'

export function createClient() {
  // La empresa de la que habla esta pestaña, en cada petición: ver lib/empresa-host.ts
  const empresa = typeof window === 'undefined' ? '' : slugDelHost(window.location.hostname)

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    empresa ? { global: { headers: { 'x-empresa': empresa } } } : undefined
  )
}
