import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getSuperadmin } from '@/lib/supabase-server'

// Crea usuario de auth + perfil con roles en cualquier empresa
export async function POST(request: NextRequest) {
  const caller = await getSuperadmin()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { empresa_id, email, password, nombre, roles } = await request.json()
  if (!empresa_id || !email || !password || !nombre) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { error: perfilError } = await caller.supabase.rpc('sa_crear_perfil', {
    p_user: data.user.id, p_empresa: empresa_id, p_nombre: nombre, p_roles: roles ?? [],
  })
  if (perfilError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: perfilError.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.user.id })
}

// Cambia contraseña y/o bloquea/desbloquea
export async function PATCH(request: NextRequest) {
  const caller = await getSuperadmin()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id, password, bloquear } = await request.json()
  if (!id) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  if (id === caller.user.id && bloquear) {
    return NextResponse.json({ error: 'No puedes bloquearte a ti mismo' }, { status: 400 })
  }

  const cambios: { password?: string; ban_duration?: string } = {}
  if (password) cambios.password = password
  if (bloquear !== undefined) cambios.ban_duration = bloquear ? '876000h' : 'none'

  const { error } = await createAdminClient().auth.admin.updateUserById(id, cambios)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
