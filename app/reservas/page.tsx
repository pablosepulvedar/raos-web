'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type Horario = { id: number; horario: number }
type Valor = { id: number; servicio: string; monto: number }
type Reserva = { id: number; nombre: string; telefono: number; fecha: string; horario_id: number; cantidad: number }
type ServicioSel = { id: number; servicio: string; monto: number; cantidad: number }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const fmtHorario = (v: number) => { const s = String(v).padStart(4,'0'); return `${s.slice(0,2)}:${s.slice(2)}` }
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`
const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

export default function Reservas() {
  const router = useRouter()
  const today = toDateStr(new Date())

  const [selectedDate, setSelectedDate] = useState(today)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [diasConReservas, setDiasConReservas] = useState<Set<string>>(new Set())
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [valores, setValores] = useState<Valor[]>([])

  // Formulario
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [selectedHorarioId, setSelectedHorarioId] = useState<number | null>(null)
  const [showHorarioPicker, setShowHorarioPicker] = useState(false)
  const [cantidad, setCantidad] = useState('')
  const [selectedServicios, setSelectedServicios] = useState<ServicioSel[]>([])
  const [showServicioPicker, setShowServicioPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHorarios()
    fetchValores()
    fetchReservas(today)
    fetchDiasConReservas(new Date().getFullYear(), new Date().getMonth())
  }, [])

  useEffect(() => { fetchDiasConReservas(currentYear, currentMonth) }, [currentMonth, currentYear])

  const fetchDiasConReservas = async (year: number, month: number) => {
    const first = `${year}-${String(month+1).padStart(2,'0')}-01`
    const last  = `${year}-${String(month+1).padStart(2,'0')}-${new Date(year,month+1,0).getDate()}`
    const { data } = await supabase.from('reservas').select('fecha').gte('fecha',first).lte('fecha',last)
    setDiasConReservas(new Set((data||[]).map((r:any)=>r.fecha)))
  }

  const fetchReservas = async (date: string) => {
    const { data } = await supabase.from('reservas').select('*').eq('fecha',date).order('horario_id')
    setReservas((data||[]) as Reserva[])
  }

  const fetchHorarios = async () => {
    const { data } = await supabase.from('horarios').select('*').order('horario')
    setHorarios((data||[]) as Horario[])
  }

  const fetchValores = async () => {
    const { data } = await supabase.from('valores').select('*').order('servicio')
    setValores((data||[]) as Valor[])
  }

  const selectDate = (day: number) => {
    const date = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    setSelectedDate(date)
    fetchReservas(date)
  }

  const changeMonth = (dir: 'prev'|'next') => {
    let m = currentMonth + (dir === 'prev' ? -1 : 1)
    let y = currentYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setCurrentMonth(m); setCurrentYear(y)
  }

  const addServicio = (v: Valor) => {
    setSelectedServicios(prev => {
      const ex = prev.find(s => s.id === v.id)
      if (ex) return prev.map(s => s.id === v.id ? {...s, cantidad: s.cantidad+1} : s)
      return [...prev, {id:v.id, servicio:v.servicio, monto:v.monto, cantidad:1}]
    })
    setShowServicioPicker(false)
  }

  const removeServicio = (id: number) => {
    setSelectedServicios(prev => {
      const item = prev.find(s => s.id === id)
      if (!item) return prev
      if (item.cantidad <= 1) return prev.filter(s => s.id !== id)
      return prev.map(s => s.id === id ? {...s, cantidad:s.cantidad-1} : s)
    })
  }

  const resetForm = () => {
    setNombre(''); setTelefono(''); setSelectedHorarioId(null)
    setSelectedServicios([]); setCantidad(''); setShowForm(false)
    setShowHorarioPicker(false); setShowServicioPicker(false); setError(null)
  }

  const crearReserva = async () => {
    setError(null)
    const tel = Number(telefono.replace(/[^0-9]/g,''))
    const totalServ = selectedServicios.reduce((s,i)=>s+i.cantidad,0)
    if (!nombre || !telefono || !selectedHorarioId || !cantidad || totalServ === 0)
      return setError('Completa todos los campos y agrega al menos un servicio')
    if (isNaN(tel)) return setError('El teléfono debe contener solo números')

    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('reservas')
        .insert({ nombre:nombre.trim(), telefono:tel, fecha:selectedDate, horario_id:selectedHorarioId, cantidad:parseInt(cantidad,10) })
        .select('id').single()
      if (err || !data) throw err || new Error('No se pudo crear la reserva')

      const servicios: {reserva_id:number; valor_id:number}[] = []
      selectedServicios.forEach(item => {
        for (let i=0; i<item.cantidad; i++) servicios.push({reserva_id:data.id, valor_id:item.id})
      })
      const { error: sErr } = await supabase.from('reserva_servicios').insert(servicios)
      if (sErr) throw sErr

      resetForm()
      await fetchReservas(selectedDate)
      await fetchDiasConReservas(currentYear, currentMonth)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear la reserva')
    } finally {
      setLoading(false)
    }
  }

  // Calendario
  const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate()
  const firstWeekday = new Date(currentYear, currentMonth, 1).getDay()
  const weeks: (number|null)[][] = []
  let day = 1
  for (let w=0; w<6; w++) {
    const week: (number|null)[] = []
    for (let d=0; d<7; d++) {
      if ((w===0 && d<firstWeekday) || day>daysInMonth) week.push(null)
      else { week.push(day); day++ }
    }
    weeks.push(week)
    if (day > daysInMonth) break
  }

  const horarioLabel = (id: number|null) => {
    if (!id) return '---'
    const h = horarios.find(h => h.id === id)
    return h ? fmtHorario(h.horario) : '---'
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header amarillo */}
      <header className="bg-[#ffd700] px-5 py-5 flex items-center gap-4">
        <Link href="/" className="text-[#1e5a96] text-lg font-semibold hover:opacity-70">← Volver</Link>
        <h1 className="text-[#1e5a96] text-xl font-bold flex-1 text-center">📅 Reservas</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">

        {/* Calendario */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth('prev')} className="p-2 text-[#1e5a96] text-xl hover:bg-gray-100 rounded-lg">‹</button>
            <span className="text-[#1e5a96] font-bold text-base">{MESES[currentMonth]} {currentYear}</span>
            <button onClick={() => changeMonth('next')} className="p-2 text-[#1e5a96] text-xl hover:bg-gray-100 rounded-lg">›</button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DIAS.map(d => <div key={d} className="text-center text-gray-400 text-xs py-1">{d}</div>)}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 mb-1">
              {week.map((d, di) => {
                if (!d) return <div key={di} />
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                const selected = dateStr === selectedDate
                const hasDot = diasConReservas.has(dateStr)
                return (
                  <div key={di} className="flex flex-col items-center">
                    <button
                      onClick={() => selectDate(d)}
                      className={`w-9 h-9 rounded-full text-sm font-medium transition-colors
                        ${selected ? 'bg-[#1e5a96] text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {d}
                    </button>
                    {hasDot && (
                      <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${selected ? 'bg-white' : 'bg-[#0d2b5c]'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Fecha seleccionada */}
        <p className="text-[#1e5a96] font-bold text-sm mb-1">Seleccionado: {selectedDate}</p>
        <p className="text-gray-500 text-xs mb-4">Toca un día para ver las reservas de esa fecha.</p>

        {/* Botón nueva reserva */}
        <button
          onClick={() => showForm ? resetForm() : setShowForm(true)}
          className="w-full bg-[#1e5a96] text-white font-semibold py-3 rounded-xl mb-4 hover:bg-[#174a82] transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Nueva Reserva'}
        </button>

        {/* Formulario */}
        {showForm && (
          <div className="bg-[#fff3cd] rounded-2xl p-5 mb-5 border border-[#ffd700]">
            <p className="text-[#1e5a96] font-bold text-base mb-4">Nueva Reserva — {selectedDate}</p>

            {error && (
              <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm">{error}</div>
            )}

            <input
              className="w-full border border-[#ffd700] rounded-lg p-3 text-sm mb-3 bg-white"
              placeholder="Nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
            <input
              className="w-full border border-[#ffd700] rounded-lg p-3 text-sm mb-3 bg-white"
              placeholder="Teléfono"
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value.replace(/[^0-9]/g,''))}
            />

            {/* Horario picker */}
            <div className="relative mb-3">
              <button
                type="button"
                onClick={() => setShowHorarioPicker(!showHorarioPicker)}
                className="w-full border border-[#ffd700] rounded-lg p-3 text-sm bg-white text-left"
              >
                {selectedHorarioId ? horarioLabel(selectedHorarioId) : <span className="text-gray-400">Selecciona un horario</span>}
              </button>
              {showHorarioPicker && (
                <div className="absolute z-10 w-full bg-white border border-[#ffd700] rounded-lg mt-1 shadow-lg overflow-hidden">
                  {horarios.length === 0
                    ? <p className="p-3 text-gray-400 text-sm">No hay horarios. Agrégalos en Varios → Horarios.</p>
                    : horarios.map(h => (
                      <button key={h.id} type="button"
                        onClick={() => { setSelectedHorarioId(h.id); setShowHorarioPicker(false) }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-yellow-50 border-b last:border-b-0 border-gray-100"
                      >
                        {fmtHorario(h.horario)}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Servicios */}
            <div className="mb-3">
              <p className="text-[#1e5a96] font-bold text-sm mb-1">Servicios</p>
              <div className="relative mb-2">
                <button
                  type="button"
                  onClick={() => setShowServicioPicker(!showServicioPicker)}
                  className="w-full border border-[#ffd700] rounded-lg p-3 text-sm bg-white text-left text-gray-500"
                >
                  Seleccionar servicio...
                </button>
                {showServicioPicker && valores.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-[#ffd700] rounded-lg mt-1 shadow-lg overflow-hidden">
                    {valores.map(v => (
                      <button key={v.id} type="button"
                        onClick={() => addServicio(v)}
                        className="w-full text-left px-4 py-3 hover:bg-yellow-50 border-b last:border-b-0 border-gray-100"
                      >
                        <p className="text-sm font-semibold text-gray-800">{v.servicio}</p>
                        <p className="text-xs text-gray-500">{fmtCLP(v.monto)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="min-h-12 border border-[#ffd700] rounded-lg p-3 bg-white flex flex-wrap gap-2">
                {selectedServicios.length === 0
                  ? <span className="text-gray-400 text-sm">Los servicios seleccionados aparecerán aquí</span>
                  : selectedServicios.map(item => (
                    <span key={item.id} className="flex items-center gap-1 bg-[#e8f7ff] text-[#1e5a96] text-sm font-semibold px-3 py-1 rounded-full">
                      {item.servicio}{item.cantidad > 1 ? ` ×${item.cantidad}` : ''} · {fmtCLP(item.monto)}
                      <button type="button" onClick={() => removeServicio(item.id)} className="text-red-600 font-bold ml-1">×</button>
                    </span>
                  ))
                }
              </div>
            </div>

            <input
              className="w-full border border-[#ffd700] rounded-lg p-3 text-sm mb-4 bg-white"
              placeholder="Cantidad de personas"
              type="number"
              min="1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
            />

            <button
              onClick={crearReserva}
              disabled={loading}
              className="w-full bg-[#ffd700] text-[#1e5a96] font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-60"
            >
              {loading ? 'Creando...' : 'Crear Reserva'}
            </button>
          </div>
        )}

        {/* Lista reservas */}
        <p className="text-[#1e5a96] font-bold text-sm mb-3">
          {reservas.length} {reservas.length === 1 ? 'reserva' : 'reservas'} para {selectedDate}
        </p>

        <div className="flex flex-col gap-3">
          {reservas.map(r => (
            <button
              key={r.id}
              onClick={() => router.push(`/reserva/${r.id}`)}
              className="bg-white rounded-xl p-4 border-l-4 border-[#ffd700] shadow-sm text-left hover:shadow-md transition-shadow w-full"
            >
              <p className="text-[#1e5a96] font-bold text-base">{r.nombre || 'Reserva'}</p>
              <p className="text-gray-500 text-xs mt-1">
                📞 {r.telefono ?? '---'} · ⏰ {horarioLabel(r.horario_id)}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">👥 {r.cantidad} personas</p>
            </button>
          ))}

          {reservas.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm">No hay reservas para esta fecha.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
