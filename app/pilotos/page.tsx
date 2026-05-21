'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type PilotoResumen = { perfil_id: string; nombre: string; vuelos: number }
type ServicioPiloto = { id: number; servicio: string; monto: number; cantidad: number }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`

export default function Pilotos() {
  const today = toDateStr(new Date())

  const [selectedDate, setSelectedDate]       = useState(today)
  const [currentMonth, setCurrentMonth]       = useState(new Date().getMonth())
  const [currentYear, setCurrentYear]         = useState(new Date().getFullYear())
  const [diasConActividad, setDiasConActividad] = useState<Set<string>>(new Set())
  const [pilotos, setPilotos]                 = useState<PilotoResumen[]>([])
  const [pilotoReservaIds, setPilotoReservaIds] = useState<Record<string, number[]>>({})

  const [expandedPiloto, setExpandedPiloto]           = useState<string | null>(null)
  const [valoresPiloto, setValoresPiloto]             = useState<any[]>([])
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<ServicioPiloto[]>([])
  const [showServicioPicker, setShowServicioPicker]   = useState(false)
  const [saving, setSaving]                           = useState(false)
  const [savedMsg, setSavedMsg]                       = useState<string | null>(null)

  useEffect(() => {
    fetchValoresPiloto()
    fetchPilotosDelDia(today)
    fetchDiasConActividad(new Date().getFullYear(), new Date().getMonth())
  }, [])

  useEffect(() => { fetchDiasConActividad(currentYear, currentMonth) }, [currentMonth, currentYear])

  const fetchValoresPiloto = async () => {
    const { data } = await supabase.from('valores').select('*').eq('piloto', true).order('servicio')
    setValoresPiloto(data || [])
  }

  const fetchDiasConActividad = async (year: number, month: number) => {
    const first = `${year}-${String(month+1).padStart(2,'0')}-01`
    const last  = `${year}-${String(month+1).padStart(2,'0')}-${new Date(year,month+1,0).getDate()}`
    const { data: reservasMes } = await supabase.from('reservas').select('id, fecha').gte('fecha',first).lte('fecha',last)
    if (!reservasMes?.length) { setDiasConActividad(new Set()); return }
    const { data: conPilotos } = await supabase
      .from('reservas_personas').select('reserva_id')
      .in('reserva_id', reservasMes.map((r:any)=>r.id))
      .not('perfil_id','is',null)
    const idsConPilotos = new Set((conPilotos||[]).map((r:any)=>r.reserva_id))
    setDiasConActividad(new Set(
      reservasMes.filter((r:any)=>idsConPilotos.has(r.id)).map((r:any)=>r.fecha as string)
    ))
  }

  const fetchPilotosDelDia = async (date: string) => {
    const { data: reservasDelDia } = await supabase.from('reservas').select('id').eq('fecha', date)
    const reservaIds = (reservasDelDia||[]).map((r:any)=>r.id)
    if (!reservaIds.length) { setPilotos([]); return }

    const { data } = await supabase
      .from('reservas_personas')
      .select('reserva_id, perfil_id, perfiles(id, nombre)')
      .in('reserva_id', reservaIds)
      .not('perfil_id','is',null)

    if (!data) { setPilotos([]); setPilotoReservaIds({}); return }

    const map = new Map<string, PilotoResumen>()
    const reservaIdMap: Record<string, number[]> = {}
    data.forEach((row:any) => {
      const id = row.perfil_id
      const nombre = row.perfiles?.nombre || 'Sin nombre'
      map.has(id) ? map.get(id)!.vuelos++ : map.set(id, { perfil_id:id, nombre, vuelos:1 })
      if (!reservaIdMap[id]) reservaIdMap[id] = []
      if (!reservaIdMap[id].includes(row.reserva_id)) reservaIdMap[id].push(row.reserva_id)
    })
    setPilotoReservaIds(reservaIdMap)
    setPilotos(Array.from(map.values()).sort((a,b)=>b.vuelos-a.vuelos))
  }

  const fetchExistingServicios = async (perfilId: string, reservaIdList: number[]) => {
    if (!reservaIdList.length) return
    const { data } = await supabase
      .from('perfil_valores')
      .select('id, valor_id, cantidad, valores(id, servicio, monto)')
      .eq('perfil_id', perfilId)
      .in('reserva_id', reservaIdList)
    if (data?.length) {
      setServiciosSeleccionados(data.map((row:any) => ({
        id: row.valor_id, servicio: row.valores?.servicio||'', monto: row.valores?.monto||0, cantidad: row.cantidad
      })))
    }
  }

  const selectDate = async (day: number) => {
    const date = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    setSelectedDate(date)
    setExpandedPiloto(null); setServiciosSeleccionados([]); setShowServicioPicker(false)
    await fetchPilotosDelDia(date)
  }

  const changeMonth = (dir: 'prev'|'next') => {
    let m = currentMonth + (dir==='prev'?-1:1), y = currentYear
    if (m<0){m=11;y--} else if(m>11){m=0;y++}
    setCurrentMonth(m); setCurrentYear(y)
  }

  const togglePiloto = (perfilId: string) => {
    if (expandedPiloto === perfilId) {
      setExpandedPiloto(null); setServiciosSeleccionados([]); setShowServicioPicker(false)
    } else {
      setExpandedPiloto(perfilId); setServiciosSeleccionados([]); setShowServicioPicker(false)
      fetchExistingServicios(perfilId, pilotoReservaIds[perfilId]||[])
    }
  }

  const totalUsados = (prev: ServicioPiloto[]) => prev.reduce((s,x)=>s+x.cantidad,0)

  const addServicio = (valor: any) => {
    const maxVuelos = pilotos.find(p=>p.perfil_id===expandedPiloto)?.vuelos ?? 0
    setServiciosSeleccionados(prev => {
      if (totalUsados(prev) >= maxVuelos) return prev
      const ex = prev.find(s=>s.id===valor.id)
      if (ex) return prev.map(s=>s.id===valor.id?{...s,cantidad:s.cantidad+1}:s)
      return [...prev,{id:valor.id,servicio:valor.servicio,monto:valor.monto,cantidad:1}]
    })
    setShowServicioPicker(false)
  }

  const incrementServicio = (id: number) => {
    const maxVuelos = pilotos.find(p=>p.perfil_id===expandedPiloto)?.vuelos ?? 0
    setServiciosSeleccionados(prev => {
      if (totalUsados(prev) >= maxVuelos) return prev
      return prev.map(s=>s.id===id?{...s,cantidad:s.cantidad+1}:s)
    })
  }

  const removeServicio = (id: number) => {
    setServiciosSeleccionados(prev => {
      const item = prev.find(s=>s.id===id)
      if (!item) return prev
      if (item.cantidad<=1) return prev.filter(s=>s.id!==id)
      return prev.map(s=>s.id===id?{...s,cantidad:s.cantidad-1}:s)
    })
  }

  const guardarServicios = async () => {
    if (!expandedPiloto) return
    const reservaIdList = pilotoReservaIds[expandedPiloto]||[]
    if (!reservaIdList.length) return

    setSaving(true); setSavedMsg(null)
    const { error: delErr } = await supabase
      .from('perfil_valores').delete()
      .eq('perfil_id', expandedPiloto).in('reserva_id', reservaIdList)
    if (delErr) { setSaving(false); setSavedMsg('Error: '+delErr.message); return }

    if (serviciosSeleccionados.length > 0) {
      const rows = serviciosSeleccionados.map(s=>({
        perfil_id: expandedPiloto, valor_id:s.id, cantidad:s.cantidad, reserva_id:reservaIdList[0]
      }))
      const { error: insErr } = await supabase.from('perfil_valores').insert(rows)
      if (insErr) { setSaving(false); setSavedMsg('Error: '+insErr.message); return }
    }

    setSaving(false)
    setSavedMsg('Servicios guardados correctamente')
    setTimeout(() => { setExpandedPiloto(null); setServiciosSeleccionados([]); setSavedMsg(null) }, 1200)
  }

  const totalServicios = serviciosSeleccionados.reduce((s,x)=>s+x.monto*x.cantidad,0)

  // Calendario
  const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate()
  const firstWeekday = new Date(currentYear, currentMonth, 1).getDay()
  const weeks: (number|null)[][] = []
  let day = 1
  for (let w=0; w<6; w++) {
    const week: (number|null)[] = []
    for (let d=0; d<7; d++) {
      if ((w===0&&d<firstWeekday)||day>daysInMonth) week.push(null)
      else { week.push(day); day++ }
    }
    weeks.push(week)
    if (day>daysInMonth) break
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/" className="text-[#ffd700] text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">🪂 Pilotos</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">

        {/* Calendario */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={()=>changeMonth('prev')} className="p-2 text-[#2e6db4] text-xl hover:bg-gray-100 rounded-lg">‹</button>
            <span className="text-[#2e6db4] font-bold text-base">{MESES[currentMonth]} {currentYear}</span>
            <button onClick={()=>changeMonth('next')} className="p-2 text-[#2e6db4] text-xl hover:bg-gray-100 rounded-lg">›</button>
          </div>
          <div className="grid grid-cols-7 mb-2">
            {DIAS.map(d=><div key={d} className="text-center text-gray-400 text-xs py-1">{d}</div>)}
          </div>
          {weeks.map((week,wi)=>(
            <div key={wi} className="grid grid-cols-7 mb-1">
              {week.map((d,di)=>{
                if (!d) return <div key={di}/>
                const dateStr=`${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                const selected=dateStr===selectedDate
                const hasDot=diasConActividad.has(dateStr)
                return (
                  <div key={di} className="flex flex-col items-center">
                    <button onClick={()=>selectDate(d)}
                      className={`w-9 h-9 rounded-full text-sm font-medium transition-colors
                        ${selected?'bg-[#2e6db4] text-white font-bold':'text-gray-700 hover:bg-gray-100'}`}>
                      {d}
                    </button>
                    {hasDot&&<div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${selected?'bg-white':'bg-[#0d2b5c]'}`}/>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Fecha y ayuda */}
        <p className="text-[#2e6db4] font-bold text-sm mb-1">{selectedDate}</p>
        <p className="text-gray-400 text-xs mb-5">Toca un día para ver la actividad. Toca un piloto para registrar servicios.</p>

        {/* Lista pilotos */}
        {pilotos.length > 0 && (
          <p className="text-[#2e6db4] font-bold text-xs tracking-wider uppercase mb-3">
            {pilotos.length} piloto{pilotos.length>1?'s':''} activo{pilotos.length>1?'s':''}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {pilotos.map(piloto => {
            const expanded = expandedPiloto === piloto.perfil_id
            const maxVuelos = piloto.vuelos
            const usados = serviciosSeleccionados.reduce((s,x)=>s+x.cantidad,0)
            const limite = usados >= maxVuelos

            return (
              <div key={piloto.perfil_id}>
                {/* Tarjeta piloto */}
                <button
                  onClick={()=>togglePiloto(piloto.perfil_id)}
                  className={`w-full flex items-center justify-between p-4 border-l-4 border-[#2e6db4] shadow-sm transition-colors text-left
                    ${expanded
                      ? 'bg-[#2e6db4] rounded-t-xl rounded-b-none'
                      : 'bg-white rounded-xl hover:bg-[#f0f7ff]'}`}
                >
                  <div>
                    <p className={`font-bold text-base ${expanded?'text-white':'text-[#0d2b5c]'}`}>{piloto.nombre}</p>
                    <p className={`text-xs mt-0.5 ${expanded?'text-[#c8ddf5]':'text-gray-400'}`}>
                      {expanded?'Toca para cerrar':'Toca para registrar servicios'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`rounded-2xl px-3 py-1.5 text-center ${expanded?'bg-white/20':'bg-[#2e6db4]'}`}>
                      <p className="text-white font-extrabold text-lg leading-none">×{piloto.vuelos}</p>
                      <p className={`text-xs ${expanded?'text-blue-100':'text-[#c8ddf5]'}`}>vuelo{piloto.vuelos>1?'s':''}</p>
                    </div>
                    <span className={`text-lg ${expanded?'text-white':'text-[#2e6db4]'}`}>{expanded?'▲':'▼'}</span>
                  </div>
                </button>

                {/* Panel servicios */}
                {expanded && (
                  <div className="bg-[#f0f6ff] border border-t-0 border-[#2e6db4] rounded-b-xl p-4">

                    {/* Contador vuelos */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[#2e6db4] font-bold text-sm">Servicios del piloto</p>
                      <span className={`text-xs font-bold text-white px-3 py-1 rounded-full ${limite?'bg-red-500':'bg-[#2e6db4]'}`}>
                        {usados}/{maxVuelos} vuelos
                      </span>
                    </div>

                    {savedMsg && (
                      <div className={`mb-3 p-2 rounded-lg text-sm text-center font-semibold ${savedMsg.startsWith('Error')?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                        {savedMsg}
                      </div>
                    )}

                    {/* Picker */}
                    {!limite ? (
                      <div className="relative mb-3">
                        <button type="button" onClick={()=>setShowServicioPicker(!showServicioPicker)}
                          className="w-full bg-white border border-[#2e6db4] rounded-lg p-3 text-sm text-[#2e6db4] font-semibold text-left hover:bg-blue-50">
                          {valoresPiloto.length===0 ? 'No hay servicios de piloto cargados' : '+ Agregar servicio...'}
                        </button>
                        {showServicioPicker && valoresPiloto.length>0 && (
                          <div className="absolute z-10 w-full bg-white border border-[#2e6db4] rounded-lg mt-1 shadow-lg overflow-hidden">
                            {valoresPiloto.map(v=>(
                              <button key={v.id} type="button" onClick={()=>addServicio(v)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 border-gray-100">
                                <p className="font-bold text-[#0d2b5c] text-sm">{v.servicio}</p>
                                <p className="text-gray-500 text-xs">{fmtCLP(v.monto)}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#fff3cd] rounded-lg p-2 mb-3 text-center">
                        <p className="text-[#856404] text-sm">Límite alcanzado ({maxVuelos} vuelo{maxVuelos>1?'s':''})</p>
                      </div>
                    )}

                    {/* Servicios seleccionados */}
                    {serviciosSeleccionados.length > 0 ? (
                      <div className="flex flex-col gap-2 mb-3">
                        {serviciosSeleccionados.map(s=>(
                          <div key={s.id} className="bg-white border border-[#d4e6f5] rounded-lg p-3 flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-[#0d2b5c] text-sm">{s.servicio}</p>
                              <p className="text-gray-500 text-xs">{fmtCLP(s.monto)} c/u</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={()=>removeServicio(s.id)}
                                className="w-7 h-7 rounded-full bg-[#ffe5e5] text-red-600 font-bold text-base hover:bg-red-100 flex items-center justify-center">−</button>
                              <span className="font-extrabold text-[#2e6db4] w-7 text-center">×{s.cantidad}</span>
                              <button onClick={()=>incrementServicio(s.id)} disabled={limite}
                                className={`w-7 h-7 rounded-full font-bold text-base flex items-center justify-center text-white
                                  ${limite?'bg-gray-300 cursor-not-allowed':'bg-[#2e6db4] hover:bg-[#255d9a]'}`}>+</button>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-2 border-t border-[#d4e6f5]">
                          <span className="font-bold text-[#0d2b5c] text-sm">Total</span>
                          <span className="font-extrabold text-[#2e6db4] text-base">{fmtCLP(totalServicios)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm text-center py-4">Agrega servicios para este piloto</p>
                    )}

                    <button onClick={guardarServicios} disabled={saving}
                      className="w-full bg-[#0d2b5c] text-white font-bold py-3 rounded-xl hover:bg-[#0a2247] transition-colors disabled:opacity-60">
                      {saving ? 'Guardando...' : 'Guardar servicios'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {pilotos.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center">
              <p className="text-5xl mb-3">🪂</p>
              <p className="text-gray-400 text-sm">Sin vuelos registrados para este día.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
