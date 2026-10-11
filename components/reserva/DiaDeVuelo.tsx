'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Ficha = { id: number; token: string; nombre: string | null; aceptada_at: string | null; persona_id: number | null }
type Persona = { id: number; nombre: string; sin_camara: boolean; camara_normal: boolean; camara_360: boolean }
type Pago = { id: number; monto: number; metodos_pago: { nombre: string } | null }
type Servicio = { id: number; valores: { monto: number; descuento: boolean } | null }
type Reserva = {
  id: number; nombre: string; telefono: number | null; cantidad: number
  horario_id: number | null; volo: boolean; abono: number | null
  reservas_personas: Persona[]
  fichas_riesgo: Ficha[]
  reserva_servicios: Servicio[]
  reserva_pagos: Pago[]
}
type Horario = { id: number; horario: number }
type Metodo = { id: number; nombre: string }
type CamaraOp = 'sin_camara' | 'camara_normal' | 'camara_360'

const CAMARAS: { op: CamaraOp; label: string }[] = [
  { op: 'sin_camara', label: 'Sin cámara' },
  { op: 'camara_normal', label: 'Normal' },
  { op: 'camara_360', label: '360°' },
]

const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtH = (v: number) => `${String(v).padStart(4, '0').slice(0, 2)}:${String(v).padStart(4, '0').slice(2)}`
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`
const linkDe = (token: string) => `${window.location.origin}/ficha/${token}`
const tieneCamara = (p: Persona) => p.sin_camara || p.camara_normal || p.camara_360

// Manda el ultimo dato: firmar escribe en reservas_personas y el detalle tambien,
// asi que esa es la lista buena. La ficha solo cubre el caso sin pasajero enlazado.
const nombreDe = (f: Ficha, r: Reserva, i: number) =>
  r.reservas_personas.find(p => p.id === f.persona_id)?.nombre || f.nombre || `Pasajero ${i + 1}`

// Mismo cálculo que el detalle de la reserva: neto menos abono menos pagos.
const saldo = (r: Reserva) => {
  const bruto = r.reserva_servicios.filter(s => !s.valores?.descuento).reduce((t, s) => t + (s.valores?.monto ?? 0), 0)
  const dcto = r.reserva_servicios.filter(s => s.valores?.descuento).reduce((t, s) => t + (s.valores?.monto ?? 0), 0)
  const pagado = r.reserva_pagos.reduce((t, p) => t + p.monto, 0) + (r.abono ?? 0)
  return { neto: bruto - dcto, pagado, resta: bruto - dcto - pagado }
}

const pasos = (r: Reserva) => {
  const fichas = r.fichas_riesgo
  const firmadas = fichas.filter(f => f.aceptada_at).length
  const pax = r.reservas_personas
  const { neto, resta } = saldo(r)
  return [
    { label: 'Links', ok: fichas.length > 0 },
    { label: 'Fichas', ok: fichas.length > 0 && firmadas === fichas.length },
    { label: 'Pago', ok: neto > 0 && resta <= 0 },
    { label: 'Cámara', ok: pax.length > 0 && pax.every(tieneCamara) },
    { label: 'Voló', ok: r.volo },
  ]
}

const SECCION = 'text-[#1a4a85] text-xs font-bold uppercase tracking-wide mb-2'

export default function DiaDeVuelo() {
  const router = useRouter()
  const sb = useRef(createClient()).current
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [metodos, setMetodos] = useState<Metodo[]>([])
  const [loading, setLoading] = useState(true)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  // Formulario de pago, por reserva abierta
  const [metodoId, setMetodoId] = useState<number | null>(null)
  const [monto, setMonto] = useState('')
  const [pagoError, setPagoError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await sb
      .from('reservas')
      .select(`id, nombre, telefono, cantidad, horario_id, volo, abono,
               reservas_personas(id, nombre, sin_camara, camara_normal, camara_360),
               fichas_riesgo(id, token, nombre, aceptada_at, persona_id),
               reserva_servicios(id, valores(monto, descuento)),
               reserva_pagos(id, monto, metodos_pago(nombre))`)
      .eq('fecha', hoy())
      .order('horario_id')
    setReservas((data as unknown as Reserva[]) ?? [])
    setLoading(false)
  }, [sb])

  useEffect(() => {
    sb.from('horarios').select('id, horario').then(({ data }) => setHorarios(data ?? []))
    sb.from('metodos_pago').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => setMetodos(data ?? []))
    cargar()
    // El pasajero firma desde su teléfono: refrescamos para que el estado aparezca solo.
    const t = setInterval(cargar, 15000)
    return () => clearInterval(t)
  }, [sb, cargar])

  const horLabel = (id: number | null) => {
    const h = horarios.find(x => x.id === id)
    return h ? fmtH(h.horario) : '--:--'
  }

  const conBloqueo = async (marca: string, fn: () => PromiseLike<unknown>) => {
    setOcupado(marca)
    await fn()
    await cargar()
    setOcupado(null)
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
      ...pendientes.map((f, i) => `${i + 1}. ${nombreDe(f, r, i)}: ${linkDe(f.token)}`),
      '',
      'Cada link es personal: compártelo con quien corresponda. ¡Nos vemos!',
    ].join('\n')
    const tel = r.telefono ? String(r.telefono).replace(/\D/g, '') : ''
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(cuerpo)}`, '_blank')
  }

  const agregarPago = async (r: Reserva) => {
    setPagoError(null)
    const valor = parseInt(monto, 10)
    if (!metodoId || !Number.isFinite(valor) || valor <= 0) {
      setPagoError('Elige el método y escribe el monto')
      return
    }
    setOcupado(`pago-${r.id}`)
    const { error } = await sb.from('reserva_pagos').insert({ reserva_id: r.id, metodo_pago_id: metodoId, monto: valor })
    setOcupado(null)
    if (error) {
      setPagoError(error.message)
      return
    }
    setMetodoId(null)
    setMonto('')
    cargar()
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
        const etapas = pasos(r)
        const listas = etapas.filter(e => e.ok).length
        const completa = listas === etapas.length
        const fichas = r.fichas_riesgo
        const firmadas = fichas.filter(f => f.aceptada_at).length
        const faltan = fichas.filter(f => !f.aceptada_at)
        const { neto, pagado, resta } = saldo(r)
        const expandida = abierta === r.id

        return (
          <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => setAbierta(expandida ? null : r.id)} className="w-full text-left">
              <div className="flex items-center gap-3 px-4 py-3"
                style={{ background: completa
                  ? 'linear-gradient(135deg,#2e9e52,#1e7a3c)'
                  : r.volo ? 'linear-gradient(135deg,#9b59b6,#7d3c98)' : 'linear-gradient(135deg,#2e6db4,#1a4a85)' }}>
                <span className="text-white font-extrabold text-sm">{horLabel(r.horario_id)}</span>
                <span className="text-white/90 text-sm flex-1 truncate">{r.nombre}</span>
                <span className="text-white/70 text-xs">{r.cantidad} pax</span>
                <span className={`text-xs font-bold ${completa ? 'text-white' : 'text-white/70'}`}>
                  {completa ? '✓ listo' : `${listas}/${etapas.length}`}
                </span>
                <span className="text-white/70 text-xs">{expandida ? '▴' : '▾'}</span>
              </div>

              <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1">
                {etapas.map(p => (
                  <span key={p.label}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      p.ok ? 'bg-[#e6f4ea] text-[#2e9e52]' : 'bg-gray-100 text-gray-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${p.ok ? 'bg-[#2e9e52]' : 'bg-gray-300'}`} />
                    {p.label}
                  </span>
                ))}
              </div>

              {completa && (
                <p className="mx-4 mb-3 mt-1 py-1.5 rounded-lg bg-[#e6f4ea] text-[#2e9e52] text-xs font-bold text-center">
                  ✓ Todo listo
                </p>
              )}
            </button>

            {expandida && (
              <div className="px-4 pb-4 pt-1 space-y-5">
                {/* ── Fichas ── */}
                <div>
                  <p className={SECCION}>Fichas {fichas.length > 0 && `${firmadas}/${fichas.length}`}</p>
                  {fichas.length === 0 ? (
                    <button onClick={() => conBloqueo(`gen-${r.id}`, () => sb.rpc('generar_fichas', { p_reserva_id: r.id }))}
                      disabled={ocupado === `gen-${r.id}`}
                      className="w-full py-3 rounded-xl bg-[#ffd700] text-[#0d2b5c] font-bold text-sm disabled:opacity-60">
                      {ocupado === `gen-${r.id}` ? 'Generando...' : `Generar ${r.cantidad} ${r.cantidad === 1 ? 'link' : 'links'}`}
                    </button>
                  ) : (
                    <>
                      <div className="space-y-1.5 mb-3">
                        {fichas.map((f, i) => (
                          <div key={f.id} className="flex items-center gap-2">
                            <span className="text-base shrink-0">{f.aceptada_at ? '✅' : '⏳'}</span>
                            <span className={`text-sm flex-1 truncate ${f.aceptada_at ? 'text-[#2e9e52] font-semibold' : 'text-gray-600'}`}>
                              {nombreDe(f, r, i)}
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
                      {faltan.length > 0 && (
                        <div className="flex gap-2">
                          <button onClick={() => whatsapp(r)}
                            className="flex-1 py-2.5 rounded-xl bg-[#25d366] text-white font-bold text-xs">
                            Enviar por WhatsApp
                          </button>
                          <button onClick={() => copiar(faltan.map(f => linkDe(f.token)).join('\n'), `todos-${r.id}`)}
                            className="px-3 py-2.5 rounded-xl bg-blue-50 text-[#2e6db4] font-bold text-xs">
                            {copiado === `todos-${r.id}` ? 'copiados' : 'copiar todos'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Pago ── */}
                <div>
                  <p className={SECCION}>Pago</p>
                  {neto === 0 ? (
                    <p className="text-gray-500 text-sm mb-2">Sin servicios cargados. Agrégalos en el detalle.</p>
                  ) : (
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="text-gray-600">Total {fmtCLP(neto)} · pagado {fmtCLP(pagado)}</span>
                      <span className={`font-bold ${resta <= 0 ? 'text-[#2e9e52]' : 'text-red-500'}`}>
                        {resta <= 0 ? 'Pagado' : `Faltan ${fmtCLP(resta)}`}
                      </span>
                    </div>
                  )}

                  {r.reserva_pagos.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {r.reserva_pagos.map(p => (
                        <p key={p.id} className="text-xs text-gray-500">💳 {p.metodos_pago?.nombre} · {fmtCLP(p.monto)}</p>
                      ))}
                    </div>
                  )}

                  {resta > 0 && (
                    <>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {metodos.map(m => (
                          <button key={m.id} onClick={() => setMetodoId(m.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              metodoId === m.id ? 'bg-[#2e6db4] text-white' : 'bg-gray-100 text-gray-600'}`}>
                            {m.nombre}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input inputMode="numeric" placeholder={String(resta)} value={monto}
                          onChange={e => setMonto(e.target.value)}
                          className="flex-1 px-3 py-2.5 rounded-xl bg-gray-100 text-[#0d2b5c] text-sm outline-none" />
                        <button onClick={() => agregarPago(r)} disabled={ocupado === `pago-${r.id}`}
                          className="px-4 py-2.5 rounded-xl bg-[#2e9e52] text-white font-bold text-xs disabled:opacity-60">
                          Cobrar
                        </button>
                      </div>
                      {pagoError && <p className="text-red-500 text-xs mt-1">{pagoError}</p>}
                    </>
                  )}
                </div>

                {/* ── Cámara ── */}
                <div>
                  <p className={SECCION}>Cámara</p>
                  {r.reservas_personas.length === 0 ? (
                    <p className="text-gray-500 text-sm">Aparecen aquí cuando firmen su ficha.</p>
                  ) : (
                    <div className="space-y-2">
                      {r.reservas_personas.map(p => (
                        <div key={p.id} className="flex items-center gap-2">
                          <span className="text-sm text-gray-700 w-24 truncate shrink-0">{p.nombre}</span>
                          <div className="flex gap-1 flex-1">
                            {CAMARAS.map(c => {
                              const activa = p[c.op]
                              return (
                                <button key={c.op}
                                  onClick={() => conBloqueo(`cam-${p.id}`, () => sb.from('reservas_personas').update({
                                    sin_camara: c.op === 'sin_camara',
                                    camara_normal: c.op === 'camara_normal',
                                    camara_360: c.op === 'camara_360',
                                  }).eq('id', p.id))}
                                  disabled={ocupado === `cam-${p.id}`}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${
                                    activa ? 'bg-[#2e6db4] text-white' : 'bg-gray-100 text-gray-600'}`}>
                                  {c.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Cierre ── */}
                <div className="flex gap-2">
                  <button onClick={() => conBloqueo(`volo-${r.id}`, () => sb.from('reservas').update({ volo: !r.volo }).eq('id', r.id))}
                    disabled={ocupado === `volo-${r.id}`}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-60 ${
                      r.volo ? 'bg-[#9b59b6] text-white' : 'bg-[#0d2b5c] text-white'}`}>
                    {r.volo ? '🪂 Voló — desmarcar' : '🪂 Marcar como voló'}
                  </button>
                  <button onClick={() => router.push(`/reserva/${r.id}`)}
                    className="px-4 py-3 rounded-xl bg-gray-100 text-[#2e6db4] font-bold text-xs">
                    Detalle
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}
