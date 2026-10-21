import { NextResponse } from 'next/server'
import { createAdminClient, getAdminUser } from '@/lib/supabase-server'
import { accessToken, conexionDe, googleConfigurado, listarCalendarios } from '@/lib/google-calendar'
import { PLANTILLAS } from '@/lib/calendar-plantillas'

// La empresa del usuario con sesión: nunca se recibe por parámetro
async function miEmpresa() {
  const auth = await getAdminUser()
  if (!auth) return null
  const { data } = await auth.supabase.rpc('mi_empresa_id')
  return data ? (data as string) : null
}

// Estado de la conexión. El refresh_token no sale nunca de acá.
export async function GET() {
  const empresaId = await miEmpresa()
  if (!empresaId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const c = await conexionDe(empresaId)
  if (!c) {
    return NextResponse.json({
      disponible: googleConfigurado(), conectado: false,
      plantillas: PLANTILLAS, calendarios: [],
    })
  }

  // Los calendarios de la cuenta, para poder cambiar de uno a otro
  let calendarios: Array<{ id: string; nombre: string; principal: boolean }> = []
  let expirada = false
  try {
    calendarios = await listarCalendarios(await accessToken(c.refresh_token))
  } catch {
    expirada = true
  }

  return NextResponse.json({
    disponible: googleConfigurado(),
    conectado: true,
    expirada,
    cuenta: c.cuenta_email,
    calendario_id: c.calendario_id,
    calendario_nombre: c.calendario_nombre,
    plantilla: c.plantilla,
    patron_titulo: c.patron_titulo,
    plantillas: PLANTILLAS,
    calendarios,
  })
}

// Guarda el calendario elegido y la plantilla con la que se leen sus eventos
export async function PUT(request: Request) {
  const empresaId = await miEmpresa()
  if (!empresaId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { calendario_id, calendario_nombre, plantilla, patron_titulo } = await request.json()
  if (plantilla && !PLANTILLAS.some(p => p.id === plantilla)) {
    return NextResponse.json({ error: 'Plantilla desconocida' }, { status: 400 })
  }
  if (plantilla === 'libre' && !String(patron_titulo ?? '').includes('{nombre}')) {
    return NextResponse.json({ error: 'El formato propio tiene que incluir {nombre}' }, { status: 400 })
  }

  const { error } = await createAdminClient()
    .from('calendar_conexiones')
    .update({
      ...(calendario_id ? { calendario_id, calendario_nombre: calendario_nombre ?? null } : {}),
      ...(plantilla ? { plantilla, patron_titulo: plantilla === 'libre' ? patron_titulo : null } : {}),
      actualizado_at: new Date().toISOString(),
    })
    .eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Desconectar: se borra el refresh_token, no queda acceso al calendario
export async function DELETE() {
  const empresaId = await miEmpresa()
  if (!empresaId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { error } = await createAdminClient()
    .from('calendar_conexiones').delete().eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
