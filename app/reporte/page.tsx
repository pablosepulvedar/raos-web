'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type ReservaDetalle = {
  id: number; nombre: string; cantidad: number; abono: number | null
  horarios: { horario: number } | null
  reserva_servicios: { id: number; valores: { servicio: string; monto: number; descuento: boolean } | null }[]
  reserva_pagos: { id: number; monto: number; metodos_pago: { nombre: string } | null }[]
}
type PilotoVuelo = {
  perfil_id: string; nombre: string; vuelos: number
  servicios: { servicio: string; monto: number; cantidad: number }[]
}
type GastoExtra       = { id: number; descripcion: string; monto: number; tipo: 'ingreso' | 'gasto' }
type PagoPilotoDetalle = { perfil_id: string; nombre: string; metodo: string; monto: number }

const fmtH   = (v: number) => { const s = String(v).padStart(4,'0'); return `${s.slice(0,2)}:${s.slice(2)}` }
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`
const toStr  = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays = (s: string, n: number) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return toStr(d) }
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

const sectionCls = "bg-white rounded-2xl p-5 shadow-sm"
const titleCls   = "text-[#0d2b5c] font-bold text-sm uppercase tracking-wide mb-4"

export default function Reporte() {
  const sb    = useRef(createClient()).current
  const today = toStr(new Date())

  const [fecha, setFecha]   = useState(today)
  const [loading, setLoading] = useState(false)

  const [reservas, setReservas]               = useState<ReservaDetalle[]>([])
  const [pilotos, setPilotos]                 = useState<PilotoVuelo[]>([])
  const [pagosAPilotos, setPagosAPilotos]     = useState<PagoPilotoDetalle[]>([])
  const [gastosExtras, setGastosExtras]       = useState<GastoExtra[]>([])

  // Form gastos extras
  const [gDescripcion, setGDescripcion]         = useState('')
  const [gMonto, setGMonto]                     = useState('')
  const [gTipo, setGTipo]                       = useState<'ingreso'|'gasto'>('gasto')
  const [savingGasto, setSavingGasto]           = useState(false)
  const [deletingGastoId, setDeletingGastoId]   = useState<number|null>(null)

  useEffect(() => { fetchData() }, [fecha])

  const fetchData = async () => {
    setLoading(true)

    // Reservas del día
    const { data: resData } = await sb
      .from('reservas')
      .select('id, nombre, cantidad, abono, horarios(horario), reserva_servicios(id, valores(servicio, monto, descuento)), reserva_pagos(id, monto, metodos_pago(nombre))')
      .eq('fecha', fecha)
      .order('horario_id')
    setReservas((resData || []) as unknown as ReservaDetalle[])

    const resIds = (resData || []).map((r: any) => r.id)

    // Pilotos
    if (resIds.length > 0) {
      const { data: rps } = await sb
        .from('reservas_personas')
        .select('reserva_id, perfil_id, perfiles(nombre)')
        .in('reserva_id', resIds)
        .not('perfil_id', 'is', null)

      const pilotoMap: Record<string, { nombre: string; vuelos: number; reservaIds: number[] }> = {}
      ;(rps || []).forEach((row: any) => {
        const pid = row.perfil_id; const nombre = row.perfiles?.nombre || 'Sin nombre'
        if (!pilotoMap[pid]) pilotoMap[pid] = { nombre, vuelos: 0, reservaIds: [] }
        pilotoMap[pid].vuelos++
        if (!pilotoMap[pid].reservaIds.includes(row.reserva_id)) pilotoMap[pid].reservaIds.push(row.reserva_id)
      })

      const pilotoIds = Object.keys(pilotoMap)
      if (pilotoIds.length > 0) {
        const { data: pvData } = await sb
          .from('perfil_valores')
          .select('perfil_id, cantidad, valores(servicio, monto)')
          .in('reserva_id', resIds)
          .in('perfil_id', pilotoIds)

        const srvMap: Record<string, { servicio: string; monto: number; cantidad: number }[]> = {}
        ;(pvData || []).forEach((row: any) => {
          const pid = row.perfil_id
          if (!srvMap[pid]) srvMap[pid] = []
          const ex = srvMap[pid].find(s => s.servicio === row.valores?.servicio)
          if (ex) ex.cantidad += row.cantidad
          else srvMap[pid].push({ servicio: row.valores?.servicio || '', monto: row.valores?.monto || 0, cantidad: row.cantidad })
        })

        setPilotos(pilotoIds.map(pid => ({
          perfil_id: pid, nombre: pilotoMap[pid].nombre,
          vuelos: pilotoMap[pid].vuelos, servicios: srvMap[pid] || []
        })))
      } else { setPilotos([]) }
    } else { setPilotos([]) }

    // Pagos a pilotos del día (con método de pago)
    const { data: ppData } = await sb
      .from('piloto_pagos')
      .select('perfil_id, monto, metodos_pago(nombre), perfiles(nombre)')
      .eq('fecha', fecha)
    setPagosAPilotos((ppData || []).map((row: any) => ({
      perfil_id: row.perfil_id,
      nombre: row.perfiles?.nombre || 'Sin nombre',
      metodo: row.metodos_pago?.nombre || 'Sin método',
      monto: row.monto,
    })))

    // Gastos extras
    const { data: gastosData } = await sb.from('gastos_diarios').select('*').eq('fecha', fecha).order('created_at')
    setGastosExtras((gastosData || []) as GastoExtra[])

    setLoading(false)
  }

  const agregarGasto = async () => {
    if (!gDescripcion.trim() || !gMonto) return
    setSavingGasto(true)
    await sb.from('gastos_diarios').insert({ fecha, descripcion: gDescripcion.trim(), monto: parseInt(gMonto, 10), tipo: gTipo })
    setGDescripcion(''); setGMonto('')
    setSavingGasto(false)
    fetchData()
  }

  const eliminarGasto = async (id: number) => {
    setDeletingGastoId(id)
    await sb.from('gastos_diarios').delete().eq('id', id)
    setDeletingGastoId(null)
    fetchData()
  }

  // ── Cálculos ──────────────────────────────────────────
  const totalServicios = reservas.reduce((sum, r) => {
    const bruto = (r.reserva_servicios||[]).filter(rs=>!rs.valores?.descuento).reduce((s,rs)=>s+(rs.valores?.monto||0),0)
    const desc  = (r.reserva_servicios||[]).filter(rs=>rs.valores?.descuento).reduce((s,rs)=>s+(rs.valores?.monto||0),0)
    return sum + bruto - desc
  }, 0)

  const totalCobrado = reservas.reduce((sum, r) => {
    const pagos = (r.reserva_pagos||[]).reduce((s,p)=>s+p.monto,0)
    return sum + pagos + (r.abono||0)
  }, 0)

  const saldoPendiente = totalServicios - totalCobrado

  // Cobros de clientes por método
  const cobrosPorMetodo: Record<string, number> = {}
  reservas.forEach(r => {
    ;(r.reserva_pagos||[]).forEach(p => {
      const m = p.metodos_pago?.nombre || 'Sin método'
      cobrosPorMetodo[m] = (cobrosPorMetodo[m]||0) + p.monto
    })
    if (r.abono) cobrosPorMetodo['Abono'] = (cobrosPorMetodo['Abono']||0) + r.abono
  })

  // Pagos a pilotos por método
  const pilagosPorMetodo: Record<string, number> = {}
  pagosAPilotos.forEach(p => {
    pilagosPorMetodo[p.metodo] = (pilagosPorMetodo[p.metodo]||0) + p.monto
  })

  // Todos los métodos que aparecen (en cobros o en pagos a pilotos)
  const todosMetodos = Array.from(new Set([...Object.keys(cobrosPorMetodo), ...Object.keys(pilagosPorMetodo)]))

  const totalPilotos       = pilotos.reduce((s,p)=>s+p.servicios.reduce((a,sv)=>a+sv.monto*sv.cantidad,0),0)
  const totalPagadoPilotos = pagosAPilotos.reduce((s,p)=>s+p.monto,0)
  const totalExtrasIngreso = gastosExtras.filter(g=>g.tipo==='ingreso').reduce((s,g)=>s+g.monto,0)
  const totalExtrasGasto   = gastosExtras.filter(g=>g.tipo==='gasto').reduce((s,g)=>s+g.monto,0)
  const totalVuelos        = pilotos.reduce((s,p)=>s+p.vuelos,0)
  const provisionVuelos    = totalVuelos * 15000
  const balance            = totalCobrado + totalExtrasIngreso - totalPagadoPilotos - totalExtrasGasto - provisionVuelos

  const fechaDisplay = () => {
    const d = new Date(fecha+'T12:00:00')
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <div className="min-h-screen" style={{ background:'linear-gradient(160deg,#e8f2ff 0%,#d0e6ff 100%)' }}>

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-2 px-4 py-4"
        style={{ background:'linear-gradient(135deg,#0d2b5c 0%,#1a4a85 100%)', boxShadow:'0 2px 12px rgba(13,43,92,0.3)' }}>
        <Link href="/" className="text-[#7aafd4] text-sm shrink-0">←</Link>
        <div className="flex-1 flex items-center justify-center gap-2">
          <button onClick={() => setFecha(addDays(fecha,-1))}
            className="text-[#7aafd4] hover:text-white text-xl font-bold w-8 text-center transition-colors">‹</button>
          <div className="text-center min-w-0">
            <p className="text-white font-extrabold text-sm leading-tight">{fechaDisplay()}</p>
          </div>
          <button onClick={() => setFecha(addDays(fecha,1))}
            className="text-[#7aafd4] hover:text-white text-xl font-bold w-8 text-center transition-colors">›</button>
        </div>
        <button onClick={() => setFecha(today)}
          className="text-[#ffd700] text-xs font-bold px-2 py-1 rounded-lg shrink-0"
          style={{ border:'1px solid rgba(255,215,0,0.4)' }}>
          Hoy
        </button>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 rounded-full border-[3px] border-[#2e6db4] border-t-transparent animate-spin" />
            <p className="text-[#2e6db4] text-sm">Cargando...</p>
          </div>
        ) : (
          <>
            {/* ── Resumen rápido ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:'Cobrado',  value:totalCobrado, color:'#16a34a', bg:'#f0fff4', border:'#86efac' },
                { label:'Pilotos',  value:totalPilotos, color:'#7e22ce', bg:'#faf5ff', border:'#d8b4fe' },
                { label:'Balance',  value:balance, color:balance>=0?'#2e6db4':'#dc2626', bg:'#f0f6ff', border:'#b0cce8' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className="rounded-2xl p-3 text-center" style={{ background:bg, border:`1px solid ${border}` }}>
                  <p className="text-xs text-gray-500 font-semibold mb-1">{label}</p>
                  <p className="font-extrabold text-sm leading-tight" style={{ color }}>{fmtCLP(value)}</p>
                </div>
              ))}
            </div>

            {/* ── Reservas ── */}
            <div className={sectionCls}>
              <p className={titleCls}>📋 Reservas del día ({reservas.length})</p>
              {reservas.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Sin reservas este día</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {reservas.map(r => {
                    const bruto  = (r.reserva_servicios||[]).filter(rs=>!rs.valores?.descuento).reduce((s,rs)=>s+(rs.valores?.monto||0),0)
                    const desc   = (r.reserva_servicios||[]).filter(rs=>rs.valores?.descuento).reduce((s,rs)=>s+(rs.valores?.monto||0),0)
                    const neto   = bruto - desc
                    const pagado = (r.reserva_pagos||[]).reduce((s,p)=>s+p.monto,0) + (r.abono||0)
                    const saldo  = neto - pagado
                    return (
                      <div key={r.id} className="rounded-xl p-3" style={{ background:'#f8fbff', border:'1px solid #d4e6f5', borderLeft:'3px solid #2e6db4' }}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-[#0d2b5c] font-bold text-sm">
                              {r.nombre} <span className="text-[#7aafd4] font-normal">×{r.cantidad}</span>
                            </p>
                            {r.horarios && <p className="text-[#7aafd4] text-xs">{fmtH(r.horarios.horario)}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-[#0d2b5c] font-bold text-sm">{fmtCLP(neto)}</p>
                            {saldo > 0
                              ? <p className="text-orange-500 text-xs font-semibold">Debe {fmtCLP(saldo)}</p>
                              : <p className="text-green-600 text-xs font-semibold">✓ Pagado</p>}
                          </div>
                        </div>
                        {(r.reserva_servicios||[]).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {r.reserva_servicios.map(rs => (
                              <span key={rs.id} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={rs.valores?.descuento
                                  ? { background:'#ffe5e5', color:'#c0392b' }
                                  : { background:'#e8f0fb', color:'#2e6db4' }}>
                                {rs.valores?.descuento?'−':''}{rs.valores?.servicio} {fmtCLP(rs.valores?.monto||0)}
                              </span>
                            ))}
                          </div>
                        )}
                        {((r.reserva_pagos||[]).length > 0 || r.abono) && (
                          <div className="flex flex-wrap gap-1">
                            {(r.reserva_pagos||[]).map(p => (
                              <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={{ background:'#dcfce7', color:'#16a34a' }}>
                                💳 {p.metodos_pago?.nombre} {fmtCLP(p.monto)}
                              </span>
                            ))}
                            {r.abono ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={{ background:'#dcfce7', color:'#16a34a' }}>
                                Abono {fmtCLP(r.abono)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Desglose por método (cobros vs pilotos) ── */}
            {(todosMetodos.length > 0) && (
              <div className={sectionCls}>
                <p className={titleCls}>💳 Desglose por método de pago</p>

                {/* Encabezado */}
                <div className="grid grid-cols-4 gap-1 mb-2 px-1">
                  {['Método','Cobrado','Pilotos','Neto'].map(h => (
                    <p key={h} className="text-[10px] font-bold text-gray-400 uppercase text-center">{h}</p>
                  ))}
                </div>

                {/* Filas por método */}
                <div className="flex flex-col gap-1.5">
                  {todosMetodos.map(m => {
                    const cobrado = cobrosPorMetodo[m] || 0
                    const piloto  = pilagosPorMetodo[m] || 0
                    const neto    = cobrado - piloto
                    return (
                      <div key={m} className="grid grid-cols-4 gap-1 py-2.5 px-3 rounded-xl items-center"
                        style={{ background:'#f8fbff', border:'1px solid #d4e6f5' }}>
                        <span className="text-xs font-bold text-[#0d2b5c] truncate">{m}</span>
                        <span className="text-xs font-semibold text-green-700 text-center">{cobrado ? fmtCLP(cobrado) : '—'}</span>
                        <span className="text-xs font-semibold text-purple-700 text-center">{piloto ? `−${fmtCLP(piloto)}` : '—'}</span>
                        <span className={`text-xs font-extrabold text-center ${neto >= 0 ? 'text-[#2e6db4]' : 'text-red-600'}`}>{fmtCLP(neto)}</span>
                      </div>
                    )
                  })}

                  {/* Totales */}
                  <div className="grid grid-cols-4 gap-1 py-2.5 px-3 rounded-xl items-center mt-1"
                    style={{ background:'linear-gradient(135deg,#1a4a85,#0d2b5c)' }}>
                    <span className="text-xs font-bold text-white">Total</span>
                    <span className="text-xs font-bold text-green-300 text-center">{fmtCLP(totalCobrado)}</span>
                    <span className="text-xs font-bold text-purple-300 text-center">{totalPagadoPilotos ? `−${fmtCLP(totalPagadoPilotos)}` : '—'}</span>
                    <span className={`text-xs font-extrabold text-center ${(totalCobrado-totalPagadoPilotos)>=0?'text-yellow-300':'text-red-300'}`}>
                      {fmtCLP(totalCobrado - totalPagadoPilotos)}
                    </span>
                  </div>
                </div>

                {saldoPendiente > 0 && (
                  <div className="flex justify-between items-center py-2 px-3 rounded-xl mt-2"
                    style={{ background:'#fff7ed', border:'1px solid #fed7aa' }}>
                    <span className="text-xs font-semibold text-orange-700">Saldo pendiente de clientes</span>
                    <span className="text-xs font-bold text-orange-700">{fmtCLP(saldoPendiente)}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Pilotos ── */}
            <div className={sectionCls}>
              <p className={titleCls}>🪂 Pilotos del día</p>
              {pilotos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Sin pilotos registrados este día</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {pilotos.map(p => {
                    const devenga  = p.servicios.reduce((s,sv)=>s+sv.monto*sv.cantidad,0)
                    const pagadoP  = pagosAPilotos.filter(pp=>pp.perfil_id===p.perfil_id)
                    const pagadoT  = pagadoP.reduce((s,pp)=>s+pp.monto,0)
                    const pendienteP = devenga - pagadoT
                    return (
                      <div key={p.perfil_id} className="rounded-xl p-3"
                        style={{ background:'#faf5ff', border:'1px solid #d8b4fe', borderLeft:'3px solid #7e22ce' }}>
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <p className="text-[#0d2b5c] font-bold text-sm">{p.nombre}</p>
                            <p className="text-[#7aafd4] text-xs">{p.vuelos} vuelo{p.vuelos!==1?'s':''}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-extrabold text-sm" style={{ color:'#7e22ce' }}>{fmtCLP(devenga)}</p>
                            {pendienteP > 0
                              ? <p className="text-orange-500 text-xs font-semibold">Debe {fmtCLP(pendienteP)}</p>
                              : pagadoT > 0
                                ? <p className="text-green-600 text-xs font-semibold">✓ Pagado</p>
                                : null}
                          </div>
                        </div>
                        {/* Servicios devengados */}
                        {p.servicios.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {p.servicios.map(s => (
                              <span key={s.servicio} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={{ background:'#ede9fe', color:'#6d28d9' }}>
                                {s.servicio} ×{s.cantidad} — {fmtCLP(s.monto*s.cantidad)}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Pagos realizados */}
                        {pagadoP.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {pagadoP.map((pp,i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={{ background:'#dcfce7', color:'#16a34a' }}>
                                💳 {pp.metodo} {fmtCLP(pp.monto)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Totales pilotos */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between items-center py-2.5 px-3 rounded-xl"
                      style={{ background:'#ede9fe', border:'1px solid #d8b4fe' }}>
                      <span className="text-xs font-bold text-purple-800">Devengado</span>
                      <span className="text-xs font-extrabold text-purple-800">{fmtCLP(totalPilotos)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 px-3 rounded-xl"
                      style={{ background:'#7e22ce' }}>
                      <span className="text-xs font-bold text-white">Pagado</span>
                      <span className="text-xs font-extrabold text-white">{fmtCLP(totalPagadoPilotos)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Otros gastos / ingresos ── */}
            <div className={sectionCls}>
              <p className={titleCls}>➕ Otros ingresos y gastos</p>

              {/* Formulario */}
              <div className="rounded-xl p-3 mb-3" style={{ background:'#f8fbff', border:'1px solid #d4e6f5' }}>
                <div className="flex gap-2 mb-3">
                  {(['ingreso','gasto'] as const).map(t => (
                    <button key={t} onClick={() => setGTipo(t)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={gTipo===t
                        ? { background: t==='ingreso'?'#16a34a':'#dc2626', color:'white' }
                        : { background:'#f0f0f0', color:'#888' }}>
                      {t==='ingreso'?'+ Ingreso':'− Gasto'}
                    </button>
                  ))}
                </div>
                <input
                  className="w-full rounded-xl p-2.5 text-sm mb-2 text-[#0d2b5c]"
                  style={{ border:'1px solid #b0cce8', background:'white' }}
                  placeholder="Descripción..."
                  value={gDescripcion}
                  onChange={e => setGDescripcion(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && agregarGasto()} />
                <div className="flex gap-2">
                  <div className="flex items-center flex-1 rounded-xl overflow-hidden" style={{ border:'1px solid #b0cce8', background:'white' }}>
                    <span className="pl-3 text-gray-400 text-xs font-semibold select-none">$</span>
                    <input className="flex-1 text-sm bg-transparent outline-none px-2 py-2.5 text-[#0d2b5c]"
                      placeholder="0" value={gMonto}
                      onChange={e => setGMonto(e.target.value.replace(/[^0-9]/g,''))}
                      onKeyDown={e => e.key==='Enter' && agregarGasto()} />
                  </div>
                  <button onClick={agregarGasto} disabled={savingGasto || !gDescripcion.trim() || !gMonto}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all"
                    style={{ background: gTipo==='ingreso'?'#16a34a':'#dc2626' }}>
                    {savingGasto ? '...' : '+ Agregar'}
                  </button>
                </div>
              </div>

              {gastosExtras.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-2">Sin registros adicionales</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {gastosExtras.map(g => (
                    <div key={g.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={g.tipo==='ingreso'
                        ? { background:'#f0fff4', border:'1px solid #86efac' }
                        : { background:'#fff5f5', border:'1px solid #fca5a5' }}>
                      <div>
                        <p className="text-sm font-semibold text-[#0d2b5c]">{g.descripcion}</p>
                        <p className="text-xs font-bold" style={{ color:g.tipo==='ingreso'?'#16a34a':'#dc2626' }}>
                          {g.tipo==='ingreso'?'+':'−'} {fmtCLP(g.monto)}
                        </p>
                      </div>
                      <button onClick={() => eliminarGasto(g.id)} disabled={deletingGastoId===g.id}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-40 ml-3 text-lg leading-none">
                        {deletingGastoId===g.id?'⏳':'×'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Balance final ── */}
            <div className="rounded-2xl p-5"
              style={{ background:'linear-gradient(135deg,#0d2b5c,#1a4a85)', boxShadow:'0 4px 20px rgba(13,43,92,0.3)' }}>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4">Balance del día</p>
              <div className="flex flex-col gap-2.5 mb-4">
                <div className="flex justify-between">
                  <span className="text-white/80 text-sm">Total cobrado</span>
                  <span className="text-green-400 font-bold text-sm">+ {fmtCLP(totalCobrado)}</span>
                </div>
                {totalExtrasIngreso > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/80 text-sm">Otros ingresos</span>
                    <span className="text-green-400 font-bold text-sm">+ {fmtCLP(totalExtrasIngreso)}</span>
                  </div>
                )}
                {totalPagadoPilotos > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/80 text-sm">Pagado a pilotos</span>
                    <span className="text-red-400 font-bold text-sm">− {fmtCLP(totalPagadoPilotos)}</span>
                  </div>
                )}
                {totalExtrasGasto > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/80 text-sm">Otros gastos</span>
                    <span className="text-red-400 font-bold text-sm">− {fmtCLP(totalExtrasGasto)}</span>
                  </div>
                )}
                {totalVuelos > 0 && (
                  <div className="flex justify-between items-center py-1.5 px-2 rounded-lg mt-1"
                    style={{ background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.25)' }}>
                    <div>
                      <span className="text-yellow-300 text-xs font-semibold">Provisión fin de mes</span>
                      <span className="text-yellow-300/60 text-[10px] ml-1">({totalVuelos} vuelo{totalVuelos!==1?'s':''} × $15.000)</span>
                    </div>
                    <span className="text-yellow-300 font-bold text-xs">− {fmtCLP(provisionVuelos)}</span>
                  </div>
                )}
                {saldoPendiente > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-white/50 text-xs italic">Pendiente de cobro clientes</span>
                    <span className="text-orange-400 text-xs font-semibold">{fmtCLP(saldoPendiente)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-4" style={{ borderTop:'1px solid rgba(255,255,255,0.15)' }}>
                <span className="text-white font-bold text-base uppercase tracking-wide">Neto del día</span>
                <span className={`font-extrabold text-2xl ${balance>=0?'text-green-400':'text-red-400'}`}>
                  {fmtCLP(balance)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
