import { NextResponse } from 'next/server'
import { getSuperadmin } from '@/lib/supabase-server'
import { LIMITE_SUPABASE, consumoCloudflare, consumoConfigurado } from '@/lib/consumo'

type UsoDb = { total: number; tablas: Array<{ tabla: string; bytes: number; filas: number }> }

// Consumo de la infraestructura. Las dos fuentes se piden en paralelo y cada una
// falla por su cuenta: que no haya token de Cloudflare no debe tapar el peso de la base.
export async function GET() {
  const auth = await getSuperadmin()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [cf, db] = await Promise.all([
    consumoConfigurado()
      ? consumoCloudflare().then(d => ({ ok: true as const, ...d })).catch(e => ({ ok: false as const, error: String(e.message ?? e) }))
      : Promise.resolve({ ok: false as const, error: 'sin_token' }),
    auth.supabase.rpc('sa_uso_db').then(({ data, error }) =>
      error ? { ok: false as const, error: error.message } : { ok: true as const, ...(data as UsoDb) }),
  ])

  return NextResponse.json({ cloudflare: cf, supabase: { ...db, limite: LIMITE_SUPABASE } })
}
