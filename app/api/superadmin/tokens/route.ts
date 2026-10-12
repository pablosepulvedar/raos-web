import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getSuperadmin } from '@/lib/supabase-server'
import { hashToken, nuevoToken } from '@/lib/api-token'

// Lista los tokens de API de una empresa (nunca el token completo: solo el prefijo)
export async function GET(request: NextRequest) {
  if (!(await getSuperadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const empresa = request.nextUrl.searchParams.get('empresa')
  if (!empresa) return NextResponse.json({ error: 'Falta empresa' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('api_tokens')
    .select('id, nombre, prefijo, creado_at, ultimo_uso_at, revocado_at')
    .eq('empresa_id', empresa)
    .order('creado_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Crea uno nuevo. El token se muestra UNA vez: en la base solo queda su hash.
export async function POST(request: NextRequest) {
  if (!(await getSuperadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { empresa_id, nombre } = await request.json()
  if (!empresa_id || !nombre?.trim()) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const token = nuevoToken()
  const { error } = await createAdminClient().from('api_tokens').insert({
    empresa_id,
    nombre: nombre.trim(),
    prefijo: token.slice(0, 12),
    token_hash: await hashToken(token),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token })
}

// Revocar (no se borra: queda el registro de que existió)
export async function DELETE(request: NextRequest) {
  if (!(await getSuperadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('api_tokens').update({ revocado_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
