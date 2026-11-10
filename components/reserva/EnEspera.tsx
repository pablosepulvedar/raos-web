'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useJerga } from '@/lib/jerga'
import Cargando from '@/components/Cargando'
import { usePermisos } from '@/lib/permisos'

// Reservas por reagendar: la salida no se hizo y hay que moverla de día.
// Mientras están acá no cuentan como vuelo en ningún informe ni se le paga al guía.
// La `fecha` que tienen SIGUE siendo la original: por eso se muestra tal cual.

type Reserva = {
  id: number
  nombre: string
  telefono: number | null
  cantidad: number
  fecha: string
  espera_at: string
  horarios: { horario: number } | null
}
type Horario = { id: number; horario: number }

const fmtH = (v: number) => { const s = String(v).padStart(4, '0'); return `${s.slice(0, 2)}:${s.slice(2)}` }
const fmtF = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })

export default function EnEspera() {
  const j = useJerga()
  const sb = useRef(createClient()).current
  const [filas, setFilas] = useState<Reserva[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [cargando, setCargando] = useState(true)
  const [reagendando, setReagendando] = useState<Reserva | null>(null)
  const [fecha, setFecha] = useState('')
  const [horarioId, setHorarioId] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const { esAdmin, permisos } = usePermisos()
  const puedeReagendar = esAdmin || permisos.has('reagendar')

  const traer = useCallback(async () => {
    setCargando(true)
    const [{ data }, { data: hs }] = await Promise.all([
      sb.from('reservas')
        .select('id, nombre, telefono, cantidad, fecha, espera_at, horarios(horario)')
        .not('espera_at', 'is', null)
        .order('fecha'),
      sb.from('horarios').select('id, horario').order('horario'),
    ])
    setFilas((data ?? []) as unknown as Reserva[])
    setHorarios((hs ?? []) as Horario[])
    setCargando(false)
  }, [sb])

  useEffect(() => { traer() }, [traer])

  const abrir = (r: Reserva) => {
    setError('')
    setReagendando(r)
    setFecha('')
    setHorarioId(null)
  }

  const reagendar = async () => {
    if (!reagendando) return
    if (!fecha) return setError('Elige la fecha nueva.')
    setGuardando(true)
    const { error } = await sb.rpc('reserva_reagendar', {
      p_id: reagendando.id, p_fecha: fecha, p_horario_id: horarioId,
    })
    setGuardando(false)
    if (error) return setError(error.message)
    setReagendando(null)
    traer()
  }

  if (cargando) return <div className="py-10"><Cargando /></div>

  if (!filas.length) return (
    <div className="max-w-lg mx-auto px-4 py-10 text-center">
      <p className="text-gray-500">No hay nada por reagendar.</p>
      <p className="text-gray-400 text-sm mt-2">
        Cuando una salida no se hace, desde la reserva puedes dejarla en espera y aparece acá.
      </p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        {/* Redacción sin género: la palabra de la actividad cambia con el rubro
            (vuelos, salidas, bajadas…) y "realizadas" no concordaba con todas. */}
        {filas.length} {filas.length === 1 ? 'reserva' : 'reservas'} por reagendar. Mientras estén acá
        no cuentan en los informes ni se les paga a los {j.operador_plural}.
      </p>

      {filas.map(r => (
        <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-[#0d2b5c]">{r.nombre}</p>
              <p className="text-sm text-gray-600">
                {r.cantidad} {r.cantidad === 1 ? 'persona' : 'personas'}
                {r.telefono && <> · {r.telefono}</>}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Era el {fmtF(r.fecha)}{r.horarios && <> a las {fmtH(r.horarios.horario)}</>}
              </p>
            </div>
            {r.telefono && (
              <a href={`https://wa.me/56${r.telefono}`} target="_blank" rel="noreferrer"
                className="text-xs font-bold text-[#16a34a] shrink-0 px-2 py-1">WhatsApp</a>
            )}
          </div>

          {reagendando?.id === r.id ? (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
              <div className="flex gap-2">
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                <select value={horarioId ?? ''} onChange={e => setHorarioId(e.target.value ? Number(e.target.value) : null)}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm">
                  <option value="">Hora…</option>
                  {horarios.map(h => <option key={h.id} value={h.id}>{fmtH(h.horario)}</option>)}
                </select>
              </div>
              {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
              <div className="flex gap-2">
                <button onClick={reagendar} disabled={guardando}
                  className="flex-1 py-2 rounded-xl bg-[#1a4a85] text-white text-sm font-bold disabled:opacity-50">
                  {guardando ? 'Guardando…' : 'Confirmar'}
                </button>
                <button onClick={() => setReagendando(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm">Cancelar</button>
              </div>
              <p className="text-xs text-gray-500">
                Vuelve a la agenda en la fecha nueva. Acuérdate de asignarle {j.operador}.
              </p>
            </div>
          ) : (
            puedeReagendar ? (
              <button onClick={() => abrir(r)}
                className="mt-3 w-full py-2 rounded-xl bg-[#1a4a85] text-white text-sm font-bold">
                Reagendar
              </button>
            ) : (
              <p className="mt-3 text-xs text-gray-500">Tu rol no puede reagendar salidas.</p>
            )
          )}
        </div>
      ))}
    </div>
  )
}
