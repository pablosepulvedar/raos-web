import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { mpFetch, pasarelaDe } from '@/lib/mercadopago'

// Mercado Pago avisa acá cuando alguien paga. La empresa sale del subdominio
// (cada una recibe el aviso en su propia URL), nunca del cuerpo del mensaje.
export async function POST(request: Request) {
  const slug = (request.headers.get('host') ?? '').split('.')[0]
  const cuerpo = await request.json().catch(() => null)
  const pagoId = cuerpo?.data?.id ?? new URL(request.url).searchParams.get('data.id')

  // A un aviso que no entendemos se le responde 200: si no, Mercado Pago reintenta para siempre
  if (!pagoId || (cuerpo?.type && cuerpo.type !== 'payment')) {
    return NextResponse.json({ ignorado: true })
  }

  const admin = createAdminClient()
  const { data: empresaId } = await admin.rpc('empresa_por_slug', { p_slug: slug })
  if (!empresaId) return NextResponse.json({ ignorado: 'empresa desconocida' })

  const pasarela = await pasarelaDe(empresaId as string)
  if (!pasarela?.activo) return NextResponse.json({ ignorado: 'sin pasarela' })

  // No se confía en el aviso: se le pregunta a Mercado Pago cuánto se pagó de verdad
  const { ok, cuerpo: pago } = await mpFetch(pasarela.access_token, `/v1/payments/${pagoId}`)
  if (!ok) return NextResponse.json({ ignorado: 'pago no encontrado' })
  if (pago.status !== 'approved') return NextResponse.json({ ignorado: `estado ${pago.status}` })

  const reservaId = Number(pago.external_reference)
  const monto = Math.round(Number(pago.transaction_amount ?? 0))
  if (!reservaId || monto <= 0) return NextResponse.json({ ignorado: 'sin reserva o sin monto' })

  const { data, error } = await admin.rpc('registrar_pago_externo', {
    p_empresa: empresaId,
    p_reserva: reservaId,
    p_monto: monto,
    p_metodo: 'Mercado Pago',
    p_externo: `mp-${pagoId}`,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
