import { NextResponse } from 'next/server'
import { empresaDelToken } from '@/lib/api-token'

// Horarios, servicios y métodos de pago de la empresa, para armar el formulario de su web
export async function GET(request: Request) {
  const auth = await empresaDelToken(request)
  if (!auth) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data, error } = await auth.admin.rpc('api_catalogo', { p_empresa: auth.empresaId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
