import { NextResponse } from 'next/server'
import { empresaDelToken, urlEmpresa } from '@/lib/api-token'

const error = (texto: string, status = 400) => NextResponse.json({ error: texto }, { status })
const slug = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Crea una reserva desde la web del cliente, típicamente al confirmarse el pago.
// Toda la escritura ocurre en api_reserva(), en una sola transacción.
export async function POST(request: Request) {
  const auth = await empresaDelToken(request)
  if (!auth) return error('Token inválido', 401)

  const body = await request.json().catch(() => null)
  if (!body) return error('Body JSON inválido')

  const nombre = String(body.nombre ?? '').trim()
  const telefono = String(body.telefono ?? '').replace(/[^0-9]/g, '')
  const cantidad = Number(body.cantidad)
  if (!nombre) return error('Falta nombre')
  if (!telefono) return error('Falta telefono')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha ?? ''))) return error('fecha debe ser YYYY-MM-DD')
  if (!Number.isInteger(cantidad) || cantidad < 1) return error('cantidad debe ser un entero mayor a 0')

  const { data, error: err } = await auth.admin.rpc('api_reserva', {
    p_empresa: auth.empresaId,
    p_datos: { ...body, nombre, telefono, cantidad },
  })
  // P0001 = validación de la función (horario, servicios, método de pago)
  if (err) return error(err.message, err.code === 'P0001' ? 400 : 500)

  const base = urlEmpresa(auth.slug)
  const fichas = ((data.fichas ?? []) as { nombre: string | null; token: string }[]).map((f) => ({
    nombre: f.nombre,
    url: `${base}/ficha/${f.token}${f.nombre ? '/' + slug(f.nombre) : ''}`,
  }))

  return NextResponse.json({ id: data.id, creada: data.creada, fichas }, { status: data.creada ? 201 : 200 })
}
