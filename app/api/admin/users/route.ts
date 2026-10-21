import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getAdminUser } from '@/lib/supabase-server'

export async function GET() {
  const caller = await getAdminUser()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Solo emails de perfiles de la empresa del usuario (RLS)
  const { data: perfiles } = await caller.supabase.from('perfiles').select('id')
  const ids = new Set((perfiles || []).map(p => p.id))

  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = data.users.filter(u => ids.has(u.id)).map(u => ({ id: u.id, email: u.email ?? '' }))
  return NextResponse.json(users)
}

// Da de alta a alguien en la empresa de quien lo crea.
//
// Si el correo ya existe, esa persona trabaja en otra empresa: no se crea una
// cuenta nueva ni se le toca la contraseña, se le dan roles en esta. Su historial
// en la otra empresa queda intacto y ninguna de las dos ve a la otra.
export async function POST(request: NextRequest) {
  const caller = await getAdminUser()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { email, password, nombre } = await request.json()
  if (!email || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const admin = createAdminClient()
  const correo = String(email).trim().toLowerCase()

  const { data: lista, error: listaError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listaError) return NextResponse.json({ error: listaError.message }, { status: 500 })
  const existente = lista.users.find(u => u.email?.toLowerCase() === correo)

  let userId = existente?.id
  if (!existente) {
    if (!password) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    const { data, error } = await admin.auth.admin.createUser({
      email: correo, password, email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    userId = data.user.id
  }

  const { error: perfilError } = await caller.supabase.rpc('vincular_perfil', {
    p_user: userId, p_nombre: nombre,
  })
  if (perfilError) {
    // Si la cuenta se acaba de crear y no pudo entrar a la empresa, no dejarla suelta
    if (!existente && userId) await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: perfilError.message }, { status: 500 })
  }

  return NextResponse.json({ id: userId, vinculado: !!existente })
}
