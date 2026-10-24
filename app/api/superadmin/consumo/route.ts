import { NextResponse } from 'next/server'
import { getSuperadmin } from '@/lib/supabase-server'
import { LIMITE_SUPABASE, agruparHosts, consumoCloudflare, consumoConfigurado } from '@/lib/consumo'
import { hostConocido } from '@/lib/hosts'

// Principal: el dominio, www (la landing) y lo que el filtro de subdominios deja pasar
// (empresas activas, admin y auth). El resto son nombres que no existen.
async function principales(nombres: string[]) {
  const ok = new Set<string>()
  for (const h of nombres) {
    if (h === 'reservaps.cl' || h === 'www.reservaps.cl' || (h.endsWith('.reservaps.cl') && await hostConocido(h))) ok.add(h)
  }
  return ok
}

type UsoDb = { total: number; tablas: Array<{ tabla: string; bytes: number; filas: number }> }

// Consumo de la infraestructura. Las dos fuentes se piden en paralelo y cada una
// falla por su cuenta: que no haya token de Cloudflare no debe tapar el peso de la base.
export async function GET() {
  const auth = await getSuperadmin()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [cf, db] = await Promise.all([
    consumoConfigurado()
      ? consumoCloudflare().then(async d => {
          const ok = await principales(d.hosts.map(h => h.nombre))
          return { ok: true as const, ...d, hosts: agruparHosts(d.hosts, h => ok.has(h)) }
        }).catch(e => ({ ok: false as const, error: String(e.message ?? e) }))
      : Promise.resolve({ ok: false as const, error: 'sin_token' }),
    auth.supabase.rpc('sa_uso_db').then(({ data, error }) =>
      error ? { ok: false as const, error: error.message } : { ok: true as const, ...(data as UsoDb) }),
  ])

  return NextResponse.json({ cloudflare: cf, supabase: { ...db, limite: LIMITE_SUPABASE } })
}
