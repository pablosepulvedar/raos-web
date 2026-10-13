import { NextResponse } from 'next/server'
import { createAdminClient, getAdminUser } from '@/lib/supabase-server'
import { mpFetch, pasarelaDe } from '@/lib/mercadopago'

type Saldo = { reserva_id: number; empresa_id: string; nombre: string; saldo: number }

// Genera el link de pago de una reserva para mandarlo por WhatsApp.
// El dinero va a la cuenta de Mercado Pago de la empresa, no a la nuestra.
export async function POST(request: Request) {
  const auth = await getAdminUser()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { reserva_id, monto } = await request.json()
  if (!reserva_id) return NextResponse.json({ error: 'Falta reserva_id' }, { status: 400 })

  // RLS: si la reserva no es de su empresa, no existe para este usuario
  const { data: saldoData, error: errSaldo } = await auth.supabase.rpc('saldo_reserva', { p_reserva: reserva_id })
  const saldo = saldoData as Saldo | null
  if (errSaldo || !saldo) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  const aCobrar = Math.round(Number(monto ?? saldo.saldo))
  if (!aCobrar || aCobrar <= 0) {
    return NextResponse.json({ error: 'Esta reserva no tiene saldo por cobrar' }, { status: 400 })
  }

  const pasarela = await pasarelaDe(saldo.empresa_id)
  if (!pasarela?.activo) {
    return NextResponse.json({ error: 'Esta empresa no tiene el cobro en línea configurado' }, { status: 400 })
  }

  const { data: empresa } = await createAdminClient()
    .from('empresas').select('slug, nombre').eq('id', saldo.empresa_id).single()
  const base = (process.env.NEXT_PUBLIC_TENANT_URL ?? '').replace('{slug}', empresa?.slug ?? '')

  const { ok, cuerpo } = await mpFetch(pasarela.access_token, '/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{
        title: `Reserva ${reserva_id} · ${empresa?.nombre ?? ''}`,
        quantity: 1,
        currency_id: 'CLP',
        unit_price: aCobrar,
      }],
      payer: { name: saldo.nombre },
      // Con esto el webhook sabe a qué reserva corresponde el pago
      external_reference: String(reserva_id),
      notification_url: `${base}/api/pagos/webhook/mercadopago`,
      back_urls: { success: `${base}/pago-listo`, pending: `${base}/pago-listo`, failure: `${base}/pago-listo` },
      statement_descriptor: (empresa?.nombre ?? 'Reserva').slice(0, 22),
    }),
  })
  if (!ok) {
    return NextResponse.json({ error: cuerpo.message ?? 'Mercado Pago rechazó la solicitud' }, { status: 502 })
  }

  return NextResponse.json({ url: cuerpo.init_point, sandbox: cuerpo.sandbox_init_point, monto: aCobrar })
}
