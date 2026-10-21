'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useJerga } from '@/lib/jerga'

type Plantilla = { id: string; nombre: string; ejemplo: string; patron: string }
type Calendario = { id: string; nombre: string; principal: boolean }
type Config = {
  disponible: boolean
  conectado: boolean
  expirada?: boolean
  cuenta?: string | null
  calendario_id?: string
  calendario_nombre?: string | null
  plantilla?: string
  patron_titulo?: string | null
  plantillas: Plantilla[]
  calendarios: Calendario[]
}
type Previo = {
  googleId: string; titulo: string; fecha: string; horaStr: string | null
  nombre: string; cantidad: number; telefono: string | null; dudoso: boolean
  pasajeros: Array<{ nombre: string }>
}

const ERRORES: Record<string, string> = {
  cancelado: 'No se autorizó el acceso al calendario.',
  sin_codigo: 'Google no devolvió el código de autorización.',
  state: 'La vuelta desde Google no corresponde a esta sesión. Intenta de nuevo.',
  sin_empresa: 'Tu usuario no tiene empresa asignada.',
  sin_refresh: 'Google no entregó el permiso permanente. Vuelve a intentarlo y acepta el acceso.',
  guardar: 'No se pudo guardar la conexión.',
  google: 'Google rechazó la autorización.',
  sin_configurar: 'Falta configurar la aplicación de Google en el sistema.',
}

const btn = 'bg-[#1e5a96] text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-[#174a82] transition-colors disabled:opacity-60'
const btnSec = 'border border-[#1e5a96] text-[#1e5a96] font-semibold py-2 px-3 rounded-lg hover:bg-[#e8f0f7] transition-colors text-sm'
const caja = 'bg-white border border-[#d4e6f5] rounded-xl p-5 mb-5'

export default function CalendarConfig() {
  const jerga = useJerga()
  const [cfg, setCfg] = useState<Config | null>(null)
  const [plantilla, setPlantilla] = useState('raos')
  const [patron, setPatron] = useState('')
  const [calendario, setCalendario] = useState('')
  const [previo, setPrevio] = useState<Previo[] | null>(null)
  const [errorPrevio, setErrorPrevio] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('error')) setMsg({ ok: false, texto: ERRORES[p.get('error')!] ?? 'No se pudo conectar.' })
    if (p.get('conectado')) setMsg({ ok: true, texto: 'Calendario conectado.' })
  }, [])

  const cargar = useCallback(async () => {
    const res = await fetch('/api/calendar/config')
    if (!res.ok) return
    const d: Config = await res.json()
    setCfg(d)
    if (d.conectado) {
      setPlantilla(d.plantilla ?? 'raos')
      setPatron(d.patron_titulo ?? '')
      setCalendario(d.calendario_id ?? 'primary')
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Vista previa: los eventos que vienen, leídos con la plantilla que está elegida
  useEffect(() => {
    if (!cfg?.conectado) return
    const q = new URLSearchParams({ proximos: '1', plantilla })
    if (plantilla === 'libre') q.set('patron', patron)
    const t = setTimeout(async () => {
      setErrorPrevio(null)
      const res = await fetch(`/api/calendar/events?${q}`)
      const d = await res.json()
      if (!res.ok) { setPrevio(null); setErrorPrevio(d.error === 'no_conectado' ? 'La conexión con Google expiró.' : d.error); return }
      setPrevio(d.eventos)
    }, 400)
    return () => clearTimeout(t)
  }, [cfg?.conectado, plantilla, patron, calendario])

  const guardar = async () => {
    setGuardando(true); setMsg(null)
    const cal = cfg?.calendarios.find(c => c.id === calendario)
    const res = await fetch('/api/calendar/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendario_id: calendario || undefined,
        calendario_nombre: cal?.nombre,
        plantilla,
        patron_titulo: patron,
      }),
    })
    const d = await res.json()
    setGuardando(false)
    setMsg(res.ok ? { ok: true, texto: 'Guardado' } : { ok: false, texto: d.error })
    if (res.ok) cargar()
  }

  const desconectar = async () => {
    await fetch('/api/calendar/config', { method: 'DELETE' })
    setPrevio(null)
    setMsg({ ok: true, texto: 'Calendario desconectado' })
    cargar()
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/varios" className="text-[#ffd700] text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">📅 Google Calendar</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-5 py-8">
        {msg && (
          <div className={`mb-5 p-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {msg.texto}
          </div>
        )}

        <div className={caja}>
          <p className="text-[#0d2b5c] font-bold mb-1">Tu calendario, dentro del sistema</p>
          <p className="text-sm text-gray-600">
            Si vienes agendando en Google Calendar, conecta tu cuenta y vas a poder traer esos
            eventos como {jerga.actividad_plural} sin escribirlas de nuevo. Solo se leen los
            eventos: el sistema nunca crea, cambia ni borra nada en tu calendario.
          </p>

          {cfg && !cfg.disponible && (
            <p className="mt-3 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3">
              La conexión con Google todavía no está habilitada en el sistema. Escríbenos y la
              activamos.
            </p>
          )}

          {cfg?.conectado ? (
            <div className="mt-4">
              <p className="text-sm">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Conectado</span>
                {cfg.cuenta && <span className="text-gray-600 ml-2">{cfg.cuenta}</span>}
              </p>
              {cfg.expirada && (
                <p className="mt-2 text-sm text-red-700">
                  El permiso dejó de servir (lo revocaste en Google o cambió la contraseña).
                  Conecta de nuevo.
                </p>
              )}
              <div className="flex gap-2 mt-4">
                <a className={btnSec} href="/api/auth/google">Conectar otra cuenta</a>
                <button className={btnSec} onClick={desconectar}>Desconectar</button>
              </div>
            </div>
          ) : (
            cfg?.disponible && (
              <a className={`${btn} inline-block mt-4`} href="/api/auth/google">Conectar Google Calendar</a>
            )
          )}
        </div>

        {cfg?.conectado && (
          <>
            {cfg.calendarios.length > 1 && (
              <div className={caja}>
                <p className="text-[#0d2b5c] font-bold mb-2">Qué calendario se lee</p>
                <select
                  className="w-full border border-[#b0cce8] rounded-lg p-3 text-sm bg-white"
                  value={calendario}
                  onChange={e => setCalendario(e.target.value)}
                >
                  {cfg.calendarios.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}{c.principal ? ' (principal)' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={caja}>
              <p className="text-[#0d2b5c] font-bold mb-1">Cómo escribes tus eventos</p>
              <p className="text-sm text-gray-600 mb-3">
                Elige el formato que usas en el título del evento. Abajo ves tus propios eventos
                leídos con ese formato: si algo sale mal, cambia de opción.
              </p>

              {cfg.plantillas.map(p => (
                <label
                  key={p.id}
                  className={`flex gap-3 items-start border rounded-lg p-3 mb-2 cursor-pointer ${plantilla === p.id ? 'border-[#1e5a96] bg-[#f0f7ff]' : 'border-[#d4e6f5]'}`}
                >
                  <input
                    type="radio" name="plantilla" className="mt-1"
                    checked={plantilla === p.id}
                    onChange={() => setPlantilla(p.id)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#0d2b5c]">{p.nombre}</span>
                    <span className="block text-xs text-gray-500 font-mono">{p.ejemplo}</span>
                  </span>
                </label>
              ))}

              {plantilla === 'libre' && (
                <div className="mt-3">
                  <input
                    className="w-full border border-[#b0cce8] rounded-lg p-3 text-sm bg-white font-mono"
                    placeholder="{nombre} - {cantidad} personas - {telefono}"
                    value={patron}
                    onChange={e => setPatron(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Escribe tu título cambiando los datos por{' '}
                    <code>{'{nombre}'}</code>, <code>{'{cantidad}'}</code>,{' '}
                    <code>{'{telefono}'}</code> y <code>{'{hora}'}</code>. El resto se toma literal.
                  </p>
                </div>
              )}

              <div className="mt-4">
                <p className="text-[#0d2b5c] font-bold text-sm mb-2">Así se leen tus eventos</p>
                {errorPrevio && <p className="text-sm text-red-700">{errorPrevio}</p>}
                {!errorPrevio && previo === null && <p className="text-sm text-gray-500">Leyendo tu calendario…</p>}
                {previo?.length === 0 && (
                  <p className="text-sm text-gray-500">No hay eventos en los próximos días para mostrar.</p>
                )}
                {previo?.map(ev => (
                  <div key={ev.googleId} className="border border-[#d4e6f5] rounded-lg p-3 mb-2">
                    <p className="text-xs text-gray-500 font-mono truncate">{ev.titulo}</p>
                    {ev.dudoso ? (
                      <p className="text-sm text-yellow-700 mt-1">
                        No calza con este formato: se importaría con el título completo como nombre.
                      </p>
                    ) : (
                      <p className="text-sm text-[#0d2b5c] mt-1">
                        <b>{ev.nombre}</b> · {ev.cantidad} {ev.cantidad === 1 ? jerga.cliente : jerga.cliente_plural}
                        {ev.horaStr && <> · {ev.horaStr}</>}
                        {ev.telefono && <> · {ev.telefono}</>}
                        {ev.pasajeros.length > 0 && (
                          <span className="block text-xs text-gray-500 mt-1">
                            {ev.pasajeros.map(p => p.nombre).join(', ')}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <button className={`${btn} mt-4`} onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>

            <Link className={`${btnSec} inline-block`} href="/calendar">Ir a importar {jerga.actividad_plural} →</Link>
          </>
        )}
      </main>
    </div>
  )
}
