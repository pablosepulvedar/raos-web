import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
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
    .select('roles(nombre)')
    .eq('perfil_id', data.user.id)
  const nombres: string[] = (roles || []).map((r: any) => r.roles?.nombre?.toLowerCase() ?? '')
  const restringidos = ['piloto', 'coordinador']
  if (nombres.length > 0 && nombres.every(n => restringidos.includes(n))) return null

  return data.user
}
