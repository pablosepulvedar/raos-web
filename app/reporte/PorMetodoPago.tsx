'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useJerga } from '@/lib/jerga'
import Cargando from '@/components/Cargando'
import Rango, { mesActual, type Periodo } from './Rango'

const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`

type Fila = { metodo: string; entra: number; sale: number }
type ConMetodo = { monto: number; tipo?: string; metodos_pago?: { nombre: string } | null }

export default function PorMetodoPago() {
  const j = useJerga()
  const sb = useRef(createClient()).current
  const [p, setP] = useState<Periodo>(mesActual)
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)

  const traer = async () => {
    setCargando(true)
    const { data: reservas } = await sb.from('reservas').select('id').gte('fecha', p.desde).lte('fecha', p.hasta)
    const ids = (reservas ?? []).map((r: { id: number }) => r.id)

    const [{ data: cobros }, { data: aPilotos }, { data: gastos }] = await Promise.all([
      ids.length ? sb.from('reserva_pagos').select('monto, metodos_pago(nombre)').in('reserva_id', ids)
                 : Promise.resolve({ data: [] as unknown[] }),
      sb.from('piloto_pagos').select('monto, metodos_pago(nombre)').gte('fecha', p.desde).lte('fecha', p.hasta),
      sb.from('gastos_diarios').select('monto, tipo, metodos_pago(nombre)').gte('fecha', p.desde).lte('fecha', p.hasta),
    ])

    const mapa: Record<string, Fila> = {}
    const fila = (n?: string | null) => (mapa[n || 'Sin método'] ??= { metodo: n || 'Sin método', entra: 0, sale: 0 })
    ;((cobros ?? []) as unknown as ConMetodo[]).forEach(x => { fila(x.metodos_pago?.nombre).entra += x.monto })
    ;((aPilotos ?? []) as unknown as ConMetodo[]).forEach(x => { fila(x.metodos_pago?.nombre).sale += x.monto })
    ;((gastos ?? []) as unknown as ConMetodo[]).forEach(x => {
      const f = fila(x.metodos_pago?.nombre)
      if (x.tipo === 'gasto') f.sale += x.monto
      else f.entra += x.monto
    })

    setFilas(Object.values(mapa).filter(f => f.entra || f.sale).sort((a, b) => (b.entra - b.sale) - (a.entra - a.sale)))
    setCargando(false)
  }

  useEffect(() => { traer() }, [p.desde, p.hasta])

  const tot = filas.reduce((a, f) => ({ entra: a.entra + f.entra, sale: a.sale + f.sale }), { entra: 0, sale: 0 })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4">
      <Rango valor={p} onCambiar={setP} />
      {cargando ? <Cargando /> : filas.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Sin movimientos de dinero en este período.</p>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-sm overflow-x-auto">
          <p className="text-[#0d2b5c] font-bold text-sm uppercase tracking-wide mb-4">💳 Por método de pago</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs">
                <th className="text-left pb-2">Método</th>
                <th className="text-right pb-2">Entró</th>
                <th className="text-right pb-2">Salió</th>
                <th className="text-right pb-2">Queda</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                const q = f.entra - f.sale
                return (
                  <tr key={f.metodo} className="border-t border-gray-100">
                    <td className="py-2 text-gray-700">{f.metodo}</td>
                    <td className="py-2 text-right text-[#16a34a]">{fmtCLP(f.entra)}</td>
                    <td className="py-2 text-right text-[#dc2626]">{fmtCLP(f.sale)}</td>
                    <td className={`py-2 text-right font-bold ${q >= 0 ? 'text-[#0d2b5c]' : 'text-red-600'}`}>{fmtCLP(q)}</td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-[#0d2b5c] font-extrabold text-[#0d2b5c]">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{fmtCLP(tot.entra)}</td>
                <td className="py-2 text-right">{fmtCLP(tot.sale)}</td>
                <td className="py-2 text-right">{fmtCLP(tot.entra - tot.sale)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-3">
            Entró: cobros a clientes y otros ingresos. Salió: pagos a {j.operador_plural} y gastos.
          </p>
        </div>
      )}
    </div>
  )
}
