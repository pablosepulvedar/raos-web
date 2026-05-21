'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type Horario = { id: number; horario: number }
type ValorPasajero = { id: number; servicio: string; monto: number }
type ReservaServicio = { id: number; valor_id: number; valores: { id: number; servicio: string; monto: number } | null }
type Pasajero = { id: number; nombre: string; edad: number|null; peso: number|null; sin_camara: boolean; camara_normal: boolean; camara_360: boolean; perfil_id: string|null }
type Piloto = { id: string; nombre: string }

const fmtHorario = (v: number) => { const s = String(v).padStart(4,'0'); return `${s.slice(0,2)}:${s.slice(2)}` }
type CamaraOp = 'sin_camara'|'camara_normal'|'camara_360'
const CAMARA_LABELS: Record<CamaraOp, string> = { sin_camara:'Sin cámara', camara_normal:'Normal', camara_360:'360°' }

export default function ReservaDetalle() {
  const { id } = useParams<{ id: string }>()

  // Reserva
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState('')
  const [selectedHorarioId, setSelectedHorarioId] = useState<number|null>(null)
  const [cantidad, setCantidad] = useState('')
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [showHorarioPicker, setShowHorarioPicker] = useState(false)
  const [savingReserva, setSavingReserva] = useState(false)
  const [reservaMsg, setReservaMsg] = useState<{type:'ok'|'err', text:string}|null>(null)

  // Servicios
  const [reservaServicios, setReservaServicios] = useState<ReservaServicio[]>([])
  const [valoresPasajero, setValoresPasajero] = useState<ValorPasajero[]>([])
  const [selectedServicioId, setSelectedServicioId] = useState<number|null>(null)
  const [showServicioPicker, setShowServicioPicker] = useState(false)
  const [addingServicio, setAddingServicio] = useState(false)
  const [deletingServicioId, setDeletingServicioId] = useState<number|null>(null)

  // Pasajeros
  const [pasajeros, setPasajeros] = useState<Pasajero[]>([])
  const [pilotos, setPilotos] = useState<Piloto[]>([])
  const [showPasajeroForm, setShowPasajeroForm] = useState(false)
  const [editingPasajeroId, setEditingPasajeroId] = useState<number|null>(null)
  const [pNombre, setPNombre] = useState('')
  const [pEdad, setPEdad] = useState('')
  const [pPeso, setPPeso] = useState('')
  const [pCamara, setPCamara] = useState<CamaraOp|null>(null)
  const [pPilotoId, setPPilotoId] = useState<string|null>(null)
  const [pPilotoNombre, setPPilotoNombre] = useState('')
  const [showPilotoPicker, setShowPilotoPicker] = useState(false)
  const [savingPasajero, setSavingPasajero] = useState(false)
  const [deletingPasajeroId, setDeletingPasajeroId] = useState<number|null>(null)
  const [pasajeroError, setPasajeroError] = useState<string|null>(null)

  useEffect(() => {
    if (!id) return
    fetchReserva()
    fetchPasajeros()
    fetchReservaServicios()
    fetchHorarios()
    fetchPilotos()
    fetchValoresPasajero()
  }, [id])

  const fetchReserva = async () => {
    const { data } = await supabase.from('reservas').select('*').eq('id', id).single()
    if (data) {
      setNombre(data.nombre||''); setTelefono(String(data.telefono||''))
      setFecha(data.fecha||''); setSelectedHorarioId(data.horario_id??null)
      setCantidad(String(data.cantidad||''))
    }
  }
  const fetchHorarios = async () => {
    const { data } = await supabase.from('horarios').select('*').order('horario')
    setHorarios((data||[]) as Horario[])
  }
  const fetchReservaServicios = async () => {
    const { data } = await supabase.from('reserva_servicios').select('id, valor_id, valores(id, servicio, monto)').eq('reserva_id', id)
    setReservaServicios((data||[]) as unknown as ReservaServicio[])
  }
  const fetchValoresPasajero = async () => {
    const { data } = await supabase.from('valores').select('*').eq('pasajero', true).order('servicio')
    setValoresPasajero((data||[]) as ValorPasajero[])
  }
  const fetchPasajeros = async () => {
    const { data } = await supabase.from('reservas_personas').select('*').eq('reserva_id', id).order('created_at')
    setPasajeros((data||[]) as Pasajero[])
  }
  const fetchPilotos = async () => {
    const { data: roleData } = await supabase.from('roles').select('id').ilike('nombre','%piloto%')
    if (!roleData?.length) return
    const { data } = await supabase.from('perfil_roles').select('perfil_id, perfiles(id, nombre)').in('rol_id', roleData.map((r:any)=>r.id))
    if (data) {
      const map = new Map<string,Piloto>()
      data.forEach((row:any) => { if (row.perfiles && !map.has(row.perfiles.id)) map.set(row.perfiles.id, row.perfiles) })
      setPilotos(Array.from(map.values()))
    }
  }

  const guardarReserva = async () => {
    setReservaMsg(null)
    if (!nombre.trim() || !fecha || !selectedHorarioId || !cantidad) {
      setReservaMsg({type:'err', text:'Completa todos los campos'})
      return
    }
    setSavingReserva(true)
    const { error } = await supabase.from('reservas').update({
      nombre:nombre.trim(), telefono:Number(String(telefono).replace(/[^0-9]/g,''))||null,
      fecha, horario_id:selectedHorarioId, cantidad:parseInt(cantidad,10)
    }).eq('id', id)
    setSavingReserva(false)
    setReservaMsg(error ? {type:'err',text:error.message} : {type:'ok',text:'Reserva actualizada correctamente'})
  }

  const agregarServicio = async () => {
    if (!selectedServicioId) return
    setAddingServicio(true)
    const { error } = await supabase.from('reserva_servicios').insert({ reserva_id:Number(id), valor_id:selectedServicioId })
    setAddingServicio(false)
    if (!error) { setSelectedServicioId(null); setShowServicioPicker(false); fetchReservaServicios() }
  }

  const eliminarServicio = async (servicioId: number) => {
    setDeletingServicioId(servicioId)
    await supabase.from('reserva_servicios').delete().eq('id', servicioId)
    setDeletingServicioId(null)
    fetchReservaServicios()
  }

  const resetPasajeroForm = () => {
    setPNombre(''); setPEdad(''); setPPeso(''); setPCamara(null)
    setPPilotoId(null); setPPilotoNombre(''); setEditingPasajeroId(null)
    setShowPasajeroForm(false); setShowPilotoPicker(false); setPasajeroError(null)
  }

  const openEditPasajero = (p: Pasajero) => {
    setPNombre(p.nombre||''); setPEdad(p.edad!=null?String(p.edad):''); setPPeso(p.peso!=null?String(p.peso):'')
    setPCamara(p.sin_camara?'sin_camara':p.camara_normal?'camara_normal':p.camara_360?'camara_360':null)
    const pl = pilotos.find(pl=>pl.id===p.perfil_id)
    setPPilotoId(p.perfil_id||null); setPPilotoNombre(pl?.nombre||'')
    setEditingPasajeroId(p.id); setShowPasajeroForm(true); setPasajeroError(null)
  }

  const guardarPasajero = async () => {
    setPasajeroError(null)
    if (!pNombre.trim()) return setPasajeroError('El nombre del pasajero es obligatorio')
    const payload: Record<string,unknown> = {
      nombre:pNombre.trim(), edad:pEdad?parseInt(pEdad,10):null, peso:pPeso?parseInt(pPeso,10):null,
      sin_camara:pCamara==='sin_camara', camara_normal:pCamara==='camara_normal', camara_360:pCamara==='camara_360',
      perfil_id:pPilotoId||null
    }
    setSavingPasajero(true)
    let error: any
    if (editingPasajeroId) {
      ({ error } = await supabase.from('reservas_personas').update(payload).eq('id', editingPasajeroId))
    } else {
      payload.reserva_id = Number(id)
      ;({ error } = await supabase.from('reservas_personas').insert(payload))
      if (!error) {
        const newTotal = pasajeros.length + 1
        const cantActual = parseInt(cantidad,10)||0
        if (newTotal > cantActual) {
          await supabase.from('reservas').update({cantidad:newTotal}).eq('id',id)
          setCantidad(String(newTotal))
        }
      }
    }
    setSavingPasajero(false)
    if (error) setPasajeroError(error.message)
    else { resetPasajeroForm(); fetchPasajeros() }
  }

  const eliminarPasajero = async (pasajeroId: number) => {
    if (!confirm('¿Seguro que deseas eliminar este pasajero?')) return
    setDeletingPasajeroId(pasajeroId)
    await supabase.from('reservas_personas').delete().eq('id', pasajeroId)
    setDeletingPasajeroId(null)
    fetchPasajeros()
  }

  const horarioLabel = selectedHorarioId
    ? (horarios.find(h=>h.id===selectedHorarioId) ? fmtHorario(horarios.find(h=>h.id===selectedHorarioId)!.horario) : '---')
    : 'Selecciona un horario'

  const servicioLabel = selectedServicioId
    ? (() => { const v=valoresPasajero.find(v=>v.id===selectedServicioId); return v?`${v.servicio} — $${Number(v.monto).toLocaleString('es-CL')}`:'---' })()
    : 'Selecciona un servicio...'

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#ffd700] px-5 py-5 flex items-center gap-4">
        <Link href="/reservas" className="text-[#1e5a96] text-lg font-semibold hover:opacity-70">← Volver</Link>
        <h1 className="text-[#1e5a96] text-xl font-bold flex-1 text-center">📋 Detalle Reserva</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-5">

        {/* Datos reserva */}
        <div className="bg-[#fff3cd] border border-[#ffd700] rounded-2xl p-5">
          <p className="text-[#1e5a96] font-bold text-base mb-4">Datos de la reserva</p>

          {reservaMsg && (
            <div className={`mb-3 p-3 rounded-lg text-sm ${reservaMsg.type==='ok' ? 'bg-green-100 border border-green-400 text-green-800' : 'bg-red-100 border border-red-400 text-red-800'}`}>
              {reservaMsg.text}
            </div>
          )}

          <label className="block text-[#1e5a96] font-semibold text-sm mb-1">Nombre</label>
          <input className="w-full border border-[#ffd700] rounded-lg p-3 text-sm mb-3 bg-white" value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre" />

          <label className="block text-[#1e5a96] font-semibold text-sm mb-1">Teléfono</label>
          <input className="w-full border border-[#ffd700] rounded-lg p-3 text-sm mb-3 bg-white" value={telefono} onChange={e=>setTelefono(e.target.value.replace(/[^0-9]/g,''))} placeholder="Teléfono" type="tel" />

          <label className="block text-[#1e5a96] font-semibold text-sm mb-1">Fecha</label>
          <input className="w-full border border-[#ffd700] rounded-lg p-3 text-sm mb-3 bg-white" type="date" value={fecha} onChange={e=>setFecha(e.target.value)} />

          <label className="block text-[#1e5a96] font-semibold text-sm mb-1">Horario</label>
          <div className="relative mb-3">
            <button type="button" onClick={()=>setShowHorarioPicker(!showHorarioPicker)}
              className="w-full border border-[#ffd700] rounded-lg p-3 text-sm bg-white text-left">
              {horarioLabel}
            </button>
            {showHorarioPicker && (
              <div className="absolute z-10 w-full bg-white border border-[#ffd700] rounded-lg mt-1 shadow-lg overflow-hidden">
                {horarios.map(h => (
                  <button key={h.id} type="button" onClick={()=>{setSelectedHorarioId(h.id);setShowHorarioPicker(false)}}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-yellow-50 border-b last:border-b-0 border-gray-100">
                    {fmtHorario(h.horario)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="block text-[#1e5a96] font-semibold text-sm mb-1">Cantidad personas</label>
          <input className="w-full border border-[#ffd700] rounded-lg p-3 text-sm mb-4 bg-white" type="number" min="1" value={cantidad} onChange={e=>setCantidad(e.target.value)} placeholder="0" />

          <button onClick={guardarReserva} disabled={savingReserva}
            className="w-full bg-[#ffd700] text-[#1e5a96] font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-60">
            {savingReserva ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

        {/* Servicios */}
        <div className="bg-white border border-[#d4e6f5] rounded-2xl p-5">
          <p className="text-[#0d2b5c] font-bold text-base mb-3">Servicios ({reservaServicios.length})</p>

          {reservaServicios.length === 0
            ? <p className="text-gray-400 text-sm mb-3">Sin servicios asignados</p>
            : <div className="divide-y divide-gray-100 mb-3">
                {reservaServicios.map(rs => (
                  <div key={rs.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-[#0d2b5c] font-semibold text-sm">{rs.valores?.servicio ?? 'Servicio'}</p>
                      <p className="text-gray-500 text-xs">${Number(rs.valores?.monto??0).toLocaleString('es-CL')}</p>
                    </div>
                    <button onClick={()=>eliminarServicio(rs.id)} disabled={deletingServicioId===rs.id}
                      className="p-2 bg-[#ffe5e5] rounded-lg hover:bg-red-100 disabled:opacity-50">
                      <span className="text-sm">{deletingServicioId===rs.id ? '⏳' : '🗑️'}</span>
                    </button>
                  </div>
                ))}
              </div>
          }

          <p className="text-[#1e5a96] font-semibold text-sm mb-2">Agregar servicio</p>
          <div className="relative mb-3">
            <button type="button" onClick={()=>setShowServicioPicker(!showServicioPicker)}
              className="w-full border border-[#b0cce8] rounded-lg p-3 text-sm bg-white text-left text-gray-500">
              {servicioLabel}
            </button>
            {showServicioPicker && (
              <div className="absolute z-10 w-full bg-white border border-[#b0cce8] rounded-lg mt-1 shadow-lg overflow-hidden">
                {valoresPasajero.length === 0
                  ? <p className="p-3 text-gray-400 text-sm">No hay servicios disponibles</p>
                  : valoresPasajero.map(v => (
                    <button key={v.id} type="button" onClick={()=>{setSelectedServicioId(v.id);setShowServicioPicker(false)}}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 border-gray-100">
                      <p className="text-sm font-semibold text-gray-800">{v.servicio}</p>
                      <p className="text-xs text-gray-500">${Number(v.monto).toLocaleString('es-CL')}</p>
                    </button>
                  ))
                }
              </div>
            )}
          </div>
          <button onClick={agregarServicio} disabled={addingServicio||!selectedServicioId}
            className={`w-full font-bold py-3 rounded-xl transition-colors ${selectedServicioId ? 'bg-[#2e6db4] hover:bg-[#255d9a] text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            {addingServicio ? 'Agregando...' : '+ Agregar servicio'}
          </button>
        </div>

        {/* Pasajeros */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#1e5a96] font-bold text-base">Pasajeros ({pasajeros.length})</p>
            <button onClick={()=>showPasajeroForm?resetPasajeroForm():setShowPasajeroForm(true)}
              className="bg-[#1e5a96] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#174a82]">
              {showPasajeroForm ? 'Cancelar' : '+ Agregar'}
            </button>
          </div>

          {/* Formulario pasajero */}
          {showPasajeroForm && (
            <div className="bg-[#e8f0f7] rounded-2xl p-5 mb-4">
              <p className="text-[#1e5a96] font-bold text-sm mb-4">{editingPasajeroId ? 'Editar pasajero' : 'Nuevo pasajero'}</p>
              {pasajeroError && <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm">{pasajeroError}</div>}

              <label className="block text-[#1e5a96] font-semibold text-xs mb-1">Nombre *</label>
              <input className="w-full border border-[#4fa3ff] rounded-lg p-3 text-sm mb-3 bg-white" value={pNombre} onChange={e=>setPNombre(e.target.value)} placeholder="Nombre del pasajero" />

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="block text-[#1e5a96] font-semibold text-xs mb-1">Edad</label>
                  <input className="w-full border border-[#4fa3ff] rounded-lg p-3 text-sm bg-white" type="number" value={pEdad} onChange={e=>setPEdad(e.target.value)} placeholder="25" />
                </div>
                <div className="flex-1">
                  <label className="block text-[#1e5a96] font-semibold text-xs mb-1">Peso (kg)</label>
                  <input className="w-full border border-[#4fa3ff] rounded-lg p-3 text-sm bg-white" type="number" value={pPeso} onChange={e=>setPPeso(e.target.value)} placeholder="70" />
                </div>
              </div>

              <label className="block text-[#1e5a96] font-semibold text-xs mb-2">Cámara</label>
              <div className="flex gap-2 mb-3">
                {(['sin_camara','camara_normal','camara_360'] as CamaraOp[]).map(op => (
                  <button key={op} type="button" onClick={()=>setPCamara(pCamara===op?null:op)}
                    className={`flex-1 py-2.5 rounded-lg border-2 text-xs font-semibold transition-colors
                      ${pCamara===op ? 'border-[#1e5a96] bg-[#1e5a96] text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-[#1e5a96]'}`}>
                    {CAMARA_LABELS[op]}
                  </button>
                ))}
              </div>

              <label className="block text-[#1e5a96] font-semibold text-xs mb-1">Piloto (opcional)</label>
              <div className="relative mb-4">
                <button type="button" onClick={()=>setShowPilotoPicker(!showPilotoPicker)}
                  className="w-full border border-[#4fa3ff] rounded-lg p-3 text-sm bg-white text-left">
                  {pPilotoNombre || <span className="text-gray-400">Seleccionar piloto...</span>}
                </button>
                {showPilotoPicker && (
                  <div className="absolute z-10 w-full bg-white border border-[#4fa3ff] rounded-lg mt-1 shadow-lg overflow-hidden">
                    <button type="button" onClick={()=>{setPPilotoId(null);setPPilotoNombre('');setShowPilotoPicker(false)}}
                      className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100">Sin piloto</button>
                    {pilotos.length === 0
                      ? <p className="p-3 text-gray-400 text-sm">No hay pilotos registrados</p>
                      : pilotos.map(pl => (
                        <button key={pl.id} type="button" onClick={()=>{setPPilotoId(pl.id);setPPilotoNombre(pl.nombre);setShowPilotoPicker(false)}}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 border-b last:border-b-0 border-gray-100">
                          {pl.nombre}
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>

              <button onClick={guardarPasajero} disabled={savingPasajero}
                className="w-full bg-[#1e5a96] text-white font-bold py-3 rounded-xl hover:bg-[#174a82] transition-colors disabled:opacity-60">
                {savingPasajero ? 'Guardando...' : editingPasajeroId ? 'Guardar cambios' : 'Agregar pasajero'}
              </button>
            </div>
          )}

          {/* Lista pasajeros */}
          {pasajeros.length === 0
            ? <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">No hay pasajeros registrados</div>
            : <div className="flex flex-col gap-3">
                {pasajeros.map(p => {
                  const camaras = [p.sin_camara&&'Sin cámara', p.camara_normal&&'Normal', p.camara_360&&'360°'].filter(Boolean).join(', ')
                  const pl = pilotos.find(pl=>pl.id===p.perfil_id)
                  return (
                    <div key={p.id} className="bg-white rounded-xl p-4 border-l-4 border-[#1e5a96] shadow-sm flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[#1e5a96] font-bold text-sm">{p.nombre}</p>
                        {(p.edad||p.peso) && <p className="text-gray-500 text-xs mt-1">{[p.edad&&`${p.edad} años`, p.peso&&`${p.peso} kg`].filter(Boolean).join(' · ')}</p>}
                        {camaras && <p className="text-gray-500 text-xs mt-0.5">📷 {camaras}</p>}
                        <p className={`text-xs mt-0.5 ${pl?'text-[#1e5a96]':'text-gray-300'}`}>✈️ {pl?pl.nombre:'Sin piloto'}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={()=>openEditPasajero(p)} className="px-3 py-1.5 bg-[#e8f0f7] text-[#1e5a96] text-xs font-bold rounded-lg hover:bg-[#d0e3f5]">Editar</button>
                        <button onClick={()=>eliminarPasajero(p.id)} disabled={deletingPasajeroId===p.id}
                          className="p-2 bg-[#ffe5e5] rounded-lg hover:bg-red-100 disabled:opacity-50">
                          <span className="text-sm">{deletingPasajeroId===p.id?'⏳':'🗑️'}</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </div>

      </div>
    </div>
  )
}
