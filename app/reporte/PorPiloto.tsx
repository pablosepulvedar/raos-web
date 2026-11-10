'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { May, useJerga } from '@/lib/jerga'
import Cargando from '@/components/Cargando'
import { usePermisos } from '@/lib/permisos'
import Rango, { mesActual, type Periodo } from './Rango'

const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`

type Fila = { id: string; nombre: string; vuelos: number; genero: number; pagado: number }
type Persona = { perfil_id: string; perfiles?: { nombre: string } | null }
type Valor   = { perfil_id: string; cantidad: number; valores?: { monto: number } | null }
type Pago    = { perfil_id: string; monto: number; perfiles?: { nombre: string } | null }

export default function PorPiloto() {
  const j = useJerga()
  const sb = useRef(createClient()).current
  const { veTodo, cargando: cargandoPermisos } = usePermisos()
  const [p, setP] = useState<Periodo>(mesActual)
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)

  // Un guía sin el permiso 'reservas' no necesita que le escondamos nada acá:
  // el RLS ya le entrega solo sus propios vuelos y sus propios pagos.
  const traer = async () => {
    setCargando(true)
    // Las que están por reagendar no cuentan como vuelo ni se le pagan al guía
    const { data: reservas } = await sb.from('reservas').select('id')
      .gte('fecha', p.desde).lte('fecha', p.hasta).is('espera_at', null)
    const ids = (reservas ?? []).map((r: { id: number }) => r.id)

    const [{ data: personas }, { data: valores }, { data: pagos }] = await Promise.all([
      ids.length ? sb.from('reservas_personas').select('perfil_id, perfiles(nombre)').in('reserva_id', ids).not('perfil_id', 'is', null)
                 : Promise.resolve({ data: [] as unknown[] }),
      ids.length ? sb.from('perfil_valores').select('perfil_id, cantidad, valores(monto)').in('reserva_id', ids)
                 : Promise.resolve({ data: [] as unknown[] }),
      sb.from('piloto_pagos').select('perfil_id, monto, perfiles(nombre)').gte('fecha', p.desde).lte('fecha', p.hasta),
    ])

    const mapa: Record<string, Fila> = {}
    const fila = (id: string, nombre?: string) =>
      (mapa[id] ??= { id, nombre: nombre || 'Sin nombre', vuelos: 0, genero: 0, pagado: 0 })
    ;((personas ?? []) as unknown as Persona[]).forEach(x => { fila(x.perfil_id, x.perfiles?.nombre).vuelos++ })
    ;((valores ?? []) as unknown as Valor[]).forEach(x => { fila(x.perfil_id).genero += (x.valores?.monto ?? 0) * x.cantidad })
    ;((pagos ?? []) as unknown as Pago[]).forEach(x => { fila(x.perfil_id, x.perfiles?.nombre).pagado += x.monto })

    setFilas(Object.values(mapa).sort((a, b) => b.vuelos - a.vuelos || a.nombre.localeCompare(b.nombre)))
    setCargando(false)
  }

  useEffect(() => { if (!cargandoPermisos) traer() }, [p.desde, p.hasta, cargandoPermisos])

  const tot = filas.reduce((a, f) => ({ vuelos: a.vuelos + f.vuelos, genero: a.genero + f.genero, pagado: a.pagado + f.pagado }),
    { vuelos: 0, genero: 0, pagado: 0 })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4">
      <Rango valor={p} onCambiar={setP} />
      {!veTodo && !cargandoPermisos && (
        <p className="text-xs text-gray-600 bg-[#fff8e1] border border-[#ffe08a] rounded-xl px-3 py-2">
          Estás viendo solo tus propios vuelos y pagos.
        </p>
      )}
      {cargando ? <Cargando /> : filas.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Sin vuelos en este período.</p>
      ) : (
        <>
          {filas.map(f => {
            const saldo = f.genero - f.pagado
            return (
              <div key={f.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-baseline justify-between mb-3">
                  <p className="font-bold text-[#0d2b5c]">{f.nombre}</p>
                  <p className="text-xs text-gray-500 font-semibold">{f.vuelos} vuelo{f.vuelos === 1 ? '' : 's'}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-gray-500">Generó</p><p className="font-bold text-sm text-[#7e22ce]">{fmtCLP(f.genero)}</p></div>
                  <div><p className="text-xs text-gray-500">Pagado</p><p className="font-bold text-sm text-[#16a34a]">{fmtCLP(f.pagado)}</p></div>
                  <div><p className="text-xs text-gray-500">Saldo</p>
                    <p className={`font-bold text-sm ${saldo > 0 ? 'text-[#dc2626]' : 'text-gray-500'}`}>{fmtCLP(saldo)}</p></div>
                </div>
              </div>
            )
          })}
          {filas.length > 1 && (
            <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#0d2b5c,#1a4a85)' }}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-bold text-sm uppercase tracking-wide">Total {j.operador_plural}</span>
                <span className="text-xs text-[#7aafd4]">{tot.vuelos} vuelos</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-[#7aafd4]">Generó</p><p className="font-bold text-sm">{fmtCLP(tot.genero)}</p></div>
                <div><p className="text-xs text-[#7aafd4]">Pagado</p><p className="font-bold text-sm">{fmtCLP(tot.pagado)}</p></div>
                <div><p className="text-xs text-[#7aafd4]">Saldo</p><p className="font-bold text-sm">{fmtCLP(tot.genero - tot.pagado)}</p></div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
