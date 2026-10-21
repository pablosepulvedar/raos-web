import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { canjearCodigo, correoDeLaCuenta, listarCalendarios } from '@/lib/google-calendar'
import { leerEstado } from '@/lib/oauth-estado'

// Vuelta de Google. Llega al host fijo de GOOGLE_REDIRECT_URI, no al subdominio de
// la empresa, así que acá no hay sesión: la empresa sale del state firmado y el
// usuario se devuelve a su propio subdominio.
export async function GET(req: NextRequest) {
  const estado = await leerEstado(req.nextUrl.searchParams.get('state'))
  // Sin state válido no se sabe a dónde devolver: se responde en el mismo host
  const volver = (params: string) =>
    NextResponse.redirect(new URL(`/varios/calendar${params}`, estado?.o ?? req.nextUrl.origin))

  if (!estado) return volver('?error=state')
  if (req.nextUrl.searchParams.get('error')) return volver('?error=cancelado')
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return volver('?error=sin_codigo')

  try {
    const tokens = await canjearCodigo(code)
    if (!tokens.refresh_token) return volver('?error=sin_refresh')

    const correo = await correoDeLaCuenta(tokens.access_token)
    const calendarios = await listarCalendarios(tokens.access_token)
    const principal = calendarios.find(c => c.principal) ?? calendarios[0]

    const { error } = await createAdminClient().from('calendar_conexiones').upsert({
      empresa_id: estado.e,
      refresh_token: tokens.refresh_token,
      cuenta_email: correo,
      calendario_id: principal?.id ?? 'primary',
      calendario_nombre: principal?.nombre ?? null,
      actualizado_at: new Date().toISOString(),
    })
    if (error) return volver('?error=guardar')
  } catch {
    return volver('?error=google')
  }

  return volver('?conectado=1')
}
