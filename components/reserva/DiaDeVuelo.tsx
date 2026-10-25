'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { May, useJerga, type Jerga } from '@/lib/jerga'
import { createClient } from '@/lib/supabase-browser'
import QRCode from 'qrcode'
import { HandCoins } from 'lucide-react'
import { abrirWhatsApp } from '@/lib/whatsapp'
import DetalleContent from '@/components/reserva/DetalleContent'
import InputMonto, { conMiles } from '@/components/InputMonto'

type Ficha = {
  id: number; token: string; nombre: string | null; aceptada_at: string | null
  persona_id: number | null; ip: string | null; edad: number | null
}
type Log = { id: number; evento: string; detalle: string | null; ip: string | null; created_at: string }
type Persona = { id: number; nombre: string; sin_camara: boolean; camara_normal: boolean; camara_360: boolean; perfil_id: string | null }
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
type Piloto = { id: string; nombre: string }
type CamaraOp = 'sin_camara' | 'camara_normal' | 'camara_360'

const CAMARAS: { op: CamaraOp; label: string }[] = [
  { op: 'sin_camara', label: 'Sin' },  // corto: "Sin cámara" partía la fila en dos líneas
  { op: 'camara_normal', label: 'Normal' },
  { op: 'camara_360', label: '360°' },
]

const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtH = (v: number) => `${String(v).padStart(4, '0').slice(0, 2)}:${String(v).padStart(4, '0').slice(2)}`
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`
const slug = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const linkDe = (token: string, nombre?: string) => {
  const base = `${window.location.origin}/ficha/${token}`
  const s = nombre ? slug(nombre) : ''
  return s ? `${base}/${s}` : base
}

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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

const pasos = (r: Reserva, j: Jerga) => {
  const fichas = r.fichas_riesgo
  const firmadas = fichas.filter(f => f.aceptada_at).length
  const pax = r.reservas_personas
  const { neto, resta } = saldo(r)
  return [
    { label: 'Links', ok: fichas.length > 0 },
    { label: 'Fichas', ok: fichas.length > 0 && firmadas === fichas.length },
    { label: 'Pago', ok: neto > 0 && resta <= 0 },
    { label: 'Cámara', ok: pax.length > 0 && pax.every(tieneCamara) },
    { label: May(j.realizado), ok: r.volo },
  ]
}

const SECCION = 'text-[#1a4a85] text-xs font-bold uppercase tracking-wide mb-2'
// Botón cuadrado chico, el mismo para "+" y para el piloto
const CUADRADO = 'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold disabled:opacity-60'

// Lucide no trae parapente: vela, líneas y piloto
const Parapente = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
    <path d="M2.5 9c3.5-5 15.5-5 19 0" />
    <path d="M2.5 9 12 18.5M21.5 9 12 18.5M8 6.8l4 11.7M16 6.8l-4 11.7" strokeWidth="1" />
    <circle cx="12" cy="20" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)

export default function DiaDeVuelo() {
  const j = useJerga()
  const router = useRouter()
  const sb = useRef(createClient()).current
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [metodos, setMetodos] = useState<Metodo[]>([])
  const [loading, setLoading] = useState(true)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<number, Log[]>>({})
  const [pilotos, setPilotos] = useState<Piloto[]>([])
  // QR de las fichas pendientes, uno por pasajero; se recorren con las flechas
  // Pasajero al que se le está eligiendo piloto (modal)
  const [eligePiloto, setEligePiloto] = useState<Persona | null>(null)
  // Detalle completo o solo pagos, en un modal sobre Hoy
  const [modal, setModal] = useState<{ id: number; soloPagos: boolean } | null>(null)
  const [qr, setQr] = useState<{ items: { nombre: string; link: string }[]; i: number; img: string } | null>(null)

  // Formulario de pago, por reserva abierta
  const [metodoId, setMetodoId] = useState<number | null>(null)
  const [monto, setMonto] = useState('')
  const [pagoError, setPagoError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await sb
      .from('reservas')
      .select(`id, nombre, telefono, cantidad, horario_id, volo, abono,
               reservas_personas(id, nombre, sin_camara, camara_normal, camara_360, perfil_id),
               fichas_riesgo(id, token, nombre, aceptada_at, persona_id, ip, edad),
               reserva_servicios(id, valores(monto, descuento)),
               reserva_pagos(id, monto, metodos_pago(nombre))`)
      .eq('fecha', hoy())
      // sin orden los pasajeros cambian de lugar cada vez que se edita uno
      .order('id', { referencedTable: 'reservas_personas' })
      .order('id', { referencedTable: 'fichas_riesgo' })
    setReservas((data as unknown as Reserva[]) ?? [])
    setLoading(false)
  }, [sb])

  useEffect(() => {
    sb.from('horarios').select('id, horario').then(({ data }) => setHorarios(data ?? []))
    sb.from('metodos_pago').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => setMetodos(data ?? []))
    // Igual que el detalle de la reserva: los que tienen un rol "piloto"
    sb.from('roles').select('id').ilike('nombre', '%piloto%').then(async ({ data: roles }) => {
      if (!roles?.length) return
      const { data } = await sb.from('perfil_roles').select('perfiles(id, nombre)').in('rol_id', roles.map(r => r.id))
      const map = new Map<string, Piloto>()
      ;((data ?? []) as unknown as { perfiles: Piloto | null }[]).forEach(r => { if (r.perfiles) map.set(r.perfiles.id, r.perfiles) })
      setPilotos([...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    })
    cargar()
    // El pasajero firma desde su teléfono: refrescamos para que el estado aparezca solo.
    const t = setInterval(cargar, 15000)
    return () => clearInterval(t)
  }, [sb, cargar])

  const horaDe = (id: number | null) => horarios.find(x => x.id === id)?.horario ?? 9999
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

  const verLog = async (fichaId: number) => {
    if (logs[fichaId]) return setLogs(prev => { const n = { ...prev }; delete n[fichaId]; return n })
    const { data } = await sb
      .from('fichas_log')
      .select('id, evento, detalle, ip, created_at')
      .eq('ficha_id', fichaId)
      .order('created_at', { ascending: false })
    setLogs(prev => ({ ...prev, [fichaId]: data ?? [] }))
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
      ...pendientes.map((f, i) => `${i + 1}. ${nombreDe(f, r, i)}: ${linkDe(f.token, nombreDe(f, r, i))}`),
      '',
      'Cada link es personal: compártelo con quien corresponda. ¡Nos vemos!',
    ].join('\n')
    const tel = r.telefono ? String(r.telefono).replace(/\D/g, '') : ''
    abrirWhatsApp(cuerpo, tel)
  }

  const verQr = async (items: { nombre: string; link: string }[], i: number) => {
    const img = await QRCode.toDataURL(items[i].link, { width: 280, margin: 1 })
    setQr({ items, i, img })
  }

  // Un pasajero más: sube la cantidad y generar_fichas le crea su ficha y su link
  const agregarPasajero = (r: Reserva) => conBloqueo(`pax-${r.id}`, async () => {
    await sb.from('reservas').update({ cantidad: r.cantidad + 1 }).eq('id', r.id)
    await sb.rpc('generar_fichas', { p_reserva_id: r.id })
  })

  // Solo el pasajero todavía en blanco ("Pasajero 3", sin ficha firmada) se puede
  // quitar desde acá; el que ya firmó tiene datos y se maneja en el detalle.
  const borrable = (p: Persona, r: Reserva) =>
    /^Pasajero \d+$/.test(p.nombre) && !r.fichas_riesgo.some(f => f.persona_id === p.id && f.aceptada_at)

  // La ficha sin firmar se va con él (trigger en la base); acá solo baja la cantidad
  const quitarPasajero = (p: Persona, r: Reserva) => {
    if (!confirm(`¿Quitar a ${p.nombre}? Su link de ficha deja de funcionar.`)) return
    return conBloqueo(`del-${p.id}`, async () => {
      await sb.from('reservas_personas').delete().eq('id', p.id)
      await sb.from('reservas').update({ cantidad: Math.max(r.cantidad - 1, 0) }).eq('id', r.id)
    })
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
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setModal(null); cargar() }} />
          <div className="relative w-full max-w-2xl rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            style={{ maxHeight: '92vh', background: 'linear-gradient(160deg,#e8f2ff 0%,#d0e6ff 100%)' }}>
            <div className="flex items-center gap-3 px-5 py-4 shrink-0"
              style={{ background: 'linear-gradient(135deg,#0d2b5c 0%,#1a4a85 100%)' }}>
              <span className="text-white font-extrabold text-base flex-1">
                {modal.soloPagos ? 'Servicios y pagos' : 'Detalle de la reserva'}
              </span>
              <button onClick={() => { setModal(null); cargar() }} aria-label="Cerrar"
                className="text-[#7aafd4] hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <DetalleContent id={String(modal.id)} soloPagos={modal.soloPagos} onSave={cargar}
                onDelete={() => { setModal(null); cargar() }} />
            </div>
          </div>
        </div>
      )}
      {eligePiloto && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setEligePiloto(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-sm bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center px-5 pt-4 pb-3 border-b border-gray-100">
              <p className="flex-1 text-[#0d2b5c] font-bold">{May(j.operador)} de {eligePiloto.nombre}</p>
              <button onClick={() => setEligePiloto(null)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1.5">
              {pilotos.map(pl => {
                const elegido = pl.id === eligePiloto.perfil_id
                return (
                  <button key={pl.id}
                    onClick={() => {
                      const pax = eligePiloto
                      setEligePiloto(null)
                      if (!elegido) conBloqueo(`pil-${pax.id}`, () => sb.from('reservas_personas').update({ perfil_id: pl.id }).eq('id', pax.id))
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold ${
                      elegido ? 'bg-[#2e9e52] text-white' : 'bg-gray-50 text-[#0d2b5c] hover:bg-blue-50'}`}>
                    <Parapente />
                    <span className="flex-1 truncate">{pl.nombre}</span>
                    {elegido && <span>✓</span>}
                  </button>
                )
              })}
              {eligePiloto.perfil_id && (
                <button onClick={() => {
                    const pax = eligePiloto
                    setEligePiloto(null)
                    conBloqueo(`pil-${pax.id}`, () => sb.from('reservas_personas').update({ perfil_id: null }).eq('id', pax.id))
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50">
                  Quitar {j.operador}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" onClick={() => setQr(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-xs text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setQr(null)} aria-label="Cerrar"
              className="absolute top-2 right-3 text-gray-400 hover:text-gray-700 text-lg">✕</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.img} alt={`QR de la ficha de ${qr.items[qr.i].nombre}`} className="w-full aspect-square" />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => verQr(qr.items, (qr.i - 1 + qr.items.length) % qr.items.length)}
                disabled={qr.items.length < 2} aria-label="Anterior"
                className="w-10 h-10 rounded-full bg-blue-50 text-[#2e6db4] text-xl font-bold disabled:opacity-30">‹</button>
              <div className="flex-1 min-w-0">
                <p className="text-[#0d2b5c] font-bold truncate">{qr.items[qr.i].nombre}</p>
                <p className="text-gray-400 text-xs">{qr.i + 1} de {qr.items.length}</p>
              </div>
              <button onClick={() => verQr(qr.items, (qr.i + 1) % qr.items.length)}
                disabled={qr.items.length < 2} aria-label="Siguiente"
                className="w-10 h-10 rounded-full bg-blue-50 text-[#2e6db4] text-xl font-bold disabled:opacity-30">›</button>
            </div>
          </div>
        </div>
      )}
      {/* Por la hora: el id del horario no sigue el orden del día */}
      {[...reservas].sort((a, b) => horaDe(a.horario_id) - horaDe(b.horario_id)).map(r => {
        const etapas = pasos(r, j)
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
                // Voló manda: el morado de siempre, aunque esté todo listo (pedido de la operación)
                style={{ background: r.volo ? 'linear-gradient(135deg,#9b59b6,#7d3c98)' : 'linear-gradient(135deg,#2e6db4,#1a4a85)' }}>
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
                          <div key={f.id}>
                            <div className="flex items-center gap-2">
                              <span className="text-base shrink-0">{f.aceptada_at ? '✅' : '⏳'}</span>
                              <span className={`text-sm flex-1 truncate ${f.aceptada_at ? 'text-[#2e9e52] font-semibold' : 'text-gray-600'}`}>
                                {nombreDe(f, r, i)}
                                {f.edad != null && f.edad < 18 && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold align-middle">menor</span>
                                )}
                              </span>
                              {f.aceptada_at && (
                                <button onClick={() => router.push(`/fichas/${f.id}`)}
                                  className="text-xs font-semibold text-[#2e6db4] px-2 py-1 rounded-lg hover:bg-blue-50">
                                  ver ficha
                                </button>
                              )}
                              <button onClick={() => verLog(f.id)}
                                className="text-xs font-semibold text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100">
                                registro
                              </button>
                              {!f.aceptada_at && (
                                <button onClick={() => copiar(linkDe(f.token, nombreDe(f, r, i)), f.token)}
                                  className="text-xs font-semibold text-[#2e6db4] px-2 py-1 rounded-lg hover:bg-blue-50">
                                  {copiado === f.token ? 'copiado' : 'copiar link'}
                                </button>
                              )}
                            </div>

                            {f.aceptada_at && (
                              <p className="text-[11px] text-gray-400 ml-7">
                                firmada {fmtFecha(f.aceptada_at)}{f.ip ? ` · IP ${f.ip}` : ''}
                              </p>
                            )}

                            {logs[f.id] && (
                              <div className="ml-7 mt-1 mb-2 p-2 rounded-lg bg-gray-50 space-y-1">
                                {logs[f.id].length === 0 ? (
                                  <p className="text-[11px] text-gray-400">Sin intentos registrados.</p>
                                ) : logs[f.id].map(l => (
                                  <p key={l.id} className="text-[11px] text-gray-500">
                                    <span className={l.evento === 'firmada' ? 'text-[#2e9e52] font-bold' : 'text-red-400 font-bold'}>
                                      {l.evento}
                                    </span>
                                    {' '}{fmtFecha(l.created_at)}{l.ip ? ` · ${l.ip}` : ''}
                                    {l.detalle ? ` · ${l.detalle}` : ''}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {faltan.length > 0 && (
                        <div className="flex gap-2">
                          <button onClick={() => whatsapp(r)}
                            className="flex-1 py-2 rounded-xl bg-[#25d366] text-white font-bold text-xs">
                            WhatsApp
                          </button>
                          <button onClick={() => verQr(faltan.map((f, i) => ({ nombre: nombreDe(f, r, i), link: linkDe(f.token, nombreDe(f, r, i)) })), 0)}
                            className="flex-1 py-2 rounded-xl bg-[#0d2b5c] text-white font-bold text-xs">
                            QR
                          </button>
                          <button onClick={() => copiar(faltan.map(f => linkDe(f.token)).join('\n'), `todos-${r.id}`)}
                            className="flex-1 py-2 rounded-xl bg-blue-50 text-[#2e6db4] font-bold text-xs">
                            {copiado === `todos-${r.id}` ? 'copiados' : 'copiar todos'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Pago ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={SECCION.replace('mb-2', '')}>Pago</p>
                    <button onClick={() => setModal({ id: r.id, soloPagos: true })} title="Servicios y pagos"
                      aria-label="Servicios y pagos"
                      className={`${CUADRADO} bg-[#2e9e52] text-white shadow-sm hover:brightness-110 active:scale-95 transition`}>
                      <HandCoins className="w-5 h-5" strokeWidth={2.2} />
                    </button>
                  </div>
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
                        <InputMonto placeholder={conMiles(String(resta))} value={monto} onChange={setMonto}
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
                  <div className="flex items-center justify-between mb-2">
                    <p className={SECCION.replace('mb-2', '')}>{May(j.cliente_plural)} y cámara</p>
                    <button onClick={() => agregarPasajero(r)} disabled={ocupado === `pax-${r.id}`}
                      title={`Agregar ${j.cliente}: queda en blanco hasta que firme su ficha`}
                      className="h-8 px-3 shrink-0 rounded-lg bg-blue-50 text-[#2e6db4] text-xs font-bold disabled:opacity-60">
                      {ocupado === `pax-${r.id}` ? 'Agregando…' : `${May(j.cliente)} +`}
                    </button>
                  </div>
                  {r.reservas_personas.length === 0 ? (
                    <p className="text-gray-500 text-sm">Aparecen aquí cuando firmen su ficha.</p>
                  ) : (
                    <div className="space-y-2">
                      {r.reservas_personas.map(p => (
                        <div key={p.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-24 shrink-0 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-sm text-gray-700 truncate">{p.nombre}</p>
                              {borrable(p, r) && (
                                <button onClick={() => quitarPasajero(p, r)} disabled={ocupado === `del-${p.id}`}
                                  title={`Quitar ${p.nombre}`} aria-label={`Quitar ${p.nombre}`}
                                  className="shrink-0 w-5 h-5 rounded-full text-gray-400 hover:text-white hover:bg-red-500 text-xs leading-5 disabled:opacity-40">
                                  ✕
                                </button>
                              )}
                            </div>
                            {p.perfil_id && (
                              <p className="text-[11px] text-[#2e9e52] font-semibold truncate">
                                {pilotos.find(pl => pl.id === p.perfil_id)?.nombre}
                              </p>
                            )}
                          </div>
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
                                  title={c.op === 'sin_camara' ? 'Sin cámara' : `Cámara ${c.label}`}
                                  className={`flex-1 h-8 rounded-lg text-xs font-semibold whitespace-nowrap disabled:opacity-60 ${
                                    activa ? 'bg-[#2e6db4] text-white' : 'bg-gray-100 text-gray-600'}`}>
                                  {c.label}
                                </button>
                              )
                            })}
                          </div>
                          <button onClick={() => setEligePiloto(p)} disabled={ocupado === `pil-${p.id}`}
                            title={p.perfil_id ? `${May(j.operador)}: ${pilotos.find(pl => pl.id === p.perfil_id)?.nombre ?? ''}` : `Asignar ${j.operador}`}
                            aria-label={`${May(j.operador)} de ${p.nombre}`}
                            className={`${CUADRADO} ${p.perfil_id ? 'bg-[#2e9e52] text-white' : 'bg-gray-100 text-gray-500'}`}>
                            <Parapente />
                          </button>
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
                    {r.volo ? `🪂 ${May(j.realizado)} — desmarcar` : `🪂 Marcar como ${j.realizado}`}
                  </button>
                  <button onClick={() => setModal({ id: r.id, soloPagos: false })}
                    className="px-4 py-3 rounded-xl bg-white border-2 border-[#2e6db4] text-[#2e6db4] font-bold text-sm shadow-sm hover:bg-blue-50 active:scale-95 transition">
                    ✎ Detalle
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
