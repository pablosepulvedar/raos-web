'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import DetalleContent from '@/components/reserva/DetalleContent'

type Horario  = { id: number; horario: number }
type Valor    = { id: number; servicio: string; monto: number }
type PaxCard  = { id: number; nombre: string; camara_normal: boolean; camara_360: boolean; sin_camara: boolean; cumpleanero: boolean }
type Reserva  = { id: number; nombre: string; telefono: number; fecha: string; horario_id: number; cantidad: number; volo: boolean; reservas_personas?: PaxCard[] }
type SrvSel   = { id: number; servicio: string; monto: number; cantidad: number }

const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_L = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']
const CAL_D  = ['D','L','M','M','J','V','S']
const fmtH   = (v: number) => { const s = String(v).padStart(4,'0'); return `${s.slice(0,2)}:${s.slice(2)}` }
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`
const toStr  = (d: Date)   => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays = (s: string, n: number) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return toStr(d) }

const STEP = 2

export default function Reservas() {
  const router = useRouter()
  const today  = toStr(new Date())
  const sb     = useRef(createClient()).current

  const initStart = useRef(addDays(today, -2)).current
  const initEnd   = useRef(addDays(today,  2)).current

  // Calendar
  const [showCal, setShowCal]       = useState(false)
  const [calM, setCalM]             = useState(new Date().getMonth())
  const [calY, setCalY]             = useState(new Date().getFullYear())
  const [dots, setDots]             = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState(today)

  // Data
  const [byDate, setByDate]   = useState<Record<string, Reserva[]>>({})
  const [windowEnd, setWindowEnd]       = useState(initEnd)
  const windowEndRef                    = useRef(initEnd)
  const [windowStart, setWindowStart]   = useState(initStart)
  const windowStartRef                  = useRef(initStart)
  const loadingMoreRef                  = useRef(false)
  const loadingPrevRef                  = useRef(false)
  const [loading, setLoading]           = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [loadingPrev, setLoadingPrev]   = useState(false)
  const listRef                         = useRef<HTMLDivElement>(null)

  const [horarios, setHorarios] = useState<Horario[]>([])
  const [valores,  setValores]  = useState<Valor[]>([])

  // Detail modal (md+)
  const [detailId, setDetailId] = useState<string|null>(null)

  // Form
  const [showForm, setShowForm]   = useState(false)
  const [formDate, setFormDate]   = useState(today)
  const [nombre, setNombre]       = useState('')
  const [telefono, setTelefono]   = useState('')
  const [horId, setHorId]         = useState<number|null>(null)
  const [showHorPk, setShowHorPk] = useState(false)
  const [cantidad, setCantidad]   = useState('')
  const [srvs, setSrvs]           = useState<SrvSel[]>([])
  const [showSrvPk, setShowSrvPk] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [fErr, setFErr]           = useState<string|null>(null)

  const [marcandoVolo, setMarcandoVolo] = useState<number|null>(null)

  const marcarVolo = async (r: Reserva, e: React.MouseEvent) => {
    e.stopPropagation()
    const msg = r.volo ? `¿Desmarcar vuelo de ${r.nombre}?` : `¿Ya voló ${r.nombre}?`
    if (!confirm(msg)) return
    setMarcandoVolo(r.id)
    await sb.from('reservas').update({ volo: !r.volo }).eq('id', r.id)
    setMarcandoVolo(null)
    await refreshWindow()
  }

  const cargarAnteriores = async () => {
    if (loadingPrevRef.current) return
    loadingPrevRef.current = true
    setLoadingPrev(true)
    const to   = addDays(windowStartRef.current, -1)
    const from = addDays(windowStartRef.current, -STEP)
    const prevData = await fetchDays(from, to)
    // Preservar scroll position al prepend
    const list = listRef.current
    const prevH = list?.scrollHeight ?? 0
    const prevTop = list?.scrollTop ?? 0
    setByDate(prev => ({ ...prevData, ...prev }))
    windowStartRef.current = from
    setWindowStart(from)
    setTimeout(() => {
      if (list) list.scrollTop = prevTop + (list.scrollHeight - prevH)
    }, 0)
    loadingPrevRef.current = false
    setLoadingPrev(false)
  }

  const sentinelRef = useRef<HTMLDivElement>(null)
  const dateRefs    = useRef<Record<string, HTMLDivElement|null>>({})

  // ── Fetch helpers ──────────────────────────────────────
  const fetchDays = useCallback(async (from: string, to: string) => {
    const { data } = await sb.from('reservas')
      .select('*, horarios(horario), reservas_personas(id, nombre, camara_normal, camara_360, sin_camara, cumpleanero)')
      .gte('fecha', from).lte('fecha', to).order('fecha')
    const rows = (data||[]) as (Reserva & { horarios?: { horario: number } | null })[]
    rows.sort((a, b) => (a.horarios?.horario ?? 9999) - (b.horarios?.horario ?? 9999))
    const g: Record<string, Reserva[]> = {}
    for (const r of rows) {
      if (!g[r.fecha]) g[r.fecha] = []
      g[r.fecha].push(r)
    }
    return g
  }, [sb])

  const fetchDots = useCallback(async (y: number, m: number) => {
    const f = `${y}-${String(m+1).padStart(2,'0')}-01`
    const l = `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
    const { data } = await sb.from('reservas').select('fecha').gte('fecha',f).lte('fecha',l)
    setDots(new Set((data||[]).map((r:any)=>r.fecha)))
  }, [sb])

  const refreshWindow = useCallback(async () => {
    const data = await fetchDays(windowStartRef.current, windowEndRef.current)
    setByDate(data)
    fetchDots(calY, calM)
  }, [fetchDays, fetchDots, calY, calM])

  // ── Initial load ───────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [data] = await Promise.all([
        fetchDays(initStart, initEnd),
        sb.from('horarios').select('*').order('horario').then(({ data }) => setHorarios((data||[]) as Horario[])),
        sb.from('valores').select('*').order('servicio').then(({ data }) => setValores((data||[]) as Valor[])),
        fetchDots(new Date().getFullYear(), new Date().getMonth()),
      ])
      setByDate(data)
      setLoading(false)
      setTimeout(() => {
        dateRefs.current[today]?.scrollIntoView({ behavior:'instant', block:'start' })
      }, 80)
    }
    load()
  }, [])


  useEffect(() => { fetchDots(calY, calM) }, [calM, calY])

  // ── Calendar ───────────────────────────────────────────
  const dIM = new Date(calY, calM+1, 0).getDate()
  const fw  = new Date(calY, calM, 1).getDay()
  const weeks: (number|null)[][] = []
  let dd = 1
  for (let w=0; w<6; w++) {
    const wk: (number|null)[] = []
    for (let i=0; i<7; i++) { if((w===0&&i<fw)||dd>dIM) wk.push(null); else { wk.push(dd); dd++ } }
    weeks.push(wk); if(dd>dIM) break
  }
  const chMo = (dir:'prev'|'next') => {
    let m=calM+(dir==='prev'?-1:1), y=calY
    if(m<0){m=11;y--} if(m>11){m=0;y++}
    setCalM(m); setCalY(y)
  }
  const selCalDay = async (ds: string) => {
    setShowCal(false)
    setSelectedDate(ds)
    // Sincroniza el mes del calendario con el día seleccionado
    const d = new Date(ds + 'T12:00:00')
    setCalM(d.getMonth())
    setCalY(d.getFullYear())
    if (ds > windowEndRef.current) {
      const newData = await fetchDays(addDays(windowEndRef.current,1), ds)
      setByDate(prev => ({ ...prev, ...newData }))
      windowEndRef.current = ds
      setWindowEnd(ds)
    } else if (ds < windowStartRef.current) {
      const newData = await fetchDays(ds, addDays(windowStartRef.current,-1))
      setByDate(prev => ({ ...newData, ...prev }))
      windowStartRef.current = ds
      setWindowStart(ds)
    }
    setTimeout(() => {
      dateRefs.current[ds]?.scrollIntoView({ behavior:'smooth', block:'start' })
    }, 200)
  }

  // ── All dates to display ───────────────────────────────
  const allDates = useMemo(() => {
    const dates: string[] = []
    const cur = new Date(windowStart+'T12:00:00')
    const end = new Date(windowEnd+'T12:00:00')
    while (cur <= end) { dates.push(toStr(cur)); cur.setDate(cur.getDate()+1) }
    return dates
  }, [windowEnd, windowStart])

  // ── Form ───────────────────────────────────────────────
  const horLabel = (id: number|null) => {
    if (!id) return '---'
    const h = horarios.find(h=>h.id===id)
    return h ? fmtH(h.horario) : '---'
  }
  const resetForm = () => {
    setNombre(''); setTelefono(''); setHorId(null); setSrvs([])
    setCantidad(''); setFErr(null); setShowHorPk(false); setShowSrvPk(false); setShowForm(false)
  }
  const addSrv = (v: Valor) => {
    setSrvs(p => { const ex=p.find(s=>s.id===v.id); return ex?p.map(s=>s.id===v.id?{...s,cantidad:s.cantidad+1}:s):[...p,{id:v.id,servicio:v.servicio,monto:v.monto,cantidad:1}] })
    setShowSrvPk(false)
  }
  const remSrv = (id: number) => setSrvs(p => {
    const it=p.find(s=>s.id===id); if(!it) return p
    if(it.cantidad<=1) return p.filter(s=>s.id!==id)
    return p.map(s=>s.id===id?{...s,cantidad:s.cantidad-1}:s)
  })
  const crearReserva = async () => {
    setFErr(null)
    const tel = Number(telefono.replace(/[^0-9]/g,''))
    if (!nombre||!telefono||!horId||!cantidad) return setFErr('Completa todos los campos')
    if (isNaN(tel)) return setFErr('Teléfono inválido')
    setSaving(true)
    try {
      const { data, error:err } = await sb.from('reservas')
        .insert({ nombre:nombre.trim(), telefono:tel, fecha:formDate, horario_id:horId, cantidad:parseInt(cantidad,10) })
        .select('id').single()
      if (err||!data) throw err||new Error('Error')
      if (srvs.length>0) {
        const rows = srvs.flatMap(item=>Array.from({length:item.cantidad},()=>({reserva_id:data.id,valor_id:item.id})))
        await sb.from('reserva_servicios').insert(rows)
      }
      resetForm(); await refreshWindow()
    } catch(e:unknown) { setFErr(e instanceof Error?e.message:'Error al crear') }
    finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen" style={{ background:'linear-gradient(160deg,#e8f2ff 0%,#d0e6ff 100%)' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-5 py-4"
        style={{ background:'linear-gradient(135deg,#0d2b5c 0%,#1a4a85 100%)', boxShadow:'0 2px 12px rgba(13,43,92,0.3)' }}>
        <Link href="/" className="text-[#7aafd4] text-sm">←</Link>
        <button onClick={() => setShowCal(!showCal)} className="flex-1 flex items-center gap-1">
          <span className="text-white font-extrabold text-lg capitalize">{MESES[new Date().getMonth()].toLowerCase()}</span>
          <span className="text-[#7aafd4] text-sm ml-0.5">▾</span>
        </button>
        <button onClick={() => setShowCal(!showCal)} className="p-1.5 text-[#7aafd4] hover:text-[#ffd700] transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </header>

      {/* ── Calendario modal ── */}
      {showCal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm px-4 pb-5 pt-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => chMo('prev')} className="text-[#1e5a96] text-2xl w-9 h-9 flex items-center justify-center font-bold hover:bg-blue-50 rounded-xl">‹</button>
              <span className="text-[#0d2b5c] font-bold text-sm">{MESES[calM]} {calY}</span>
              <button onClick={() => chMo('next')} className="text-[#1e5a96] text-2xl w-9 h-9 flex items-center justify-center font-bold hover:bg-blue-50 rounded-xl">›</button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {CAL_D.map((d,i) => <div key={i} className="text-center text-xs text-gray-400 py-1">{d}</div>)}
            </div>
            {weeks.map((wk,wi) => (
              <div key={wi} className="grid grid-cols-7">
                {wk.map((day,di) => {
                  if (!day) return <div key={di} />
                  const ds = `${calY}-${String(calM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const isSel = ds===selectedDate; const isT = ds===today; const hasDot = dots.has(ds)
                  return (
                    <div key={di} className="flex flex-col items-center mb-1">
                      <button onClick={() => selCalDay(ds)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                          ${isSel?'bg-[#2e6db4] text-white font-bold':isT?'ring-2 ring-[#2e6db4] text-[#2e6db4] font-bold':'text-gray-700 hover:bg-blue-50'}`}>
                        {day}
                      </button>
                      {hasDot && <div className="w-1.5 h-1.5 rounded-full mt-0.5 bg-[#2e6db4]" />}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lista ── */}
      <main className="max-w-lg mx-auto pb-28 px-0" ref={listRef}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 rounded-full border-[3px] border-[#2e6db4] border-t-transparent animate-spin" />
            <p className="text-[#2e6db4] text-sm">Cargando...</p>
          </div>
        ) : (
          <>
            {/* Botón cargar días anteriores */}
            <div className="flex justify-center pt-4 pb-2">
              <button
                onClick={cargarAnteriores}
                disabled={loadingPrev}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background:'rgba(46,109,180,0.15)', color:'#2e6db4' }}>
                {loadingPrev
                  ? <><div className="w-3 h-3 rounded-full border-2 border-[#2e6db4] border-t-transparent animate-spin" /> Cargando...</>
                  : '↑ Ver días anteriores'}
              </button>
            </div>

            {allDates.map(ds => {
              const reservas = byDate[ds] || []
              const date   = new Date(ds+'T12:00:00')
              const dn     = DIAS_L[date.getDay()]
              const num    = date.getDate()
              const isPast = ds < today
              const isT    = ds === today
              const dayColor  = isPast ? '#9b59b6' : isT ? '#2e6db4' : '#1e5a96'

              return (
                <div key={ds} ref={el => { dateRefs.current[ds] = el }}>
                  <div className="flex items-start gap-3 px-4 pt-5 pb-1">
                    <div className="flex flex-col items-center w-10 shrink-0 mt-0.5">
                      <span className="text-xs font-bold uppercase" style={{ color:dayColor }}>{dn}</span>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base mt-0.5 ${isT?'text-white':'text-[#0d2b5c]'}`}
                        style={{ background: isT ? '#2e6db4' : 'transparent' }}>
                        {num}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-2 pt-1">
                      {reservas.length === 0 ? (
                        <p className="text-[#b0cce8] text-sm py-2 italic">Sin reservas</p>
                      ) : reservas.map(r => {
                        const cardStyle = r.volo
                          ? { background:'linear-gradient(135deg,#9b59b6,#7d3c98)', boxShadow:'0 3px 12px rgba(155,89,182,0.4)' }
                          : isPast
                            ? { background:'linear-gradient(135deg,#7b52c1,#5e3a99)', boxShadow:'0 3px 12px rgba(123,82,193,0.3)' }
                            : { background:'linear-gradient(135deg,#2e6db4,#1a4a85)', boxShadow:'0 3px 12px rgba(46,109,180,0.3)' }
                        const pax = r.reservas_personas ?? []
                        return (
                        <div key={r.id} className="rounded-2xl overflow-hidden transition-all active:scale-[0.98]" style={cardStyle}>
                          <div className="flex items-stretch min-h-[58px]">
                            {/* Datos principales */}
                            <button
                              onClick={() => {
                                if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                                  setDetailId(String(r.id))
                                } else {
                                  router.push(`/reserva/${r.id}`)
                                }
                              }}
                              className="flex-1 text-left px-4 py-3 hover:opacity-90 min-w-0">
                              <p className="text-white font-bold text-sm leading-snug truncate">{r.nombre} × {r.cantidad}</p>
                              <p className="text-white/75 text-xs mt-0.5">{horLabel(r.horario_id)}</p>
                            </button>

                            {/* Pasajeros — columna fija siempre presente */}
                            <div className="flex flex-col justify-center py-2 px-2 border-l border-white/20 w-[120px] shrink-0">
                              {pax.map(p => (
                                <div key={p.id} className="flex items-center gap-0.5 w-full">
                                  <span className="text-white/70 text-[10px] leading-tight truncate flex-1 text-right">{p.nombre}</span>
                                  {p.cumpleanero && <span className="text-[10px] shrink-0">🥳</span>}
                                  {p.camara_360
                                    ? <span className="text-[10px] shrink-0">📽️</span>
                                    : p.camara_normal
                                      ? <span className="text-[10px] shrink-0">📷</span>
                                      : null}
                                </div>
                              ))}
                            </div>

                            {/* Botón ya voló — ancho fijo */}
                            <button
                              onClick={(e) => marcarVolo(r, e)}
                              disabled={marcandoVolo === r.id}
                              className="w-10 flex items-center justify-center border-l border-white/20 shrink-0 disabled:opacity-50 transition-all"
                              title={r.volo ? 'Desmarcar vuelo' : 'Marcar como voló'}>
                              <span className="text-base">{marcandoVolo === r.id ? '⏳' : '🪂'}</span>
                            </button>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="mx-4 mt-4" style={{ borderBottom:'1px solid rgba(30,90,150,0.12)' }} />
                </div>
              )
            })}

            {/* Botón cargar días futuros */}
            <div className="flex justify-center py-4">
              <button
                onClick={async () => {
                  if (loadingMoreRef.current) return
                  loadingMoreRef.current = true
                  setLoadingMore(true)
                  const from = addDays(windowEndRef.current, 1)
                  const to   = addDays(windowEndRef.current, STEP)
                  const newData = await fetchDays(from, to)
                  setByDate(prev => ({ ...prev, ...newData }))
                  windowEndRef.current = to
                  setWindowEnd(to)
                  loadingMoreRef.current = false
                  setLoadingMore(false)
                }}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background:'rgba(46,109,180,0.15)', color:'#2e6db4' }}>
                {loadingMore
                  ? <><div className="w-3 h-3 rounded-full border-2 border-[#2e6db4] border-t-transparent animate-spin" /> Cargando...</>
                  : 'Ver días futuros ↓'}
              </button>
            </div>
            <div ref={sentinelRef} />
          </>
        )}
      </main>

      {/* ── FAB ── */}
      <button
        onClick={() => { setFormDate(today); setShowForm(true) }}
        className="fixed bottom-6 right-5 z-30 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-light transition-all active:scale-95 hover:brightness-110"
        style={{ background:'#ffd700', color:'#0d2b5c', boxShadow:'0 4px 20px rgba(255,215,0,0.5)' }}>
        +
      </button>

      {/* ── Modal detalle (md+) ── */}
      {detailId && (
        <div className="fixed inset-0 z-40 hidden md:flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setDetailId(null); refreshWindow() }} />
          <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            style={{ maxHeight:'90vh', background:'linear-gradient(160deg,#e8f2ff 0%,#d0e6ff 100%)' }}>
            <div className="flex items-center gap-3 px-5 py-4 shrink-0"
              style={{ background:'linear-gradient(135deg,#0d2b5c 0%,#1a4a85 100%)' }}>
              <span className="text-white font-extrabold text-base flex-1">Detalle Reserva</span>
              <button onClick={() => { setDetailId(null); refreshWindow() }}
                className="text-[#7aafd4] hover:text-white text-2xl leading-none transition-colors">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <DetalleContent id={detailId} onSave={refreshWindow} onDelete={() => { setDetailId(null); refreshWindow() }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Formulario nueva reserva ── */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative w-full md:max-w-md rounded-t-2xl md:rounded-2xl px-5 pt-5 pb-8 overflow-y-auto"
            style={{ background:'#0d2b5c', maxHeight:'88vh', boxShadow:'0 -4px 30px rgba(0,0,0,0.4)' }}>
            <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-4 md:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-extrabold text-base">Nueva Reserva</h2>
              <button onClick={resetForm} className="text-[#7aafd4] hover:text-white text-2xl leading-none">×</button>
            </div>

            {fErr && (
              <div className="mb-3 p-3 rounded-xl text-sm" style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', color:'#fca5a5' }}>{fErr}</div>
            )}

            {[
              { label:'Fecha',    node: <input type="date" className="w-full rounded-xl p-3 text-sm text-white" style={{ background:'#1a4a85', border:'1px solid #2e6db4' }} value={formDate} onChange={e=>setFormDate(e.target.value)} /> },
              { label:'Nombre',   node: <input className="w-full rounded-xl p-3 text-sm text-white placeholder-[#7aafd4]" style={{ background:'#1a4a85', border:'1px solid #2e6db4' }} placeholder="Nombre" value={nombre} onChange={e=>setNombre(e.target.value)} /> },
              { label:'Teléfono', node: <input className="w-full rounded-xl p-3 text-sm text-white placeholder-[#7aafd4]" style={{ background:'#1a4a85', border:'1px solid #2e6db4' }} placeholder="Teléfono" type="tel" value={telefono} onChange={e=>setTelefono(e.target.value.replace(/[^0-9]/g,''))} /> },
              { label:'Personas', node: <input className="w-full rounded-xl p-3 text-sm text-white placeholder-[#7aafd4]" style={{ background:'#1a4a85', border:'1px solid #2e6db4' }} placeholder="Cantidad" type="number" min="1" value={cantidad} onChange={e=>setCantidad(e.target.value)} /> },
            ].map(({ label, node }) => (
              <div key={label} className="mb-3">
                <label className="text-[#7aafd4] text-xs font-bold uppercase tracking-wide mb-1 block">{label}</label>
                {node}
              </div>
            ))}

            <div className="mb-3">
              <label className="text-[#7aafd4] text-xs font-bold uppercase tracking-wide mb-1 block">Horario</label>
              <div className="relative">
                <button type="button" onClick={() => setShowHorPk(!showHorPk)}
                  className="w-full text-left rounded-xl p-3 text-sm"
                  style={{ background:'#1a4a85', border:'1px solid #2e6db4', color: horId?'#fff':'#7aafd4' }}>
                  {horId ? horLabel(horId) : 'Selecciona un horario'}
                </button>
                {showHorPk && (
                  <div className="absolute z-10 w-full rounded-xl mt-1 overflow-hidden shadow-2xl" style={{ background:'#0a2248', border:'1px solid #2e6db4' }}>
                    {horarios.map(h => (
                      <button key={h.id} type="button" onClick={() => { setHorId(h.id); setShowHorPk(false) }}
                        className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[#1a4a85]"
                        style={{ borderBottom:'1px solid rgba(46,109,180,0.2)' }}>
                        {fmtH(h.horario)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[#7aafd4] text-xs font-bold uppercase tracking-wide mb-1 block">Servicios</label>
              <div className="relative">
                <button type="button" onClick={() => setShowSrvPk(!showSrvPk)}
                  className="w-full text-left rounded-xl p-3 text-sm text-[#7aafd4]"
                  style={{ background:'#1a4a85', border:'1px solid #2e6db4' }}>
                  Agregar servicio...
                </button>
                {showSrvPk && (
                  <div className="absolute z-10 w-full rounded-xl mt-1 overflow-hidden shadow-2xl" style={{ background:'#0a2248', border:'1px solid #2e6db4' }}>
                    {valores.map(v => (
                      <button key={v.id} type="button" onClick={() => addSrv(v)}
                        className="w-full text-left px-4 py-3 hover:bg-[#1a4a85]"
                        style={{ borderBottom:'1px solid rgba(46,109,180,0.2)' }}>
                        <p className="text-sm font-semibold text-white">{v.servicio}</p>
                        <p className="text-xs text-[#7aafd4]">{fmtCLP(v.monto)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {srvs.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {srvs.map(item => (
                    <span key={item.id} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full"
                      style={{ background:'#2e6db4', color:'#fff' }}>
                      {item.servicio}{item.cantidad>1?` ×${item.cantidad}`:''} · {fmtCLP(item.monto)}
                      <button onClick={() => remSrv(item.id)} className="opacity-70 ml-1 hover:opacity-100">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button onClick={crearReserva} disabled={saving}
              className="w-full font-bold py-3.5 rounded-xl text-sm transition-all disabled:opacity-60 hover:brightness-110"
              style={{ background:'linear-gradient(135deg,#2e6db4,#1a4a85)', color:'#fff' }}>
              {saving ? 'Creando...' : 'Crear Reserva'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
