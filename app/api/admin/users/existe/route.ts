import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getAdminUser } from '@/lib/supabase-server'

// ¿Ese correo ya tiene cuenta en el sistema?
//
// Sirve para avisar antes de guardar, en vez de después: si existe, no se crea
// nada nuevo ni se le toca la contraseña, se le dan roles en esta empresa.
//
// Solo responde a quien administra una empresa. Revela lo mismo que ya revelaba
// el aviso al guardar: que ese correo existe. No dice de quién es ni dónde
// trabaja.
export async function GET(request: NextRequest) {
  const caller = await getAdminUser()
  if (!caller) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const correo = (request.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()
  if (!correo.includes('@')) return NextResponse.json({ existe: false })

  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ existe: false })

  return NextResponse.json({ existe: data.users.some(u => u.email?.toLowerCase() === correo) })
}
