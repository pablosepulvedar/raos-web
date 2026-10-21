import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/supabase-server'
import { accessToken, conexionDe, eventosDelDia, eventosProximos } from '@/lib/google-calendar'
import { leerEvento } from '@/lib/calendar-plantillas'

// Los eventos del calendario de la empresa, ya leídos con su plantilla.
//   ?fecha=YYYY-MM-DD   el día que se quiere importar
//   ?proximos=1         los que vienen, para la vista previa de la plantilla
//   ?plantilla= &patron=  para probar una plantilla antes de guardarla
export async function GET(req: NextRequest) {
  const auth = await getAdminUser()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data: empresaId } = await auth.supabase.rpc('mi_empresa_id')
  if (!empresaId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const conexion = await conexionDe(empresaId as string)
  if (!conexion) return NextResponse.json({ error: 'no_conectado' }, { status: 409 })

  const q = req.nextUrl.searchParams
  const fecha = q.get('fecha')
  const proximos = q.get('proximos')
  if (!fecha && !proximos) return NextResponse.json({ error: 'falta fecha' }, { status: 400 })

  // La plantilla guardada, salvo que se esté probando otra desde la configuración
  const plantilla = q.get('plantilla') ?? conexion.plantilla
  const patron = q.get('patron') ?? conexion.patron_titulo

  try {
    const token = await accessToken(conexion.refresh_token)
    const crudos = proximos
      ? await eventosProximos(token, conexion.calendario_id)
      : await eventosDelDia(token, conexion.calendario_id, fecha!)

    const eventos = crudos.map(ev => {
      const leido = leerEvento(ev.titulo, ev.descripcion, plantilla, patron)
      return {
        googleId: ev.id,
        titulo: ev.titulo,
        fecha: ev.fecha,
        // La hora del evento manda sobre la que diga el título
        horaStr: ev.horaStr ?? leido.horaStr,
        nombre: leido.nombre,
        cantidad: leido.cantidad,
        telefono: leido.telefono,
        abono: leido.abono,
        pasajeros: leido.pasajeros,
        dudoso: leido.dudoso,
      }
    })

    return NextResponse.json({ eventos, plantilla })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    // El refresh_token puede quedar inválido si la empresa quita el permiso en Google
    if (/invalid_grant|unauthorized/i.test(msg)) {
      return NextResponse.json({ error: 'no_conectado' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
