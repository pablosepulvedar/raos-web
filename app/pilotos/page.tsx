'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type PilotoResumen  = { perfil_id: string; nombre: string; vuelos: number }
type ServicioPiloto = { id: number; servicio: string; monto: number; cantidad: number }
type MetodoPago     = { id: number; nombre: string }
type PagoPiloto     = { id: number; monto: number; metodos_pago: { nombre: string } | null }

const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_L = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']
const CAL_D  = ['D','L','M','M','J','V','S']
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`
const toStr  = (d: Date)   => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays = (s: string, n: number) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return toStr(d) }

const STEP = 2

export default function Pilotos() {
  const sb    = useRef(createClient()).current
  const today = toStr(new Date())

  const initStart = useRef(addDays(today, -2)).current
  const initEnd   = useRef(addDays(today,  2)).current

  // Calendar
  const [showCal, setShowCal]           = useState(false)
  const [calM, setCalM]                 = useState(new Date().getMonth())
  const [calY, setCalY]                 = useState(new Date().getFullYear())
  const [dots, setDots]                 = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState(today)

  // Window
  const [byDate, setByDate]                             = useState<Record<string, PilotoResumen[]>>({})
  const [reservaIdsByDatePiloto, setReservaIdsByDatePiloto] = useState<Record<string, Record<string, number[]>>>({})
  const [windowEnd, setWindowEnd]                       = useState(initEnd)
  const windowEndRef                                    = useRef(initEnd)
  const [windowStart, setWindowStart]                   = useState(initStart)
  const windowStartRef                                  = useRef(initStart)
  const [loading, setLoading]                           = useState(true)
  const [loadingMore, setLoadingMore]                   = useState(false)
  const [loadingPrev, setLoadingPrev]                   = useState(false)
  const loadingMoreRef                                  = useRef(false)
  const loadingPrevRef                                  = useRef(false)
  const listRef                                         = useRef<HTMLDivElement>(null)
  const dateRefs                                        = useRef<Record<string, HTMLDivElement|null>>({})

  // Service management
  const [valoresPiloto, setValoresPiloto]      = useState<any[]>([])
  const [expandedKey, setExpandedKey]          = useState<string|null>(null)
  const [serviciosSeleccionados, setServicios] = useState<ServicioPiloto[]>([])
  const [showSrvPk, setShowSrvPk]              = useState(false)
  const [saving, setSaving]                    = useState(false)
  const [savedMsg, setSavedMsg]                = useState<string|null>(null)

  // Pagos al piloto
  const [metodosPago, setMetodosPago]               = useState<MetodoPago[]>([])
  const [pilotoPagos, setPilotoPagos]               = useState<PagoPiloto[]>([])
  const [showPagoPk, setShowPagoPk]                 = useState(false)
  const [selectedPagoMetodoId, setSelectedPagoMetodoId] = useState<number|null>(null)
  const [pagoMonto, setPagoMonto]                   = useState('')
  const [addingPago, setAddingPago]                 = useState(false)
  const [deletingPagoId, setDeletingPagoId]         = useState<number|null>(null)
  const [pagoError, setPagoError]                   = useState<string|null>(null)

  // ── Fetch helpers ──────────────────────────────────────
  const fetchRange = useCallback(async (from: string, to: string) => {
    const { data: reservas } = await sb.from('reservas').select('id, fecha')
      .gte('fecha', from).lte('fecha', to)
    if (!reservas?.length) return { byDate:{}, reservaIds:{} }

    const fechaMap: Record<number, string> = {}
    reservas.forEach((r:any) => { fechaMap[r.id] = r.fecha })

    const { data: rps } = await sb
      .from('reservas_personas')
      .select('reserva_id, perfil_id, perfiles(id, nombre)')
      .in('reserva_id', reservas.map((r:any)=>r.id))
      .not('perfil_id','is',null)

    const byDate: Record<string, PilotoResumen[]> = {}
    const reservaIds: Record<string, Record<string, number[]>> = {}

    ;(rps||[]).forEach((row:any) => {
      const fecha = fechaMap[row.reserva_id]
      if (!fecha) return
      const pid   = row.perfil_id
      const nombre = row.perfiles?.nombre || 'Sin nombre'

      if (!byDate[fecha]) byDate[fecha] = []
      if (!reservaIds[fecha]) reservaIds[fecha] = {}

      const ex = byDate[fecha].find(p=>p.perfil_id===pid)
      if (ex) { ex.vuelos++ } else { byDate[fecha].push({ perfil_id:pid, nombre, vuelos:1 }) }

      if (!reservaIds[fecha][pid]) reservaIds[fecha][pid] = []
      if (!reservaIds[fecha][pid].includes(row.reserva_id)) reservaIds[fecha][pid].push(row.reserva_id)
    })

    return { byDate, reservaIds }
  }, [sb])

  const fetchDots = useCallback(async (y: number, m: number) => {
    const first = `${y}-${String(m+1).padStart(2,'0')}-01`
    const last  = `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
    const { data: reservasMes } = await sb.from('reservas').select('id, fecha').gte('fecha',first).lte('fecha',last)
    if (!reservasMes?.length) { setDots(new Set()); return }
    const { data: conPilotos } = await sb
      .from('reservas_personas').select('reserva_id')
      .in('reserva_id', reservasMes.map((r:any)=>r.id))
      .not('perfil_id','is',null)
    const idsConPilotos = new Set((conPilotos||[]).map((r:any)=>r.reserva_id))
    setDots(new Set(reservasMes.filter((r:any)=>idsConPilotos.has(r.id)).map((r:any)=>r.fecha as string)))
  }, [sb])

  const refreshWindow = useCallback(async () => {
    const { byDate: d, reservaIds: r } = await fetchRange(windowStartRef.current, windowEndRef.current)
    setByDate(d); setReservaIdsByDatePiloto(r)
    fetchDots(calY, calM)
  }, [fetchRange, fetchDots, calY, calM])

  // ── Initial load ───────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ byDate: d, reservaIds: r }] = await Promise.all([
        fetchRange(initStart, initEnd),
        sb.from('valores').select('*').eq('piloto',true).order('servicio').then(({ data }) => setValoresPiloto(data||[])),
        sb.from('metodos_pago').select('id, nombre').eq('activo',true).order('nombre').then(({ data }) => setMetodosPago((data||[]) as MetodoPago[])),
        fetchDots(new Date().getFullYear(), new Date().getMonth()),
      ])
      setByDate(d); setReservaIdsByDatePiloto(r)
      setLoading(false)
      setTimeout(() => {
        dateRefs.current[today]?.scrollIntoView({ behavior:'instant', block:'start' })
      }, 80)
    }
    load()
  }, [])

  useEffect(() => { fetchDots(calY, calM) }, [calM, calY])

  // ── Cargar días anteriores ─────────────────────────────
  const cargarAnteriores = async () => {
    if (loadingPrevRef.current) return
    loadingPrevRef.current = true
    setLoadingPrev(true)
    const to   = addDays(windowStartRef.current, -1)
    const from = addDays(windowStartRef.current, -STEP)
    const { byDate: newD, reservaIds: newR } = await fetchRange(from, to)
    const list = listRef.current
    const prevH   = list?.scrollHeight ?? 0
    const prevTop = list?.scrollTop ?? 0
    setByDate(prev => ({ ...newD, ...prev }))
    setReservaIdsByDatePiloto(prev => ({ ...newR, ...prev }))
    windowStartRef.current = from
    setWindowStart(from)
    setTimeout(() => {
      if (list) list.scrollTop = prevTop + (list.scrollHeight - prevH)
    }, 0)
    loadingPrevRef.current = false
    setLoadingPrev(false)
  }

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
    const d = new Date(ds+'T12:00:00')
    setCalM(d.getMonth()); setCalY(d.getFullYear())

    if (ds > windowEndRef.current) {
      const { byDate: newD, reservaIds: newR } = await fetchRange(addDays(windowEndRef.current,1), ds)
      setByDate(prev => ({ ...prev, ...newD }))
      setReservaIdsByDatePiloto(prev => ({ ...prev, ...newR }))
      windowEndRef.current = ds; setWindowEnd(ds)
    } else if (ds < windowStartRef.current) {
      const { byDate: newD, reservaIds: newR } = await fetchRange(ds, addDays(windowStartRef.current,-1))
      setByDate(prev => ({ ...newD, ...prev }))
      setReservaIdsByDatePiloto(prev => ({ ...newR, ...prev }))
      windowStartRef.current = ds; setWindowStart(ds)
    }
    setTimeout(() => {
      dateRefs.current[ds]?.scrollIntoView({ behavior:'smooth', block:'start' })
    }, 200)
  }

  // ── All dates in window ────────────────────────────────
  const allDates = useMemo(() => {
    const dates: string[] = []
    const cur = new Date(windowStart+'T12:00:00')
    const end = new Date(windowEnd+'T12:00:00')
    while (cur <= end) { dates.push(toStr(cur)); cur.setDate(cur.getDate()+1) }
    return dates
  }, [windowEnd, windowStart])

  // ── Service management ─────────────────────────────────
  const fetchExistingServicios = async (perfilId: string, reservaIdList: number[]) => {
    if (!reservaIdList.length) return
    const { data } = await sb
      .from('perfil_valores')
      .select('id, valor_id, cantidad, valores(id, servicio, monto)')
      .eq('perfil_id', perfilId)
      .in('reserva_id', reservaIdList)
    if (data?.length) {
      setServicios(data.map((row:any) => ({
        id:row.valor_id, servicio:row.valores?.servicio||'', monto:row.valores?.monto||0, cantidad:row.cantidad
      })))
    }
  }

  const fetchPilotoPagos = async (perfilId: string, fecha: string) => {
    const { data } = await sb
      .from('piloto_pagos')
      .select('id, monto, metodos_pago(nombre)')
      .eq('perfil_id', perfilId)
      .eq('fecha', fecha)
      .order('created_at')
    setPilotoPagos((data||[]) as unknown as PagoPiloto[])
  }

  const agregarPilotoPago = async () => {
    if (!expandedKey || !selectedPagoMetodoId || !pagoMonto) return
    const [date, pilotoId] = expandedKey.split('__')
    setPagoError(null); setAddingPago(true)
    const { error } = await sb.from('piloto_pagos').insert({
      perfil_id: pilotoId, fecha: date,
      metodo_pago_id: selectedPagoMetodoId, monto: parseInt(pagoMonto, 10)
    })
    setAddingPago(false)
    if (error) { setPagoError(error.message); return }
    setSelectedPagoMetodoId(null); setPagoMonto(''); setShowPagoPk(false)
    fetchPilotoPagos(pilotoId, date)
  }

  const eliminarPilotoPago = async (id: number) => {
    if (!expandedKey) return
    const [date, pilotoId] = expandedKey.split('__')
    setDeletingPagoId(id)
    await sb.from('piloto_pagos').delete().eq('id', id)
    setDeletingPagoId(null)
    fetchPilotoPagos(pilotoId, date)
  }

  const togglePiloto = (date: string, pilotoId: string) => {
    const key = `${date}__${pilotoId}`
    if (expandedKey === key) {
      setExpandedKey(null); setServicios([]); setPilotoPagos([])
      setShowSrvPk(false); setShowPagoPk(false); setSavedMsg(null); setPagoError(null)
    } else {
      setExpandedKey(key); setServicios([]); setPilotoPagos([])
      setShowSrvPk(false); setShowPagoPk(false); setSavedMsg(null); setPagoError(null)
      fetchExistingServicios(pilotoId, reservaIdsByDatePiloto[date]?.[pilotoId]||[])
      fetchPilotoPagos(pilotoId, date)
    }
  }

  const addServicio = (valor: any) => {
    if (!expandedKey) return
    const [date, pid] = expandedKey.split('__')
    const maxVuelos = byDate[date]?.find(p=>p.perfil_id===pid)?.vuelos ?? 0
    setServicios(prev => {
      const usados = prev.reduce((s,x)=>s+x.cantidad,0)
      if (usados >= maxVuelos) return prev
      const ex = prev.find(s=>s.id===valor.id)
      if (ex) return prev.map(s=>s.id===valor.id?{...s,cantidad:s.cantidad+1}:s)
      return [...prev,{id:valor.id,servicio:valor.servicio,monto:valor.monto,cantidad:1}]
    })
    setShowSrvPk(false)
  }

  const incrementServicio = (id: number) => {
    if (!expandedKey) return
    const [date, pid] = expandedKey.split('__')
    const maxVuelos = byDate[date]?.find(p=>p.perfil_id===pid)?.vuelos ?? 0
    setServicios(prev => {
      const usados = prev.reduce((s,x)=>s+x.cantidad,0)
      if (usados >= maxVuelos) return prev
      return prev.map(s=>s.id===id?{...s,cantidad:s.cantidad+1}:s)
    })
  }

  const removeServicio = (id: number) => {
    setServicios(prev => {
      const item = prev.find(s=>s.id===id); if(!item) return prev
      if(item.cantidad<=1) return prev.filter(s=>s.id!==id)
      return prev.map(s=>s.id===id?{...s,cantidad:s.cantidad-1}:s)
    })
  }

  const guardarServicios = async () => {
    if (!expandedKey) return
    const [date, pilotoId] = expandedKey.split('__')
    const reservaIdList = reservaIdsByDatePiloto[date]?.[pilotoId]||[]
    if (!reservaIdList.length) return
    setSaving(true); setSavedMsg(null)
    const { error: delErr } = await sb.from('perfil_valores').delete()
      .eq('perfil_id', pilotoId).in('reserva_id', reservaIdList)
    if (delErr) { setSaving(false); setSavedMsg('Error: '+delErr.message); return }
    if (serviciosSeleccionados.length > 0) {
      const rows = serviciosSeleccionados.map(s=>({
        perfil_id:pilotoId, valor_id:s.id, cantidad:s.cantidad, reserva_id:reservaIdList[0]
      }))
      const { error: insErr } = await sb.from('perfil_valores').insert(rows)
      if (insErr) { setSaving(false); setSavedMsg('Error: '+insErr.message); return }
    }
    setSaving(false); setSavedMsg('Guardado')
    setTimeout(() => { setExpandedKey(null); setServicios([]); setSavedMsg(null) }, 1000)
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
      <main className="max-w-lg mx-auto pb-20 px-0" ref={listRef}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 rounded-full border-[3px] border-[#2e6db4] border-t-transparent animate-spin" />
            <p className="text-[#2e6db4] text-sm">Cargando...</p>
          </div>
        ) : (
          <>
            {/* Botón ver días anteriores */}
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
              const pilotos = byDate[ds] || []
              const date   = new Date(ds+'T12:00:00')
              const dn     = DIAS_L[date.getDay()]
              const num    = date.getDate()
              const isPast = ds < today
              const isT    = ds === today
              const dayColor = isPast ? '#9b59b6' : isT ? '#2e6db4' : '#1e5a96'

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
                      {pilotos.length === 0 ? (
                        <p className="text-[#b0cce8] text-sm py-2 italic">Sin vuelos</p>
                      ) : pilotos.map(p => {
                        const key        = `${ds}__${p.perfil_id}`
                        const isExpanded = expandedKey === key
                        const usados     = serviciosSeleccionados.reduce((s,x)=>s+x.cantidad,0)
                        const limite     = usados >= p.vuelos
                        const totalSrv   = serviciosSeleccionados.reduce((s,x)=>s+x.monto*x.cantidad,0)

                        return (
                          <div key={p.perfil_id}>
                            <button
                              onClick={() => togglePiloto(ds, p.perfil_id)}
                              className="w-full text-left px-4 py-3 transition-all active:scale-[0.98]"
                              style={isExpanded
                                ? { background:'linear-gradient(135deg,#2e6db4,#1a4a85)', borderRadius:'1rem 1rem 0 0', boxShadow:'0 3px 12px rgba(46,109,180,0.3)' }
                                : { background:'#fff', borderRadius:'1rem', borderLeft:'3px solid #2e6db4', boxShadow:'0 2px 6px rgba(13,43,92,0.06)' }}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className={`font-bold text-sm ${isExpanded?'text-white':'text-[#0d2b5c]'}`}>{p.nombre}</p>
                                  <p className={`text-xs mt-0.5 ${isExpanded?'text-blue-100':'text-[#7aafd4]'}`}>
                                    {p.vuelos} vuelo{p.vuelos>1?'s':''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold px-2 py-1 rounded-full"
                                    style={isExpanded
                                      ? { background:'rgba(255,255,255,0.2)', color:'#fff' }
                                      : { background:'#e8f0fb', color:'#2e6db4' }}>
                                    ×{p.vuelos}
                                  </span>
                                  <span className={`text-xs ${isExpanded?'text-white/60':'text-[#b0cce8]'}`}>{isExpanded?'▲':'▼'}</span>
                                </div>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="rounded-b-2xl p-4" style={{ background:'#f0f6ff', border:'1px solid #b0cce8', borderTop:'none' }}>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-[#0d2b5c] font-bold text-xs uppercase tracking-wide">Servicios del piloto</p>
                                  <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full"
                                    style={{ background: limite ? '#e74c3c' : '#2e6db4' }}>
                                    {usados}/{p.vuelos} vuelos
                                  </span>
                                </div>

                                {savedMsg && (
                                  <div className={`mb-3 p-2 rounded-xl text-xs text-center font-semibold ${savedMsg.startsWith('Error')?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                                    {savedMsg}
                                  </div>
                                )}

                                {!limite ? (
                                  <div className="relative mb-3">
                                    <button type="button" onClick={() => setShowSrvPk(!showSrvPk)}
                                      className="w-full bg-white rounded-xl p-3 text-sm text-left font-semibold hover:bg-blue-50 transition-colors"
                                      style={{ border:'1px dashed #b0cce8', color:'#2e6db4' }}>
                                      {valoresPiloto.length===0 ? 'No hay servicios cargados' : '+ Agregar servicio...'}
                                    </button>
                                    {showSrvPk && valoresPiloto.length > 0 && (
                                      <div className="absolute z-10 w-full bg-white rounded-xl mt-1 shadow-xl overflow-hidden" style={{ border:'1px solid #b0cce8' }}>
                                        {valoresPiloto.map(v => (
                                          <button key={v.id} type="button" onClick={() => addServicio(v)}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50"
                                            style={{ borderBottom:'1px solid #e8f0fb' }}>
                                            <p className="font-bold text-[#0d2b5c] text-sm">{v.servicio}</p>
                                            <p className="text-[#2e6db4] text-xs">{fmtCLP(v.monto)}</p>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="rounded-xl p-2 mb-3 text-center" style={{ background:'#fff3cd' }}>
                                    <p className="text-xs font-semibold" style={{ color:'#856404' }}>
                                      Límite alcanzado ({p.vuelos} vuelo{p.vuelos>1?'s':''})
                                    </p>
                                  </div>
                                )}

                                {serviciosSeleccionados.length > 0 ? (
                                  <div className="flex flex-col gap-2 mb-3">
                                    {serviciosSeleccionados.map(s => (
                                      <div key={s.id} className="bg-white rounded-xl p-3 flex items-center justify-between"
                                        style={{ border:'1px solid #b0cce8' }}>
                                        <div className="flex-1">
                                          <p className="font-semibold text-[#0d2b5c] text-sm">{s.servicio}</p>
                                          <p className="text-[#2e6db4] text-xs">{fmtCLP(s.monto)} c/u</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button onClick={() => removeServicio(s.id)}
                                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold"
                                            style={{ background:'#ffeef0', color:'#c0392b' }}>−</button>
                                          <span className="font-extrabold text-[#2e6db4] w-7 text-center text-sm">×{s.cantidad}</span>
                                          <button onClick={() => incrementServicio(s.id)} disabled={limite}
                                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white disabled:opacity-40"
                                            style={{ background:'linear-gradient(135deg,#2e6db4,#1a4a85)' }}>+</button>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-2" style={{ borderTop:'1px solid #b0cce8' }}>
                                      <span className="font-bold text-[#0d2b5c] text-sm">Total</span>
                                      <span className="font-extrabold text-[#2e6db4] text-base">{fmtCLP(totalSrv)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-gray-400 text-sm text-center py-3">Agrega servicios para este piloto</p>
                                )}

                                <button onClick={guardarServicios} disabled={saving}
                                  className="w-full font-bold py-3 rounded-xl text-sm text-white transition-all disabled:opacity-60"
                                  style={{ background:'linear-gradient(135deg,#0d2b5c,#1a4a85)' }}>
                                  {saving ? 'Guardando...' : 'Guardar servicios'}
                                </button>

                                {/* Pagos al piloto */}
                                <div className="mt-4 rounded-xl p-3" style={{ background:'#f0fff4', border:'1px solid #86efac' }}>
                                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color:'#166534' }}>
                                    💳 Pago al piloto
                                  </p>

                                  {/* Chips de pagos */}
                                  <div className="flex flex-wrap gap-1.5 min-h-6 mb-3">
                                    {pilotoPagos.length === 0
                                      ? <span className="text-gray-400 text-xs self-center">Sin pagos registrados</span>
                                      : pilotoPagos.map(p => (
                                          <span key={p.id} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                                            style={{ background:'#16a34a', color:'#fff' }}>
                                            {p.metodos_pago?.nombre} · {fmtCLP(p.monto)}
                                            <button onClick={() => eliminarPilotoPago(p.id)} disabled={deletingPagoId===p.id}
                                              className="ml-0.5 font-bold hover:opacity-70 disabled:opacity-40 leading-none">
                                              {deletingPagoId===p.id ? '⏳' : '×'}
                                            </button>
                                          </span>
                                        ))
                                    }
                                  </div>

                                  {pagoError && (
                                    <div className="mb-2 p-2 rounded-lg text-xs text-red-700 bg-red-50 border border-red-200">{pagoError}</div>
                                  )}

                                  {/* Formulario agregar pago */}
                                  <div className="flex gap-2 items-center">
                                    <div className="relative flex-1">
                                      <button type="button" onClick={() => setShowPagoPk(!showPagoPk)}
                                        className="w-full text-left rounded-xl p-2.5 text-xs"
                                        style={{ background:'white', border:'1px dashed #86efac', color: selectedPagoMetodoId ? '#166534' : '#9ca3af' }}>
                                        {selectedPagoMetodoId ? metodosPago.find(m=>m.id===selectedPagoMetodoId)?.nombre ?? '...' : 'Método de pago...'}
                                      </button>
                                      {showPagoPk && (
                                        <div className="absolute z-10 w-full bg-white rounded-xl mt-1 shadow-xl overflow-hidden" style={{ border:'1px solid #86efac' }}>
                                          {metodosPago.length === 0
                                            ? <p className="p-3 text-gray-400 text-sm">No hay métodos activos</p>
                                            : metodosPago.map(m => (
                                              <button key={m.id} type="button" onClick={() => { setSelectedPagoMetodoId(m.id); setShowPagoPk(false) }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-green-50 text-sm text-[#0d2b5c]"
                                                style={{ borderBottom:'1px solid #e8f0fb' }}>
                                                {m.nombre}
                                              </button>
                                            ))
                                          }
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center rounded-xl overflow-hidden shrink-0" style={{ border:'1px solid #86efac', background:'white', width:'90px' }}>
                                      <span className="pl-2 text-gray-400 text-xs font-semibold select-none">$</span>
                                      <input className="flex-1 text-sm bg-transparent outline-none px-1 py-2.5 w-0 text-[#0d2b5c]"
                                        placeholder="0" value={pagoMonto}
                                        onChange={e => setPagoMonto(e.target.value.replace(/[^0-9]/g,''))}
                                        maxLength={8} />
                                    </div>
                                    <button onClick={agregarPilotoPago} disabled={addingPago || !selectedPagoMetodoId || !pagoMonto}
                                      className="shrink-0 font-bold py-2.5 px-3 rounded-xl text-xs text-white transition-all"
                                      style={{ background: (!selectedPagoMetodoId || !pagoMonto) ? '#86efac' : '#16a34a' }}>
                                      {addingPago ? '...' : '+ Agregar'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="mx-4 mt-4" style={{ borderBottom:'1px solid rgba(30,90,150,0.12)' }} />
                </div>
              )
            })}

            {/* Botón ver días futuros */}
            <div className="flex justify-center py-4">
              <button
                onClick={async () => {
                  if (loadingMoreRef.current) return
                  loadingMoreRef.current = true
                  setLoadingMore(true)
                  const from = addDays(windowEndRef.current, 1)
                  const to   = addDays(windowEndRef.current, STEP)
                  const { byDate: newD, reservaIds: newR } = await fetchRange(from, to)
                  setByDate(prev => ({ ...prev, ...newD }))
                  setReservaIdsByDatePiloto(prev => ({ ...prev, ...newR }))
                  windowEndRef.current = to; setWindowEnd(to)
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
          </>
        )}
      </main>
    </div>
  )
}
