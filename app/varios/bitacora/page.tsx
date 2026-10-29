'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Cargando from '@/components/Cargando'
import Volver from '@/components/Volver'

const supabase = createClient()
const PAGINA = 50

type Linea = {
  id: number
  tabla: string
  fila_id: string
  accion: 'alta' | 'cambio' | 'baja'
  perfil_id: string | null
  origen: string
  datos: Record<string, unknown> | null
  cambios: Record<string, { antes: unknown; ahora: unknown }> | null
  cuando: string
}
type Persona = { id: string; nombre: string }

// Qué es cada tabla, en palabras. Lo que no esté acá sale con su nombre crudo:
// es preferible una línea fea a una línea que no aparece.
const COSA: Record<string, string> = {
  reservas: 'la reserva',
  reserva_pagos: 'un pago de la reserva',
  reserva_servicios: 'un servicio de la reserva',
  reservas_personas: 'un pasajero de la reserva',
  piloto_pagos: 'un pago a un guía',
  perfil_valores: 'un servicio de un guía',
  gastos_diarios: 'un gasto',
  fichas_riesgo: 'una ficha de riesgo',
  perfil_roles: 'un rol',
  pilotos: 'una ficha de guía',
}
const VERBO = { alta: 'creó', cambio: 'cambió', baja: 'borró' } as const

const CAMPO: Record<string, string> = {
  nombre: 'nombre', cantidad: 'cantidad', fecha: 'fecha', horario_id: 'horario',
  telefono: 'teléfono', abono: 'abono', volo: 'voló', monto: 'monto',
  metodo_pago_id: 'método de pago', activo: 'activo', aceptada_at: 'aceptación',
}

const clp = (n: unknown) => typeof n === 'number' ? `$${n.toLocaleString('es-CL')}` : String(n)

// Un detalle corto para no obligar a abrir cada línea
function detalle(l: Linea) {
  const d = l.datos ?? {}
  if (l.tabla === 'reservas' && d.nombre) return `${d.nombre}`
  if (typeof d.monto === 'number') return clp(d.monto)
  if (d.nombre) return `${d.nombre}`
  return ''
}

// Los campos de plata se leen mucho mejor con separador de miles
const PLATA = new Set(['monto', 'abono', 'total', 'saldo'])
const valor = (campo: string, v: unknown) =>
  v === null || v === undefined || v === '' ? '(vacío)'
    : typeof v === 'boolean' ? (v ? 'sí' : 'no')
    : PLATA.has(campo) && typeof v === 'number' ? clp(v)
    : String(v)

export default function Bitacora() {
  const [lineas, setLineas] = useState<Linea[] | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [quien, setQuien] = useState('')
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [abierta, setAbierta] = useState<number | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const cargandoMas = useRef(false)
  const fin = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('perfiles').select('id, nombre').order('nombre')
      .then(({ data }) => setPersonas((data as Persona[]) ?? []))
  }, [])

  // De a 50: la primera página al cambiar el filtro, las siguientes al llegar al final
  const pagina = useCallback(async (desdeFila: number) => {
    let q = supabase.from('bitacora').select('*')
      .gte('cuando', desde + 'T00:00:00')
      .order('cuando', { ascending: false })
      .order('id', { ascending: false })
      .range(desdeFila, desdeFila + PAGINA - 1)
    if (quien) q = q.eq('perfil_id', quien)
    const { data } = await q
    const nuevas = (data as Linea[]) ?? []
    setHayMas(nuevas.length === PAGINA)
    return nuevas
  }, [quien, desde])

  useEffect(() => {
    setLineas(null)
    pagina(0).then(setLineas)
  }, [pagina])

  useEffect(() => {
    const el = fin.current
    if (!el || !hayMas) return
    const obs = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || cargandoMas.current || !lineas) return
      cargandoMas.current = true
      const mas = await pagina(lineas.length)
      setLineas(prev => [...(prev ?? []), ...mas])
      cargandoMas.current = false
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hayMas, lineas, pagina])

  const nombreDe = (id: string | null, origen: string) =>
    id ? (personas.find(p => p.id === id)?.nombre ?? 'Alguien que ya no está')
      : origen === 'sistema' ? 'El sistema (API o pago en línea)' : 'Desconocido'

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Volver href="/varios" className="text-[#ffd700]" />
        <h1 className="text-white text-xl font-bold flex-1 text-center">🧾 Quién hizo qué</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-5 py-6">
        <div className="bg-white border border-[#d4e6f5] rounded-xl p-4 mb-5 flex gap-3">
          <label className="flex-1">
            <span className="block text-xs font-bold text-[#2e6db4] mb-1">Quién</span>
            <select
              className="w-full border border-[#b0cce8] rounded-lg p-2 text-sm bg-white"
              value={quien} onChange={e => setQuien(e.target.value)}
            >
              <option value="">Todos</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="w-36">
            <span className="block text-xs font-bold text-[#2e6db4] mb-1">Desde</span>
            <input
              type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="w-full border border-[#b0cce8] rounded-lg p-2 text-sm bg-white"
            />
          </label>
        </div>

        {lineas === null && <Cargando />}
        {lineas?.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No hay movimientos en ese periodo.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {lineas?.map(l => (
            <div key={l.id} className="bg-white border border-[#d4e6f5] rounded-xl p-4">
              <button
                className="w-full text-left"
                onClick={() => setAbierta(abierta === l.id ? null : l.id)}
              >
                <p className="text-sm text-[#0d2b5c]">
                  <b>{nombreDe(l.perfil_id, l.origen)}</b> {VERBO[l.accion]}{' '}
                  {COSA[l.tabla] ?? l.tabla}
                  {detalle(l) && <> de <b>{detalle(l)}</b></>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(l.cuando).toLocaleString('es-CL')}
                  {l.cambios && <> · {Object.keys(l.cambios).map(k => CAMPO[k] ?? k).join(', ')}</>}
                </p>
              </button>

              {abierta === l.id && (
                <div className="mt-3 pt-3 border-t border-[#eef3f7] text-xs">
                  {l.cambios ? (
                    <table className="w-full">
                      <tbody>
                        {Object.entries(l.cambios).map(([k, v]) => (
                          <tr key={k}>
                            <td className="py-1 pr-3 text-gray-500">{CAMPO[k] ?? k}</td>
                            <td className="py-1 text-gray-400 line-through">{valor(k, v.antes)}</td>
                            <td className="py-1 pl-2 text-[#0d2b5c] font-semibold">{valor(k, v.ahora)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <pre className="whitespace-pre-wrap break-all text-gray-600">
                      {JSON.stringify(l.datos, null, 1)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {hayMas && <div ref={fin} className="py-4"><Cargando /></div>}
      </main>
    </div>
  )
}
