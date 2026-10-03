import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getAdminUser } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const caller = await getAdminUser()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { userId, password } = await request.json()
  if (!userId || !password) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // RLS: solo encuentra el perfil si es de la misma empresa
  const { data: perfil } = await caller.supabase.from('perfiles').select('id').eq('id', userId).maybeSingle()
  if (!perfil) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
