'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type Pasajero = {
  nombre: string; edad: number|null; peso: number|null
  sin_camara: boolean; camara_normal: boolean; camara_360: boolean; cumpleanero: boolean
}

type EventoCalendario = {
  googleId: string; titulo: string; fecha: string
  horaStr: string|null; nombre: string; cantidad: number
  abono: number|null; pasajeros: Pasajero[]
}

const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`

const camaraLabel = (p: Pasajero) => {
  if (p.camara_360)   return '📹 360°'
  if (p.camara_normal) return '📸 Normal'
  return '— Sin cámara'
}

export default function CalendarPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(today)
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [importando, setImportando] = useState<string|null>(null)
  const [importados, setImportados] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<{id:string; type:'ok'|'err'; text:string}|null>(null)

  const buscar = async () => {
    setLoading(true); setError(null); setEventos([])
    const res = await fetch(`/api/calendar/events?fecha=${fecha}`)
    if (res.status === 401) {
      window.location.href = '/api/auth/google'
      return
    }
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false); return }
    setEventos(data.eventos)
    setLoading(false)
  }

  const importar = async (ev: EventoCalendario) => {
    setImportando(ev.googleId); setMsg(null)

    try {
      // 1. Buscar horario_id que coincida con la hora
      let horarioId: number|null = null
      if (ev.horaStr) {
        // "12:00" → 1200, "9:00" → 900
        const horaNum = parseInt(ev.horaStr.replace(':', ''), 10)
        const { data: horarios } = await supabase.from('horarios').select('id, horario')
        // Intenta coincidencia exacta primero, luego busca el más cercano
        const exacto = (horarios || []).find((h: any) => h.horario === horaNum)
        if (exacto) {
          horarioId = exacto.id
        } else {
          // Busca el horario con menor diferencia absoluta
          const cercano = (horarios || []).reduce((prev: any, curr: any) =>
            Math.abs(curr.horario - horaNum) < Math.abs(prev.horario - horaNum) ? curr : prev
          , (horarios || [])[0])
          if (cercano && Math.abs(cercano.horario - horaNum) <= 30) horarioId = cercano.id
        }
      }

      // 2. Crear reserva
      const { data: reserva, error: resErr } = await supabase
        .from('reservas')
        .insert({
          nombre: ev.nombre,
          fecha: ev.fecha,
          horario_id: horarioId,
          cantidad: ev.cantidad,
          abono: ev.abono,
          telefono: null,
        })
        .select('id').single()

      if (resErr || !reserva) throw new Error(resErr?.message || 'Error al crear reserva')

      // 3. Crear pasajeros
      if (ev.pasajeros.length > 0) {
        const pasPayload = ev.pasajeros.map(p => ({
          reserva_id: reserva.id,
          nombre: p.nombre,
          edad: p.edad,
          peso: p.peso,
          sin_camara: p.sin_camara,
          camara_normal: p.camara_normal,
          camara_360: p.camara_360,
          cumpleanero: p.cumpleanero,
        }))
        const { error: pasErr } = await supabase.from('reservas_personas').insert(pasPayload)
        if (pasErr) throw new Error(pasErr.message)
      }

      setImportados(prev => new Set([...prev, ev.googleId]))
      setMsg({ id: ev.googleId, type: 'ok', text: `Reserva creada — ID ${reserva.id}` })
    } catch (e: any) {
      setMsg({ id: ev.googleId, type: 'err', text: e.message })
    } finally {
      setImportando(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#ffd700] px-5 py-5 flex items-center gap-4">
        <Link href="/" className="text-[#1e5a96] text-lg font-semibold hover:opacity-70">← Volver</Link>
        <h1 className="text-[#1e5a96] text-xl font-bold flex-1 text-center">📅 Importar desde Calendar</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4">

        {/* Selector de fecha */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[#1e5a96] font-semibold text-xs mb-1">Fecha a importar</label>
            <input
              type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-[#b0cce8] rounded-xl p-3 text-sm text-[#0d2b5c]"
            />
          </div>
          <button
            onClick={buscar} disabled={loading}
            className="bg-[#1e5a96] text-white font-bold px-5 py-3 rounded-xl hover:bg-[#174a82] transition-colors disabled:opacity-60 text-sm"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        )}

        {/* Lista de eventos */}
        {eventos.length === 0 && !loading && (
          <p className="text-center text-gray-400 text-sm py-8">Selecciona una fecha y haz click en Buscar.</p>
        )}

        {eventos.map(ev => {
          const yaImportado = importados.has(ev.googleId)
          return (
            <div key={ev.googleId} className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${yaImportado ? 'border-green-400' : 'border-[#ffd700]'}`}>

              {/* Encabezado */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-[#0d2b5c] font-bold text-base">{ev.nombre}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {ev.horaStr && `⏰ ${ev.horaStr} · `}👥 {ev.cantidad} persona{ev.cantidad !== 1 ? 's' : ''}
                    {ev.abono && ` · 💰 Abono ${fmtCLP(ev.abono)}`}
                  </p>
                </div>
                <button
                  onClick={() => importar(ev)}
                  disabled={!!importando || yaImportado}
                  className={`shrink-0 font-bold px-4 py-2 rounded-xl text-xs transition-colors disabled:opacity-50
                    ${yaImportado ? 'bg-green-100 text-green-700' : 'bg-[#1e5a96] text-white hover:bg-[#174a82]'}`}
                >
                  {importando === ev.googleId ? '...' : yaImportado ? '✓ Importado' : 'Importar'}
                </button>
              </div>

              {/* Mensaje resultado */}
              {msg?.id === ev.googleId && (
                <div className={`mb-3 p-2.5 rounded-lg text-xs ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {msg.text}
                </div>
              )}

              {/* Pasajeros */}
              {ev.pasajeros.length > 0 && (
                <div className="border-t border-gray-100 pt-3 flex flex-col gap-1.5">
                  {ev.pasajeros.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-semibold text-[#0d2b5c]">
                        {p.nombre}
                        {p.cumpleanero && ' 🥳'}
                      </span>
                      {p.edad && <span>{p.edad} años</span>}
                      {p.peso && <span>{p.peso} kg</span>}
                      <span className="ml-auto text-gray-400">{camaraLabel(p)}</span>
                    </div>
                  ))}
                </div>
              )}

              {ev.pasajeros.length === 0 && (
                <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">Sin pasajeros en la descripción</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
