import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/supabase-server'
import { googleConfigurado, urlDeConsentimiento } from '@/lib/google-calendar'
import { firmarEstado } from '@/lib/oauth-estado'

// Manda al usuario a autorizar su calendario. La empresa y el subdominio desde el
// que salió viajan firmados en el state: la vuelta de Google llega a un host fijo,
// donde ya no hay sesión (ver lib/google-calendar.ts).
export async function GET(req: NextRequest) {
  const auth = await getAdminUser()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (!googleConfigurado()) {
    return NextResponse.redirect(new URL('/varios/calendar?error=sin_configurar', req.url))
  }

  const { data: empresaId } = await auth.supabase.rpc('mi_empresa_id')
  if (!empresaId) {
    return NextResponse.redirect(new URL('/varios/calendar?error=sin_empresa', req.url))
  }

  const state = await firmarEstado(empresaId as string, req.nextUrl.origin)
  return NextResponse.redirect(urlDeConsentimiento(state))
}
