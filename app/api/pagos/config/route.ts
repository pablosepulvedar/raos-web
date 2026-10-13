import { NextResponse } from 'next/server'
import { createAdminClient, getAdminUser } from '@/lib/supabase-server'
import { cuentaMp, pasarelaDe } from '@/lib/mercadopago'

// La empresa del usuario con sesión: nunca se recibe por parámetro
async function miEmpresa() {
  const auth = await getAdminUser()
  if (!auth) return null
  const { data } = await auth.supabase.rpc('mi_empresa_id')
  return data ? { empresaId: data as string } : null
}

// Qué hay configurado. El access_token no se devuelve nunca: solo si existe.
export async function GET() {
  const yo = await miEmpresa()
  if (!yo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const p = await pasarelaDe(yo.empresaId)
  return NextResponse.json({
    configurado: !!p,
    activo: p?.activo ?? false,
    public_key: p?.public_key ?? '',
    token_termina_en: p ? p.access_token.slice(-6) : null,
  })
}

// Guarda las credenciales. Antes de guardarlas, se prueban contra Mercado Pago.
export async function PUT(request: Request) {
  const yo = await miEmpresa()
  if (!yo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { public_key, access_token, activo } = await request.json()
  const admin = createAdminClient()

  if (access_token) {
    const prueba = await cuentaMp(access_token)
    if (!prueba.ok) {
      return NextResponse.json({ error: 'Mercado Pago rechazó ese access token' }, { status: 400 })
    }
    const { error } = await admin.from('pasarelas_pago').upsert({
      empresa_id: yo.empresaId,
      proveedor: 'mercadopago',
      public_key: public_key ?? null,
      access_token,
      activo: activo ?? true,
      actualizado_at: new Date().toISOString(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, cuenta: prueba.cuerpo.nickname ?? prueba.cuerpo.email ?? null })
  }

  // Sin token nuevo: solo prende o apaga el cobro en línea
  const { error } = await admin
    .from('pasarelas_pago')
    .update({ activo: !!activo, public_key: public_key ?? null, actualizado_at: new Date().toISOString() })
    .eq('empresa_id', yo.empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const yo = await miEmpresa()
  if (!yo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { error } = await createAdminClient().from('pasarelas_pago').delete().eq('empresa_id', yo.empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
