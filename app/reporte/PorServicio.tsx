'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Cargando from '@/components/Cargando'
import Rango, { mesActual, type Periodo } from './Rango'

const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`

type Fila = { servicio: string; cantidad: number; monto: number; descuento: boolean }

export default function PorServicio() {
  const sb = useRef(createClient()).current
  const [p, setP] = useState<Periodo>(mesActual)
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)

  const traer = async () => {
    setCargando(true)
    const { data: reservas } = await sb.from('reservas').select('id')
      .gte('fecha', p.desde).lte('fecha', p.hasta).is('espera_at', null)
    const ids = (reservas ?? []).map((r: { id: number }) => r.id)
    const { data } = ids.length
      ? await sb.from('reserva_servicios').select('valores(servicio, monto, descuento)').in('reserva_id', ids)
      : { data: [] as unknown[] }

    // Los valores marcados como descuento restan: así el total cuadra con lo cobrado
    const mapa: Record<string, Fila> = {}
    ;((data ?? []) as unknown as { valores?: { servicio: string; monto: number; descuento: boolean } | null }[]).forEach(x => {
      const v = x.valores
      if (!v) return
      const f = (mapa[v.servicio] ??= { servicio: v.servicio, cantidad: 0, monto: 0, descuento: !!v.descuento })
      f.cantidad++
      f.monto += v.descuento ? -v.monto : v.monto
    })
    setFilas(Object.values(mapa).sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto)))
    setCargando(false)
  }

  useEffect(() => { traer() }, [p.desde, p.hasta])

  const total = filas.reduce((s, f) => s + f.monto, 0)
  const mayor = Math.max(1, ...filas.map(f => Math.abs(f.monto)))

  return (
    <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4">
      <Rango valor={p} onCambiar={setP} />
      {cargando ? <Cargando /> : filas.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Sin servicios vendidos en este período.</p>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-[#0d2b5c] font-bold text-sm uppercase tracking-wide mb-4">🏷️ Qué se vendió</p>
          <div className="flex flex-col gap-3">
            {filas.map(f => (
              <div key={f.servicio}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span className="text-gray-700">{f.servicio}
                    <span className="text-gray-400 text-xs ml-1">×{f.cantidad}</span>
                  </span>
                  <span className={`font-bold ${f.descuento ? 'text-red-600' : 'text-[#0d2b5c]'}`}>{fmtCLP(f.monto)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.abs(f.monto) / mayor * 100}%`, background: f.descuento ? '#dc2626' : '#2e6db4' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between border-t border-gray-200 mt-4 pt-3">
            <span className="font-bold text-sm text-[#0d2b5c] uppercase tracking-wide">Total</span>
            <span className="font-extrabold text-lg text-[#0d2b5c]">{fmtCLP(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
