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

// Crea usuario + perfil en la empresa de quien lo crea
export async function POST(request: NextRequest) {
  const caller = await getAdminUser()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { email, password, nombre } = await request.json()
  if (!email || !password || !nombre) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // insert con la sesión del creador: empresa_id toma su empresa por default
  const { error: perfilError } = await caller.supabase
    .from('perfiles')
    .insert({ id: data.user.id, nombre, activo: true })
  if (perfilError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: perfilError.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.user.id })
}
