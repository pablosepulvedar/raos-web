'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Cargando from '@/components/Cargando'
import Volver from '@/components/Volver'

const supabase = createClient()
const PAGINA = 50

type Ficha = {
  id: number
  nombre: string | null
  documento: string | null
  edad: number | null
  aceptada_at: string
  reserva?: { nombre: string; fecha: string; borrada: boolean }
}

const fmtDia = (iso: string) =>
  new Date(iso + 'T12:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })

// Todas las fichas firmadas, la más nueva arriba. Se guardan 2 años (D.S. 19):
// esta pantalla es para encontrarlas sin tener que ubicar la reserva.
export default function Fichas() {
  const [fichas, setFichas] = useState<Ficha[] | null>(null)
  const [texto, setTexto] = useState('')
  const [busca, setBusca] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [hayMas, setHayMas] = useState(false)
  const cargandoMas = useRef(false)
  const fin = useRef<HTMLDivElement>(null)

  // Busca al dejar de escribir, no con cada letra
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 350)
    return () => clearTimeout(t)
  }, [texto])

  const pagina = useCallback(async (desdeFila: number) => {
    let q = supabase.from('fichas_riesgo')
      .select('id, nombre, documento, edad, aceptada_at')
      .not('aceptada_at', 'is', null)
      .order('aceptada_at', { ascending: false })
      .range(desdeFila, desdeFila + PAGINA - 1)
    // Comas y paréntesis romperían el filtro or()
    const b = busca.replace(/[,()%*]/g, ' ').trim()
    if (b) q = q.or(`nombre.ilike.%${b}%,documento.ilike.%${b}%`)
    // Por día de firma, en la hora del navegador (Chile)
    if (desde) q = q.gte('aceptada_at', new Date(desde + 'T00:00').toISOString())
    if (hasta) q = q.lt('aceptada_at', new Date(new Date(hasta + 'T00:00').getTime() + 864e5).toISOString())
    const { data } = await q
    const nuevas = (data as Ficha[]) ?? []
    // La reserva va aparte: si se borró ya no se ve por la tabla, y la ficha la necesita
    if (nuevas.length) {
      const { data: rs } = await supabase.rpc('reserva_de_fichas', { p_ids: nuevas.map(f => f.id) })
      for (const r of rs ?? []) {
        const f = nuevas.find(f => f.id === r.ficha_id)
        if (f) f.reserva = r
      }
    }
    setHayMas(nuevas.length === PAGINA)
    return nuevas
  }, [busca, desde, hasta])

  useEffect(() => {
    setFichas(null)
    pagina(0).then(setFichas)
  }, [pagina])

  useEffect(() => {
    const el = fin.current
    if (!el || !hayMas) return
    const obs = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || cargandoMas.current || !fichas) return
      cargandoMas.current = true
      const mas = await pagina(fichas.length)
      setFichas(prev => [...(prev ?? []), ...mas])
      cargandoMas.current = false
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hayMas, fichas, pagina])

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Volver href="/varios" className="text-[#ffd700]" />
        <h1 className="text-white text-xl font-bold flex-1 text-center">📋 Fichas firmadas</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-5 py-6">
        <input
          type="search" value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Buscar por nombre o RUT / pasaporte"
          className="w-full border border-[#b0cce8] rounded-xl p-3 text-sm bg-white mb-3"
        />
        <div className="flex gap-3 mb-5">
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-[#2e6db4] mb-1">Firmadas desde</span>
            <input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)}
              className="w-full border border-[#b0cce8] rounded-lg p-2 text-sm bg-white" />
          </label>
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-[#2e6db4] mb-1">Hasta</span>
            <input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)}
              className="w-full border border-[#b0cce8] rounded-lg p-2 text-sm bg-white" />
          </label>
        </div>

        {fichas === null && <Cargando />}
        {fichas?.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            {busca || desde || hasta ? 'Ninguna ficha calza con esa búsqueda.' : 'Todavía no hay fichas firmadas.'}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {fichas?.map(f => (
            <Link key={f.id} href={`/fichas/${f.id}`}
              className="bg-white border border-[#d4e6f5] rounded-xl p-4 hover:bg-[#f0f7ff] transition-colors">
              <p className="text-sm text-[#0d2b5c] font-bold flex items-center gap-2">
                <span className="truncate">{f.nombre || 'Sin nombre'}</span>
                {f.edad != null && f.edad < 18 && (
                  <span className="shrink-0 text-[10px] font-bold bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5">menor</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {f.documento && <>{f.documento} · </>}
                {f.reserva && <>Reserva {f.reserva.nombre}, {fmtDia(f.reserva.fecha)}</>}
                {f.reserva?.borrada && <span className="text-red-500"> (borrada)</span>}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Firmada el {new Date(f.aceptada_at).toLocaleString('es-CL')}
              </p>
            </Link>
          ))}
        </div>

        {hayMas && <div ref={fin} className="py-4"><Cargando /></div>}
      </main>
    </div>
  )
}
