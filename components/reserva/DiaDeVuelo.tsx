'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Ficha = { id: number; token: string; nombre: string | null; aceptada_at: string | null }
type Persona = { id: number; nombre: string }
type Reserva = {
  id: number; nombre: string; telefono: number | null; cantidad: number
  horario_id: number | null; volo: boolean
  reservas_personas: Persona[]
  fichas_riesgo: Ficha[]
}
type Horario = { id: number; horario: number }

const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtH = (v: number) => `${String(v).padStart(4, '0').slice(0, 2)}:${String(v).padStart(4, '0').slice(2)}`
const linkDe = (token: string) => `${window.location.origin}/ficha/${token}`

// Las fichas firmadas marcan el paso; los otros dos salen de lo que ya guarda la reserva.
const pasos = (r: Reserva) => {
  const firmadas = r.fichas_riesgo.filter(f => f.aceptada_at).length
  return [
    { label: 'Links', ok: r.fichas_riesgo.length > 0 },
    { label: 'Fichas', ok: r.fichas_riesgo.length > 0 && firmadas === r.fichas_riesgo.length },
    { label: 'Voló', ok: r.volo },
  ]
}

export default function DiaDeVuelo() {
  const router = useRouter()
  const sb = useRef(createClient()).current
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState<number | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await sb
      .from('reservas')
      .select('id, nombre, telefono, cantidad, horario_id, volo, reservas_personas(id, nombre), fichas_riesgo(id, token, nombre, aceptada_at)')
      .eq('fecha', hoy())
      .order('horario_id')
    setReservas((data as Reserva[]) ?? [])
    setLoading(false)
  }, [sb])

  useEffect(() => {
    sb.from('horarios').select('id, horario').then(({ data }) => setHorarios(data ?? []))
    cargar()
    // El pasajero firma desde su teléfono: refrescamos para que el estado aparezca solo.
    const t = setInterval(cargar, 15000)
    return () => clearInterval(t)
  }, [sb, cargar])

  const horLabel = (id: number | null) => {
    const h = horarios.find(x => x.id === id)
    return h ? fmtH(h.horario) : '--:--'
  }

  const generar = async (r: Reserva) => {
    setGenerando(r.id)
    await sb.rpc('generar_fichas', { p_reserva_id: r.id })
    await cargar()
    setGenerando(null)
  }

  const copiar = async (texto: string, marca: string) => {
    await navigator.clipboard.writeText(texto)
    setCopiado(marca)
    setTimeout(() => setCopiado(null), 1500)
  }

  const whatsapp = (r: Reserva) => {
    const pendientes = r.fichas_riesgo.filter(f => !f.aceptada_at)
    const cuerpo = [
      `Hola ${r.nombre}! Antes del vuelo necesitamos que cada pasajero complete su ficha de aceptación de riesgo.`,
      '',
      ...pendientes.map((f, i) => `${i + 1}. ${f.nombre || `Pasajero ${i + 1}`}: ${linkDe(f.token)}`),
      '',
      'Cada link es personal: compártelo con quien corresponda. ¡Nos vemos!',
    ].join('\n')
    const tel = r.telefono ? String(r.telefono).replace(/\D/g, '') : ''
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(cuerpo)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 rounded-full border-[3px] border-[#2e6db4] border-t-transparent animate-spin" />
        <p className="text-[#2e6db4] text-sm">Cargando...</p>
      </div>
    )
  }

  if (reservas.length === 0) {
    return <p className="text-center text-[#b0cce8] text-sm py-24 italic">Hoy no hay reservas</p>
  }

  return (
    <main className="max-w-lg mx-auto pb-28 px-4 pt-4 space-y-3">
      {reservas.map(r => {
        const fichas = r.fichas_riesgo
        const firmadas = fichas.filter(f => f.aceptada_at).length
        const faltan = fichas.filter(f => !f.aceptada_at)

        return (
          <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'linear-gradient(135deg,#2e6db4,#1a4a85)' }}>
              <span className="text-white font-extrabold text-sm">{horLabel(r.horario_id)}</span>
              <span className="text-white/90 text-sm flex-1 truncate">{r.nombre}</span>
              <span className="text-white/70 text-xs">{r.cantidad} pax</span>
            </div>

            {/* Paso a paso */}
            <div className="flex items-center gap-1 px-4 pt-3">
              {pasos(r).map((p, i) => (
                <div key={p.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${p.ok ? 'bg-[#2e9e52]' : 'bg-gray-300'}`} />
                    <span className={`text-[10px] mt-1 ${p.ok ? 'text-[#2e9e52] font-bold' : 'text-gray-400'}`}>{p.label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mx-1 mb-4 ${p.ok ? 'bg-[#2e9e52]' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>

            <div className="px-4 py-3">
              {fichas.length === 0 ? (
                <button onClick={() => generar(r)} disabled={generando === r.id}
                  className="w-full py-3 rounded-xl bg-[#ffd700] text-[#0d2b5c] font-bold text-sm disabled:opacity-60">
                  {generando === r.id ? 'Generando...' : `Generar ${r.cantidad} ${r.cantidad === 1 ? 'link' : 'links'}`}
                </button>
              ) : (
                <>
                  <p className="text-[#1a4a85] text-xs font-bold uppercase tracking-wide mb-2">
                    Fichas {firmadas}/{fichas.length}
                  </p>
                  <div className="space-y-1.5 mb-3">
                    {fichas.map((f, i) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <span className="text-base shrink-0">{f.aceptada_at ? '✅' : '⏳'}</span>
                        <span className={`text-sm flex-1 truncate ${f.aceptada_at ? 'text-[#2e9e52] font-semibold' : 'text-gray-600'}`}>
                          {f.nombre || `Pasajero ${i + 1}`}
                        </span>
                        {!f.aceptada_at && (
                          <button onClick={() => copiar(linkDe(f.token), f.token)}
                            className="text-xs font-semibold text-[#2e6db4] px-2 py-1 rounded-lg hover:bg-blue-50">
                            {copiado === f.token ? 'copiado' : 'copiar link'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {faltan.length > 0 && (
                      <>
                        <button onClick={() => whatsapp(r)}
                          className="flex-1 py-2.5 rounded-xl bg-[#25d366] text-white font-bold text-xs">
                          Enviar por WhatsApp
                        </button>
                        <button onClick={() => copiar(faltan.map(f => linkDe(f.token)).join('\n'), `todos-${r.id}`)}
                          className="px-3 py-2.5 rounded-xl bg-blue-50 text-[#2e6db4] font-bold text-xs">
                          {copiado === `todos-${r.id}` ? 'copiados' : 'copiar todos'}
                        </button>
                      </>
                    )}
                    <button onClick={() => router.push(`/reserva/${r.id}`)}
                      className="px-3 py-2.5 rounded-xl bg-[#0d2b5c] text-white font-bold text-xs">
                      Abrir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}
    </main>
  )
}
