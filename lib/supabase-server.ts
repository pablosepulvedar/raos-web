import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { slugDelHost } from './empresa-host'

export async function createClient() {
  const cookieStore = await cookies()
  // La misma cabecera que manda el navegador, para que el servidor hable de la
  // misma empresa que la pantalla
  const empresa = slugDelHost((await headers()).get('host'))

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(empresa ? { global: { headers: { 'x-empresa': empresa } } } : {}),
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
            // En Server Components el set es ignorado — OK
          }
        },
      },
    }
  )
}

// Devuelve el usuario si está logueado y no tiene solo roles restringidos (piloto/coordinador)
export async function getAdminUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null

  const { data: roles } = await supabase
    .from('perfil_roles')
    .select('roles(restringido)')
    .eq('perfil_id', data.user.id)
  // restringido lo marca la tabla roles: el piloto del parapente es el guía del rafting
  const marcas: boolean[] = (roles || []).map((r: { roles: { restringido?: boolean } | { restringido?: boolean }[] | null }) =>
    (Array.isArray(r.roles) ? r.roles[0] : r.roles)?.restringido === true)
  if (marcas.length > 0 && marcas.every(Boolean)) return null

  // supabase con la sesión del usuario: RLS limita todo a su empresa
  return { user: data.user, supabase }
}

export async function getSuperadmin() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  const { data: esSuper } = await supabase.rpc('es_superadmin')
  return esSuper ? { user: data.user, supabase } : null
}

// Cliente service_role: se salta RLS, filtrar siempre por lo que ve el usuario
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
