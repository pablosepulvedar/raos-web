'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { May, useJerga } from '@/lib/jerga'
import Cargando from '@/components/Cargando'
import Rango, { mesActual, type Periodo } from './Rango'

const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`
const fmtDia = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })

type Dia = { fecha: string; vuelos: number; cobrado: number; pilotos: number; gastos: number }
type Reserva = { id: number; fecha: string; reserva_pagos?: { monto: number }[] }
type PorFecha = { fecha: string; monto: number; tipo?: string }
type Persona = { reserva_id: number }

export default function ResumenPeriodo() {
  const j = useJerga()
  const sb = useRef(createClient()).current
  const [p, setP] = useState<Periodo>(mesActual)
  const [dias, setDias] = useState<Dia[]>([])
  const [cargando, setCargando] = useState(true)

  const traer = async () => {
    setCargando(true)
    const { data: crudas } = await sb
      .from('reservas').select('id, fecha, cantidad, reserva_pagos(monto)')
      .gte('fecha', p.desde).lte('fecha', p.hasta)
    const reservas = (crudas ?? []) as unknown as Reserva[]
    const ids = reservas.map(r => r.id)

    const [{ data: pagosPilotos }, { data: gastos }, { data: personas }] = await Promise.all([
      sb.from('piloto_pagos').select('fecha, monto').gte('fecha', p.desde).lte('fecha', p.hasta),
      sb.from('gastos_diarios').select('fecha, monto, tipo').gte('fecha', p.desde).lte('fecha', p.hasta),
      ids.length ? sb.from('reservas_personas').select('reserva_id, perfil_id').in('reserva_id', ids).not('perfil_id', 'is', null)
                 : Promise.resolve({ data: [] as unknown[] }),
    ])

    // Los vuelos se cuentan por pasajero con guía asignado, igual que el cuadre del día
    const fechaDe: Record<number, string> = {}
    reservas.forEach(r => { fechaDe[r.id] = r.fecha })

    const mapa: Record<string, Dia> = {}
    const fila = (f: string) => (mapa[f] ??= { fecha: f, vuelos: 0, cobrado: 0, pilotos: 0, gastos: 0 })
    reservas.forEach(r =>
      fila(r.fecha).cobrado += (r.reserva_pagos ?? []).reduce((s, x) => s + x.monto, 0))
    ;((personas ?? []) as unknown as Persona[]).forEach(x => { const f = fechaDe[x.reserva_id]; if (f) fila(f).vuelos++ })
    ;((pagosPilotos ?? []) as unknown as PorFecha[]).forEach(x => { fila(x.fecha).pilotos += x.monto })
    ;((gastos ?? []) as unknown as PorFecha[]).forEach(x => { fila(x.fecha).gastos += x.tipo === 'gasto' ? x.monto : -x.monto })

    setDias(Object.values(mapa).sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setCargando(false)
  }

  useEffect(() => { traer() }, [p.desde, p.hasta])

  const tot = dias.reduce((a, d) => ({
    vuelos: a.vuelos + d.vuelos, cobrado: a.cobrado + d.cobrado,
    pilotos: a.pilotos + d.pilotos, gastos: a.gastos + d.gastos,
  }), { vuelos: 0, cobrado: 0, pilotos: 0, gastos: 0 })
  const neto = tot.cobrado - tot.pilotos - tot.gastos

  return (
    <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4">
      <Rango valor={p} onCambiar={setP} />
      {cargando ? <Cargando /> : dias.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Sin movimientos en este período.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: 'Cobrado', v: tot.cobrado, c: '#16a34a' },
              { l: May(j.operador_plural), v: tot.pilotos, c: '#7e22ce' },
              { l: 'Gastos', v: tot.gastos, c: '#dc2626' },
              { l: 'Neto', v: neto, c: neto >= 0 ? '#2e6db4' : '#dc2626' },
            ].map(({ l, v, c }) => (
              <div key={l} className="bg-white rounded-2xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-500 font-semibold mb-1">{l}</p>
                <p className="font-extrabold text-base" style={{ color: c }}>{fmtCLP(v)}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm overflow-x-auto">
            <p className="text-[#0d2b5c] font-bold text-sm uppercase tracking-wide mb-4">
              📅 Día a día ({tot.vuelos} vuelos)
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="text-left pb-2">Día</th>
                  <th className="text-right pb-2">Vuelos</th>
                  <th className="text-right pb-2">Cobrado</th>
                  <th className="text-right pb-2">{May(j.operador_plural)}</th>
                  <th className="text-right pb-2">Neto</th>
                </tr>
              </thead>
              <tbody>
                {dias.map(d => {
                  const n = d.cobrado - d.pilotos - d.gastos
                  return (
                    <tr key={d.fecha} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700">{fmtDia(d.fecha)}</td>
                      <td className="py-1.5 text-right text-gray-700">{d.vuelos}</td>
                      <td className="py-1.5 text-right text-gray-700">{fmtCLP(d.cobrado)}</td>
                      <td className="py-1.5 text-right text-gray-700">{fmtCLP(d.pilotos)}</td>
                      <td className={`py-1.5 text-right font-semibold ${n >= 0 ? 'text-[#2e6db4]' : 'text-red-600'}`}>{fmtCLP(n)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
