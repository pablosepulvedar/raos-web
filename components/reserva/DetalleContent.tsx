'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Horario = { id: number; horario: number }
type MetodoPago = { id: number; nombre: string }
type ReservaPago = { id: number; metodo_pago_id: number; monto: number; metodos_pago: { nombre: string } | null }
type ValorServicio = { id: number; servicio: string; monto: number; descuento: boolean }
type ReservaServicio = { id: number; valor_id: number; valores: { id: number; servicio: string; monto: number; descuento: boolean } | null }
type Pasajero = { id: number; nombre: string; edad: number|null; peso: number|null; sin_camara: boolean; camara_normal: boolean; camara_360: boolean; perfil_id: string|null; cumpleanero: boolean }
type Piloto = { id: string; nombre: string }
type CamaraOp = 'sin_camara'|'camara_normal'|'camara_360'

const fmtH = (v: number) => { const s = String(v).padStart(4,'0'); return `${s.slice(0,2)}:${s.slice(2)}` }
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`
const CAMARA_LABELS: Record<CamaraOp, string> = { sin_camara:'Sin cámara', camara_normal:'Normal', camara_360:'360°' }

const labelCls = "block text-[#1a4a85] text-xs font-bold uppercase tracking-wide mb-1"
const sectionCls = "bg-white rounded-2xl p-5 shadow-sm"

function SwitchSiNo({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[#1a4a85] text-xs font-bold uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold ${!value ? 'text-gray-700' : 'text-gray-400'}`}>No</span>
        <button type="button" onClick={() => onChange(!value)}
          className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#2e6db4]' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${value ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <span className={`text-xs font-semibold ${value ? 'text-[#2e6db4]' : 'text-gray-400'}`}>Sí</span>
      </div>
    </div>
  )
}

interface Props { id: string; onSave?: () => void }

export default function DetalleContent({ id, onSave }: Props) {
  const sb = useRef(createClient()).current

  // Reserva fields
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState('')
  const [horarioId, setHorarioId] = useState<number|null>(null)
  const [cantidad, setCantidad] = useState('')
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [showHorPk, setShowHorPk] = useState(false)
  const [abono, setAbono] = useState('')
  const [volo, setVolo] = useState(false)
  const [savingVolo, setSavingVolo] = useState(false)
  const [savingRes, setSavingRes] = useState(false)
  const [resMsg, setResMsg] = useState<{type:'ok'|'err', text:string}|null>(null)
  const [editing, setEditing] = useState(false)

  // Services
  const [reservaServicios, setReservaServicios] = useState<ReservaServicio[]>([])
  const [valoresServicios, setValoresServicios] = useState<ValorServicio[]>([])
  const [showSrvPk, setShowSrvPk] = useState(false)
  const [deletingSrvId, setDeletingSrvId] = useState<number|null>(null)
  const [addingSrv, setAddingSrv] = useState(false)
  const [selectedSrvId, setSelectedSrvId] = useState<number|null>(null)

  // Pagos
  const [reservaPagos, setReservaPagos] = useState<ReservaPago[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [showPagoPk, setShowPagoPk] = useState(false)
  const [selectedPagoMetodoId, setSelectedPagoMetodoId] = useState<number|null>(null)
  const [pagoMonto, setPagoMonto] = useState('')
  const [addingPago, setAddingPago] = useState(false)
  const [deletingPagoId, setDeletingPagoId] = useState<number|null>(null)
  const [pagoError, setPagoError] = useState<string|null>(null)

  // Pasajeros
  const [pasajeros, setPasajeros] = useState<Pasajero[]>([])
  const [pilotos, setPilotos] = useState<Piloto[]>([])
  const [showPasForm, setShowPasForm] = useState(false)
  const [editingPasId, setEditingPasId] = useState<number|null>(null)
  const [pNombre, setPNombre] = useState('')
  const [pEdad, setPEdad] = useState('')
  const [pPeso, setPPeso] = useState('')
  const [pCamara, setPCamara] = useState<CamaraOp|null>(null)
  const [pPilotoId, setPPilotoId] = useState<string|null>(null)
  const [pPilotoNombre, setPPilotoNombre] = useState('')
  const [pCumpleanero, setPCumpleanero] = useState(false)
  const [showPilotoPk, setShowPilotoPk] = useState(false)
  const [savingPas, setSavingPas] = useState(false)
  const [deletingPasId, setDeletingPasId] = useState<number|null>(null)
  const [pasError, setPasError] = useState<string|null>(null)

  useEffect(() => {
    if (!id) return
    fetchReserva(); fetchPasajeros(); fetchReservaServicios()
    fetchHorarios(); fetchPilotos(); fetchValoresServicios()
    fetchMetodosPago(); fetchReservaPagos()
  }, [id])

  const fetchReserva = async () => {
    const { data } = await sb.from('reservas').select('*').eq('id', id).single()
    if (data) {
      setNombre(data.nombre||''); setTelefono(String(data.telefono||''))
      setFecha(data.fecha||''); setHorarioId(data.horario_id??null)
      setCantidad(String(data.cantidad||''))
      setAbono(data.abono != null ? String(data.abono) : '')
      setVolo(data.volo ?? false)
    }
  }
  const fetchHorarios = async () => {
    const { data } = await sb.from('horarios').select('*').order('horario')
    setHorarios((data||[]) as Horario[])
  }
  const fetchReservaServicios = async () => {
    const { data } = await sb.from('reserva_servicios').select('id, valor_id, valores(id, servicio, monto, descuento)').eq('reserva_id', id)
    setReservaServicios((data||[]) as unknown as ReservaServicio[])
  }
  const fetchValoresServicios = async () => {
    const { data } = await sb.from('valores').select('*').eq('pasajero', true).order('servicio')
    setValoresServicios((data||[]) as ValorServicio[])
  }
  const fetchPasajeros = async () => {
    const { data } = await sb.from('reservas_personas').select('*').eq('reserva_id', id).order('created_at')
    setPasajeros((data||[]) as Pasajero[])
  }
  const fetchPilotos = async () => {
    const { data: roles } = await sb.from('roles').select('id').ilike('nombre','%piloto%')
    if (!roles?.length) return
    const { data } = await sb.from('perfil_roles').select('perfil_id, perfiles(id, nombre)').in('rol_id', roles.map((r:any)=>r.id))
    if (data) {
      const map = new Map<string,Piloto>()
      data.forEach((row:any) => { if (row.perfiles && !map.has(row.perfiles.id)) map.set(row.perfiles.id, row.perfiles) })
      setPilotos(Array.from(map.values()))
    }
  }
  const fetchMetodosPago = async () => {
    const { data } = await sb.from('metodos_pago').select('id, nombre').eq('activo', true).order('nombre')
    setMetodosPago((data||[]) as MetodoPago[])
  }
  const fetchReservaPagos = async () => {
    const { data } = await sb.from('reserva_pagos').select('id, metodo_pago_id, monto, metodos_pago(nombre)').eq('reserva_id', id).order('created_at')
    setReservaPagos((data||[]) as unknown as ReservaPago[])
  }

  const toggleVolo = async () => {
    const msg = volo ? `¿Desmarcar vuelo de ${nombre}?` : `¿Ya voló ${nombre}?`
    if (!confirm(msg)) return
    setSavingVolo(true)
    const nuevoVolo = !volo
    await sb.from('reservas').update({ volo: nuevoVolo }).eq('id', id)
    setVolo(nuevoVolo)
    setSavingVolo(false)
    onSave?.()
  }

  const guardarReserva = async () => {
    setResMsg(null)
    if (!nombre.trim() || !fecha || !horarioId || !cantidad) {
      setResMsg({type:'err', text:'Completa todos los campos'}); return
    }
    setSavingRes(true)
    const { error } = await sb.from('reservas').update({
      nombre:nombre.trim(), telefono:Number(String(telefono).replace(/[^0-9]/g,''))||null,
      fecha, horario_id:horarioId, cantidad:parseInt(cantidad,10),
      abono: abono !== '' ? parseInt(abono, 10) : null
    }).eq('id', id)
    setSavingRes(false)
    if (error) { setResMsg({type:'err',text:error.message}); return }
    setEditing(false); setResMsg(null); onSave?.()
  }

  const eliminarServicio = async (srvId: number) => {
    setDeletingSrvId(srvId)
    await sb.from('reserva_servicios').delete().eq('id', srvId)
    setDeletingSrvId(null)
    fetchReservaServicios(); onSave?.()
  }

  const agregarServicio = async () => {
    if (!selectedSrvId) return
    setAddingSrv(true)
    await sb.from('reserva_servicios').insert({ reserva_id:Number(id), valor_id:selectedSrvId })
    setAddingSrv(false)
    setSelectedSrvId(null); setShowSrvPk(false)
    fetchReservaServicios(); onSave?.()
  }

  const agregarPago = async () => {
    if (!selectedPagoMetodoId || !pagoMonto) return
    setPagoError(null)
    setAddingPago(true)
    const { error } = await sb.from('reserva_pagos').insert({ reserva_id: Number(id), metodo_pago_id: selectedPagoMetodoId, monto: parseInt(pagoMonto, 10) })
    setAddingPago(false)
    if (error) { setPagoError(error.message); return }
    setSelectedPagoMetodoId(null); setPagoMonto(''); setShowPagoPk(false)
    fetchReservaPagos(); onSave?.()
  }

  const eliminarPago = async (pagoId: number) => {
    setDeletingPagoId(pagoId)
    await sb.from('reserva_pagos').delete().eq('id', pagoId)
    setDeletingPagoId(null)
    fetchReservaPagos(); onSave?.()
  }

  const resetPasForm = () => {
    setPNombre(''); setPEdad(''); setPPeso(''); setPCamara(null); setPCumpleanero(false)
    setPPilotoId(null); setPPilotoNombre(''); setEditingPasId(null)
    setShowPasForm(false); setShowPilotoPk(false); setPasError(null)
  }

  const openEditPas = (p: Pasajero) => {
    setPNombre(p.nombre||''); setPEdad(p.edad!=null?String(p.edad):''); setPPeso(p.peso!=null?String(p.peso):'')
    setPCamara(p.sin_camara?'sin_camara':p.camara_normal?'camara_normal':p.camara_360?'camara_360':null)
    setPCumpleanero(p.cumpleanero||false)
    const pl = pilotos.find(pl=>pl.id===p.perfil_id)
    setPPilotoId(p.perfil_id||null); setPPilotoNombre(pl?.nombre||'')
    setEditingPasId(p.id); setShowPasForm(true); setPasError(null)
  }

  const handleCumpleanero = (val: boolean) => {
    setPCumpleanero(val)
    if (val) setPCamara('camara_360')
  }

  const guardarPasajero = async () => {
    setPasError(null)
    if (!pNombre.trim()) return setPasError('El nombre del pasajero es obligatorio')
    const payload: Record<string,unknown> = {
      nombre:pNombre.trim(), edad:pEdad?parseInt(pEdad,10):null, peso:pPeso?parseInt(pPeso,10):null,
      sin_camara:pCamara==='sin_camara', camara_normal:pCamara==='camara_normal', camara_360:pCamara==='camara_360',
      perfil_id:pPilotoId||null, cumpleanero:pCumpleanero
    }
    setSavingPas(true)
    let error: any
    if (editingPasId) {
      ({ error } = await sb.from('reservas_personas').update(payload).eq('id', editingPasId))
    } else {
      payload.reserva_id = Number(id)
      ;({ error } = await sb.from('reservas_personas').insert(payload))
      if (!error) {
        const newTotal = pasajeros.length + 1
        if (newTotal > (parseInt(cantidad,10)||0)) {
          await sb.from('reservas').update({cantidad:newTotal}).eq('id',id)
          setCantidad(String(newTotal))
        }
      }
    }
    setSavingPas(false)
    if (error) setPasError(error.message)
    else { resetPasForm(); fetchPasajeros(); onSave?.() }
  }

  const eliminarPasajero = async (pasId: number) => {
    if (!confirm('¿Seguro que deseas eliminar este pasajero?')) return
    setDeletingPasId(pasId)
    await sb.from('reservas_personas').delete().eq('id', pasId)
    setDeletingPasId(null)
    fetchPasajeros(); onSave?.()
  }

  const horLabel = horarioId
    ? (horarios.find(h=>h.id===horarioId) ? fmtH(horarios.find(h=>h.id===horarioId)!.horario) : '---')
    : '---'

  const iCls = editing
    ? "w-full rounded-xl p-3 text-sm bg-white text-[#0d2b5c] placeholder-[#7aafd4]"
    : "w-full rounded-xl p-3 text-sm bg-[#f5f8fc] text-[#0d2b5c]"
  const iStyle = editing
    ? { border:'1px solid #b0cce8' }
    : { border:'1px solid #d8e6f3' }

  const totalBruto = reservaServicios.filter(rs=>!rs.valores?.descuento).reduce((s,rs)=>s+(rs.valores?.monto??0),0)
  const totalDescuentos = reservaServicios.filter(rs=>rs.valores?.descuento).reduce((s,rs)=>s+(rs.valores?.monto??0),0)
  const totalNeto = totalBruto - totalDescuentos
  const abonoNum = abono !== '' ? parseInt(abono, 10)||0 : 0
  const totalPagado = reservaPagos.reduce((s, p) => s + p.monto, 0)
  const saldoRestante = totalNeto - abonoNum - totalPagado

  const selectedSrvLabel = selectedSrvId
    ? (() => { const v=valoresServicios.find(v=>v.id===selectedSrvId); return v?`${v.servicio} ${v.descuento?'-':''}${fmtCLP(v.monto)}`:'---' })()
    : 'Agregar servicio o descuento...'

  return (
    <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4">

      {/* ── Datos + Servicios ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[#0d2b5c] font-bold text-sm uppercase tracking-wide">Datos de la reserva</p>
          <div className="flex items-center gap-2">
            {!editing && <span className="text-xs text-[#7aafd4] font-medium">Solo lectura</span>}
            <button
              onClick={toggleVolo}
              disabled={savingVolo}
              title={volo ? 'Desmarcar vuelo' : 'Marcar como voló'}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
              style={{ background: volo ? 'rgba(155,89,182,0.2)' : 'rgba(46,109,180,0.1)' }}>
              <span className="text-base">{savingVolo ? '⏳' : '🪂'}</span>
            </button>
          </div>
        </div>

        {resMsg && (
          <div className={`mb-3 p-3 rounded-xl text-sm ${resMsg.type==='ok'
            ? 'bg-green-50 border border-green-300 text-green-800'
            : 'bg-red-50 border border-red-300 text-red-800'}`}>
            {resMsg.text}
          </div>
        )}

        {/* Nombre */}
        <div className="mb-2">
          <label className={labelCls}>Nombre</label>
          <input className={iCls} style={iStyle} value={nombre}
            onChange={editing ? e=>setNombre(e.target.value) : undefined}
            readOnly={!editing} placeholder="Nombre" />
        </div>

        {/* Teléfono + Fecha */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <label className={labelCls}>Teléfono</label>
            <input className={iCls} style={iStyle} value={telefono} type="tel" maxLength={15}
              onChange={editing ? e=>setTelefono(e.target.value.replace(/[^0-9]/g,'')) : undefined}
              readOnly={!editing} placeholder="912345678" />
          </div>
          <div className="shrink-0">
            <label className={labelCls}>Fecha</label>
            <input className="rounded-xl p-3 text-sm text-[#0d2b5c]" style={iStyle}
              type="date" value={fecha}
              onChange={editing ? e=>setFecha(e.target.value) : undefined}
              readOnly={!editing} />
          </div>
        </div>

        {/* Horario + Personas + Abono */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className={labelCls}>Horario</label>
            <div className="relative">
              <button type="button"
                onClick={editing ? () => setShowHorPk(!showHorPk) : undefined}
                className={`${iCls} text-left`}
                style={{ ...iStyle, color: horarioId ? '#0d2b5c' : '#7aafd4', cursor: editing ? 'pointer' : 'default' }}>
                {horLabel}
              </button>
              {showHorPk && editing && (
                <div className="absolute z-10 w-full bg-white rounded-xl mt-1 shadow-xl overflow-hidden" style={{ border:'1px solid #b0cce8' }}>
                  {horarios.map(h => (
                    <button key={h.id} type="button"
                      onClick={() => { setHorarioId(h.id); setShowHorPk(false) }}
                      className="w-full text-left px-4 py-3 text-sm text-[#0d2b5c] hover:bg-blue-50"
                      style={{ borderBottom:'1px solid #e8f0fb' }}>
                      {fmtH(h.horario)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="w-16 shrink-0">
            <label className={labelCls}>Pers.</label>
            <input className="w-full rounded-xl p-3 text-sm text-[#0d2b5c] text-center" style={iStyle}
              type="number" min="1" max="99" value={cantidad} placeholder="1"
              onChange={editing ? e=>setCantidad(e.target.value) : undefined}
              readOnly={!editing} />
          </div>
          <div className="w-28 shrink-0">
            <label className={labelCls}>Abono</label>
            {editing ? (
              <div className="flex items-center rounded-xl overflow-hidden h-[46px]" style={{ border:'1px solid #b0cce8', background:'white' }}>
                <span className="px-2 text-gray-400 text-xs font-semibold select-none">$</span>
                <input className="flex-1 text-sm bg-transparent outline-none w-0 text-[#0d2b5c]"
                  placeholder="0" value={abono}
                  onChange={e=>setAbono(e.target.value.replace(/[^0-9]/g,''))}
                  maxLength={6} />
              </div>
            ) : (
              <div className="rounded-xl p-3 text-sm text-[#0d2b5c] bg-[#f5f8fc]" style={{ border:'1px solid #d8e6f3' }}>
                {abono ? fmtCLP(Number(abono)) : '—'}
              </div>
            )}
          </div>
        </div>

        {/* Cuadro servicios */}
        <div className="rounded-xl p-3 mb-3" style={{ background:'#f0f6ff', border:'1px solid #b0cce8' }}>
          <label className={labelCls + ' mb-2'}>Servicios</label>

          <div className="flex flex-wrap gap-1.5 min-h-7 mb-2">
            {reservaServicios.length === 0
              ? <span className="text-gray-400 text-xs self-center">Sin servicios</span>
              : reservaServicios.map(rs => {
                  const esDesc = rs.valores?.descuento
                  return (
                    <span key={rs.id} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                      style={esDesc
                        ? { background:'#ffe5e5', color:'#c0392b' }
                        : { background:'#2e6db4', color:'#fff' }}>
                      {rs.valores?.servicio}
                      {esDesc ? ` -${fmtCLP(rs.valores?.monto??0)}` : ` ${fmtCLP(rs.valores?.monto??0)}`}
                      {editing && (
                        <button onClick={()=>eliminarServicio(rs.id)} disabled={deletingSrvId===rs.id}
                          className="ml-0.5 font-bold hover:opacity-70 disabled:opacity-40 leading-none">
                          {deletingSrvId===rs.id ? '⏳' : '×'}
                        </button>
                      )}
                    </span>
                  )
                })
            }
          </div>

          {editing && (
            <div>
              <div className="relative">
                <button type="button" onClick={()=>setShowSrvPk(!showSrvPk)}
                  className="w-full text-left rounded-xl p-2.5 text-xs text-[#7aafd4]"
                  style={{ background:'white', border:'1px dashed #b0cce8' }}>
                  {selectedSrvLabel}
                </button>
                {showSrvPk && (
                  <div className="absolute z-10 w-full bg-white rounded-xl mt-1 shadow-xl overflow-hidden" style={{ border:'1px solid #b0cce8' }}>
                    {valoresServicios.length === 0
                      ? <p className="p-3 text-gray-400 text-sm">No hay servicios disponibles</p>
                      : valoresServicios.map(v => (
                        <button key={v.id} type="button" onClick={()=>{ setSelectedSrvId(v.id); setShowSrvPk(false) }}
                          className={`w-full text-left px-4 py-2.5 ${v.descuento ? 'hover:bg-red-50' : 'hover:bg-blue-50'}`}
                          style={{ borderBottom:'1px solid #e8f0fb' }}>
                          <span className={`text-sm font-semibold ${v.descuento ? 'text-red-700' : 'text-[#0d2b5c]'}`}>{v.servicio}</span>
                          <span className={`text-xs ml-2 ${v.descuento ? 'text-red-400' : 'text-[#2e6db4]'}`}>
                            {v.descuento ? '-' : ''}{fmtCLP(v.monto)}
                          </span>
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
              {selectedSrvId && (
                <button onClick={agregarServicio} disabled={addingSrv}
                  className="w-full mt-2 font-bold py-2 rounded-xl text-xs text-white disabled:opacity-60 transition-all"
                  style={{ background:'linear-gradient(135deg,#2e6db4,#1a4a85)' }}>
                  {addingSrv ? 'Agregando...' : '+ Agregar'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Resumen financiero */}
        {(totalBruto > 0 || abonoNum > 0 || totalPagado > 0) && (
          <div className="rounded-xl p-3 mb-3 divide-y divide-[#e8f0fb]" style={{ background:'#f0f6ff', border:'1px solid #b0cce8' }}>
            {totalBruto > 0 && (
              <div className="flex justify-between py-1.5">
                <span className="text-xs text-gray-600">Total servicios</span>
                <span className="text-xs font-semibold text-[#0d2b5c]">{fmtCLP(totalBruto)}</span>
              </div>
            )}
            {totalDescuentos > 0 && (
              <div className="flex justify-between py-1.5">
                <span className="text-xs text-red-500">Descuentos</span>
                <span className="text-xs font-semibold text-red-500">- {fmtCLP(totalDescuentos)}</span>
              </div>
            )}
            {abonoNum > 0 && (
              <div className="flex justify-between py-1.5">
                <span className="text-xs text-green-700">Abono</span>
                <span className="text-xs font-semibold text-green-700">- {fmtCLP(abonoNum)}</span>
              </div>
            )}
            {totalPagado > 0 && (
              <div className="flex justify-between py-1.5">
                <span className="text-xs text-green-700">Pagos registrados</span>
                <span className="text-xs font-semibold text-green-700">- {fmtCLP(totalPagado)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 pb-0.5">
              <span className="text-xs font-bold text-[#0d2b5c]">Saldo restante</span>
              <span className={`text-xs font-bold ${saldoRestante <= 0 ? 'text-green-600' : 'text-[#0d2b5c]'}`}>{fmtCLP(saldoRestante)}</span>
            </div>
          </div>
        )}

        {/* Cuadro pagos */}
        <div className="rounded-xl p-3 mb-3" style={{ background:'#f0fff4', border:'1px solid #86efac' }}>
          <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color:'#166534' }}>
            Pagos
          </label>

          {/* Chips de pagos registrados */}
          <div className="flex flex-wrap gap-1.5 min-h-7 mb-3">
            {reservaPagos.length === 0
              ? <span className="text-gray-400 text-xs self-center">Sin pagos registrados</span>
              : reservaPagos.map(p => (
                  <span key={p.id} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                    style={{ background:'#16a34a', color:'#fff' }}>
                    💳 {p.metodos_pago?.nombre} · {fmtCLP(p.monto)}
                    <button onClick={() => eliminarPago(p.id)} disabled={deletingPagoId === p.id}
                      className="ml-0.5 font-bold hover:opacity-70 disabled:opacity-40 leading-none">
                      {deletingPagoId === p.id ? '⏳' : '×'}
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
                {selectedPagoMetodoId ? metodosPago.find(m => m.id === selectedPagoMetodoId)?.nombre ?? '...' : 'Método de pago...'}
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
            <div className="flex items-center rounded-xl overflow-hidden shrink-0" style={{ border:'1px solid #86efac', background:'white', width:'96px' }}>
              <span className="pl-2 text-gray-400 text-xs font-semibold select-none">$</span>
              <input className="flex-1 text-sm bg-transparent outline-none px-1 py-2.5 w-0 text-[#0d2b5c]"
                placeholder="0" value={pagoMonto}
                onChange={e => setPagoMonto(e.target.value.replace(/[^0-9]/g,''))}
                maxLength={8} />
            </div>
            <button onClick={agregarPago} disabled={addingPago || !selectedPagoMetodoId || !pagoMonto}
              className="shrink-0 font-bold py-2.5 px-3 rounded-xl text-xs text-white transition-all"
              style={{ background: (!selectedPagoMetodoId || !pagoMonto) ? '#86efac' : '#16a34a' }}>
              {addingPago ? '...' : '+ Agregar'}
            </button>
          </div>
        </div>

        {/* Botón Editar / Guardar */}
        <button
          onClick={editing ? guardarReserva : () => { setEditing(true); setResMsg(null) }}
          disabled={savingRes}
          className="w-full font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-60"
          style={editing
            ? { background:'linear-gradient(135deg,#2e6db4,#1a4a85)', color:'#fff' }
            : { background:'#ffd700', color:'#0d2b5c' }}>
          {editing ? (savingRes ? 'Guardando...' : 'Guardar cambios') : 'Editar'}
        </button>
        {editing && (
          <button onClick={() => { setEditing(false); setResMsg(null); fetchReserva() }}
            className="w-full mt-2 font-bold py-2.5 rounded-xl text-sm transition-all"
            style={{ background:'#e8f0fb', color:'#2e6db4' }}>
            Cancelar
          </button>
        )}
      </div>

      {/* ── Pasajeros ── */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#0d2b5c] font-bold text-sm uppercase tracking-wide">
            Pasajeros {pasajeros.length > 0 && <span className="text-[#2e6db4] normal-case font-bold">({pasajeros.length})</span>}
          </p>
          {!showPasForm && (
            <button onClick={() => { setShowPasForm(true); setEditingPasId(null) }}
              className="text-sm font-bold px-4 py-2 rounded-xl text-white"
              style={{ background:'linear-gradient(135deg,#2e6db4,#1a4a85)' }}>
              + Agregar
            </button>
          )}
        </div>

        {/* Formulario pasajero */}
        {showPasForm && (
          <div className="rounded-2xl p-4 mb-4" style={{ background:'#f0f6ff', border:'1px solid #b0cce8' }}>
            <p className="text-[#0d2b5c] font-bold text-sm mb-3">{editingPasId ? 'Editar pasajero' : 'Nuevo pasajero'}</p>
            {pasError && <div className="mb-3 p-3 bg-red-50 border border-red-300 text-red-700 rounded-xl text-sm">{pasError}</div>}

            <label className={labelCls}>Nombre *</label>
            <input className="w-full rounded-xl p-3 text-sm bg-white text-[#0d2b5c] mb-3"
              style={{ border:'1px solid #b0cce8' }}
              value={pNombre} onChange={e=>setPNombre(e.target.value)} placeholder="Nombre del pasajero" />

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className={labelCls}>Edad</label>
                <input className="w-full rounded-xl p-3 text-sm bg-white text-[#0d2b5c]"
                  style={{ border:'1px solid #b0cce8' }}
                  type="number" value={pEdad} onChange={e=>setPEdad(e.target.value)} placeholder="25" />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Peso (kg)</label>
                <input className="w-full rounded-xl p-3 text-sm bg-white text-[#0d2b5c]"
                  style={{ border:'1px solid #b0cce8' }}
                  type="number" value={pPeso} onChange={e=>setPPeso(e.target.value)} placeholder="70" />
              </div>
            </div>

            <label className={labelCls}>Cámara</label>
            <div className="flex gap-2 mb-3">
              {(['sin_camara','camara_normal','camara_360'] as CamaraOp[]).map(op => (
                <button key={op} type="button" onClick={() => setPCamara(pCamara===op ? null : op)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={pCamara===op
                    ? { background:'linear-gradient(135deg,#2e6db4,#1a4a85)', color:'#fff', border:'2px solid #2e6db4' }
                    : { background:'#fff', color:'#1a4a85', border:'2px solid #b0cce8' }}>
                  {CAMARA_LABELS[op]}
                </button>
              ))}
            </div>

            <label className={labelCls}>Piloto (opcional)</label>
            <div className="relative mb-3">
              <button type="button" onClick={() => setShowPilotoPk(!showPilotoPk)}
                className="w-full rounded-xl p-3 text-sm bg-white text-left"
                style={{ border:'1px solid #b0cce8', color: pPilotoNombre ? '#0d2b5c' : '#7aafd4' }}>
                {pPilotoNombre || 'Seleccionar piloto...'}
              </button>
              {showPilotoPk && (
                <div className="absolute z-10 w-full bg-white rounded-xl mt-1 shadow-xl overflow-hidden" style={{ border:'1px solid #b0cce8' }}>
                  <button type="button" onClick={() => { setPPilotoId(null); setPPilotoNombre(''); setShowPilotoPk(false) }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:bg-gray-50"
                    style={{ borderBottom:'1px solid #e8f0fb' }}>Sin piloto</button>
                  {pilotos.length === 0
                    ? <p className="p-3 text-gray-400 text-sm">No hay pilotos registrados</p>
                    : pilotos.map(pl => (
                      <button key={pl.id} type="button"
                        onClick={() => { setPPilotoId(pl.id); setPPilotoNombre(pl.nombre); setShowPilotoPk(false) }}
                        className="w-full text-left px-4 py-3 text-sm text-[#0d2b5c] hover:bg-blue-50"
                        style={{ borderBottom:'1px solid #e8f0fb' }}>
                        {pl.nombre}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>

            <div className="rounded-xl px-3 mb-4 bg-white" style={{ border:'1px solid #b0cce8' }}>
              <SwitchSiNo value={pCumpleanero} onChange={handleCumpleanero} label="¿Es cumpleañero?" />
            </div>

            <div className="flex gap-3">
              <button onClick={resetPasForm}
                className="flex-1 font-bold py-3 rounded-xl text-sm transition-all"
                style={{ background:'#e8f0fb', color:'#2e6db4' }}>
                Cancelar
              </button>
              <button onClick={guardarPasajero} disabled={savingPas}
                className="flex-1 font-bold py-3 rounded-xl text-sm text-white transition-all disabled:opacity-60"
                style={{ background:'linear-gradient(135deg,#2e6db4,#1a4a85)' }}>
                {savingPas ? '...' : editingPasId ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        )}

        {/* Lista pasajeros */}
        {pasajeros.length === 0
          ? <div className="text-center py-8 text-gray-400 text-sm">No hay pasajeros registrados</div>
          : <div className="flex flex-col gap-3">
              {pasajeros.map(p => {
                const camaras = [p.sin_camara&&'Sin cámara', p.camara_normal&&'Normal', p.camara_360&&'360°'].filter(Boolean).join(', ')
                const camaraEmoji = p.camara_360 ? '📽️' : '📷'
                const pl = pilotos.find(pl=>pl.id===p.perfil_id)
                return (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-2xl p-4"
                    style={{ background:'#f0f6ff', border:'1px solid #b0cce8', borderLeft:'4px solid #2e6db4' }}>
                    <div className="flex-1">
                      <p className="text-[#0d2b5c] font-bold text-sm flex items-center gap-1">
                        {p.nombre}
                        {p.cumpleanero && <span className="text-base leading-none">🥳</span>}
                      </p>
                      {(p.edad||p.peso) && <p className="text-[#2e6db4] text-xs mt-0.5">{[p.edad&&`${p.edad} años`, p.peso&&`${p.peso} kg`].filter(Boolean).join(' · ')}</p>}
                      {camaras && <p className="text-gray-500 text-xs mt-0.5">{camaraEmoji} {camaras}</p>}
                      <p className={`text-xs mt-0.5 ${pl?'text-[#1a4a85]':'text-gray-400'}`}>🪂 {pl?pl.nombre:'Sin piloto'}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEditPas(p)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl"
                        style={{ background:'#d0e6ff', color:'#0d2b5c' }}>
                        Editar
                      </button>
                      <button onClick={() => eliminarPasajero(p.id)} disabled={deletingPasId===p.id}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl disabled:opacity-50"
                        style={{ background:'#ffeef0', color:'#c0392b' }}>
                        {deletingPasId===p.id ? '...' : 'Borrar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
        }
      </div>

    </div>
  )
}
