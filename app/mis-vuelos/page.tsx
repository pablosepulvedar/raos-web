'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { May, useJerga } from '@/lib/jerga'
import { createClient } from '@/lib/supabase-browser'
import Cargando from '@/components/Cargando'
import InputMonto from '@/components/InputMonto'
import Volver from '@/components/Volver'
import Rango, { mesActual, type Periodo } from '../reporte/Rango'

// La bitácora de cada quien: los vuelos que le asignó el sistema más los que hizo
// por fuera. No la ve nadie más, por eso se pide entera y se filtra acá.
type Vuelo = {
  origen: 'interno' | 'externo'
  id: number
  fecha: string
  empresa: string
  pasajero: string | null
  camara: string | null
  valor: number | null
  minutos: number
}

const CAMARAS = [
  { valor: 'sin',    texto: 'Sin cámara' },
  { valor: 'normal', texto: 'Cámara normal' },
  { valor: '360',    texto: 'Cámara 360°' },
]
const textoCamara = (c: string | null) => CAMARAS.find(x => x.valor === c)?.texto ?? 'Sin cámara'

const OTRA = '__otra__'
const hoyStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const fmtDia = (f: string) =>
  new Date(f + 'T12:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fmtCLP = (v: number) => `$${v.toLocaleString('es-CL')}`

// 95 minutos se leen mejor como 1 h 35 min
const enHoras = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

export default function MisVuelos() {
  const j = useJerga()
  const sb = useRef(createClient()).current

  const [vuelos, setVuelos] = useState<Vuelo[] | null>(null)
  const [misEmpresas, setMisEmpresas] = useState<string[]>([])
  const [periodo, setPeriodo] = useState<Periodo>(mesActual)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formulario del vuelo de fuera
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoyStr)
  const [empresaElegida, setEmpresaElegida] = useState('')
  const [empresaNueva, setEmpresaNueva] = useState('')
  const [pasajero, setPasajero] = useState('')
  const [camara, setCamara] = useState('sin')
  const [valor, setValor] = useState('')
  const [minutos, setMinutos] = useState('')

  const cargar = async () => {
    const [bita, mias] = await Promise.all([
      sb.rpc('mi_bitacora'),
      sb.rpc('mis_empresas'),
    ])
    setVuelos((bita.data as Vuelo[]) ?? [])
    setMisEmpresas(((mias.data as { nombre: string }[]) ?? []).map(e => e.nombre))
  }
  useEffect(() => { cargar() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // Las que ya usó antes se ofrecen igual que las suyas: no hay que escribirlas de nuevo
  const empresas = useMemo(() => {
    const usadas = (vuelos ?? []).map(v => v.empresa)
    return [...new Set([...misEmpresas, ...usadas])].sort((a, b) => a.localeCompare(b, 'es'))
  }, [vuelos, misEmpresas])

  const enRango = useMemo(
    () => (vuelos ?? []).filter(v => v.fecha >= periodo.desde && v.fecha <= periodo.hasta),
    [vuelos, periodo])

  const totalRango = useMemo(() => enRango.reduce((s, v) => s + v.minutos, 0), [enRango])
  const totalTodo  = useMemo(() => (vuelos ?? []).reduce((s, v) => s + v.minutos, 0), [vuelos])

  const porFecha = useMemo(() => {
    const m = new Map<string, Vuelo[]>()
    for (const v of enRango) m.set(v.fecha, [...(m.get(v.fecha) ?? []), v])
    return [...m.entries()]
  }, [enRango])

  const cambiarMinutos = async (v: Vuelo) => {
    const texto = prompt(`¿Cuántos minutos duró este ${j.actividad}?`, String(v.minutos))
    if (texto === null) return
    const n = Number(texto.trim())
    if (!Number.isInteger(n) || n < 1 || n > 1440) { setError('Los minutos van entre 1 y 1440'); return }
    setError(null)
    const { error } = v.origen === 'interno'
      ? await sb.rpc('fijar_minutos', { p_persona: v.id, p_minutos: n })
      : await sb.from('vuelos_externos').update({ minutos: n }).eq('id', v.id)
    if (error) { setError('No se pudo guardar: ' + error.message); return }
    setVuelos(vs => (vs ?? []).map(x => x.origen === v.origen && x.id === v.id ? { ...x, minutos: n } : x))
  }

  const borrarExterno = async (v: Vuelo) => {
    if (!confirm(`¿Borrar el ${j.actividad} de ${v.fecha} en ${v.empresa}?`)) return
    const { error } = await sb.from('vuelos_externos').delete().eq('id', v.id)
    if (error) { setError('No se pudo borrar: ' + error.message); return }
    setVuelos(vs => (vs ?? []).filter(x => !(x.origen === 'externo' && x.id === v.id)))
  }

  const agregar = async () => {
    const empresa = (empresaElegida === OTRA ? empresaNueva : empresaElegida).trim()
    if (!empresa) { setError('Falta la empresa'); return }
    const min = minutos.trim() ? Number(minutos.trim()) : null
    if (min !== null && (!Number.isInteger(min) || min < 1 || min > 1440)) {
      setError('Los minutos van entre 1 y 1440'); return
    }
    setError(null); setGuardando(true)
    const { error } = await sb.from('vuelos_externos').insert({
      fecha, empresa, pasajero: pasajero.trim() || null, camara,
      valor: valor ? Number(valor) : null, minutos: min,
    })
    setGuardando(false)
    if (error) { setError('No se pudo guardar: ' + error.message); return }
    setAbierto(false); setPasajero(''); setValor(''); setMinutos(''); setEmpresaNueva('')
    // El rango tiene que incluir la fecha recién cargada o el vuelo "desaparece"
    if (fecha < periodo.desde || fecha > periodo.hasta) {
      setPeriodo(p => ({ desde: fecha < p.desde ? fecha : p.desde, hasta: fecha > p.hasta ? fecha : p.hasta }))
    }
    await cargar()
  }

  return (
    <div className="flex-1" style={{ background: 'linear-gradient(160deg, #e8f2ff 0%, #d0e6ff 100%)' }}>
      <header style={{ background: 'linear-gradient(135deg, #0d2b5c 0%, #1a4a85 100%)' }} className="px-5 py-5 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Volver href="/" />
          <div>
            <h1 className="text-white text-lg font-extrabold">Mi bitácora</h1>
            <p className="text-[#7aafd4] text-xs">Tus {j.actividad_plural} y tus horas</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-5 flex flex-col gap-4">
        <Rango valor={periodo} onCambiar={setPeriodo} />

        <div className="bg-white rounded-2xl p-4 shadow-sm flex gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{May(j.actividad_plural)}</p>
            <p className="text-2xl font-extrabold text-[#0d2b5c]">{enRango.length}</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Horas</p>
            <p className="text-2xl font-extrabold text-[#0d2b5c]">{enHoras(totalRango)}</p>
          </div>
        </div>
        {vuelos !== null && (
          <p className="text-xs text-[#2e6db4] -mt-2 px-1">
            En total, desde siempre: <b>{vuelos.length} {j.actividad_plural}</b> · <b>{enHoras(totalTodo)}</b>
          </p>
        )}

        {error && <p className="bg-[#ffeef0] text-[#c0392b] text-sm rounded-xl px-4 py-2">{error}</p>}

        {!abierto && (
          <button onClick={() => setAbierto(true)}
            className="bg-[#1a4a85] text-white font-bold py-3 rounded-2xl text-sm hover:opacity-95">
            + Agregar un {j.actividad} de otra empresa
          </button>
        )}

        {abierto && (
          <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <p className="text-sm font-bold text-[#0d2b5c]">{May(j.actividad)} de otra empresa</p>

            <label className="text-xs text-gray-500 font-semibold">Fecha
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
            </label>

            <label className="text-xs text-gray-500 font-semibold">Empresa
              <select value={empresaElegida} onChange={e => setEmpresaElegida(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white">
                <option value="">Elige una…</option>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                <option value={OTRA}>Otra…</option>
              </select>
            </label>
            {empresaElegida === OTRA && (
              <input value={empresaNueva} onChange={e => setEmpresaNueva(e.target.value)}
                placeholder="Nombre de la empresa"
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
            )}

            <label className="text-xs text-gray-500 font-semibold">{May(j.cliente)} (opcional)
              <input value={pasajero} onChange={e => setPasajero(e.target.value)} placeholder="Nombre"
                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
            </label>

            <label className="text-xs text-gray-500 font-semibold">Cámara
              <select value={camara} onChange={e => setCamara(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white">
                {CAMARAS.map(c => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
              </select>
            </label>

            <div className="flex gap-3">
              <label className="flex-1 text-xs text-gray-500 font-semibold">Valor (opcional)
                <InputMonto value={valor} onChange={setValor} placeholder="$"
                  className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
              </label>
              <label className="flex-1 text-xs text-gray-500 font-semibold">Minutos
                <input value={minutos} onChange={e => setMinutos(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric" placeholder="10"
                  className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setAbierto(false); setError(null) }}
                className="flex-1 bg-[#eef4fb] text-[#1a4a85] font-bold py-2.5 rounded-xl text-sm">Cancelar</button>
              <button onClick={agregar} disabled={guardando}
                className="flex-1 bg-[#1a4a85] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {vuelos === null && <Cargando />}
        {vuelos !== null && !porFecha.length && (
          <p className="text-sm text-gray-500 text-center py-6">
            No hay {j.actividad_plural} en estas fechas.
          </p>
        )}

        {porFecha.map(([dia, delDia]) => (
          <div key={dia} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-[#eef4fb] px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#1a4a85] uppercase">{fmtDia(dia)}</span>
              <span className="text-xs text-[#2e6db4]">
                {delDia.length} · {enHoras(delDia.reduce((s, v) => s + v.minutos, 0))}
              </span>
            </div>
            {delDia.map(v => (
              <div key={v.origen + v.id} className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#0d2b5c] truncate">
                    {v.pasajero || `Sin ${j.cliente}`}
                    {v.origen === 'externo' && <span className="ml-2 text-[10px] font-bold text-[#b45309] bg-[#fde68a] rounded px-1.5 py-0.5">fuera</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {v.empresa} · {textoCamara(v.camara)}
                    {v.valor ? ` · ${fmtCLP(v.valor)}` : ''}
                  </p>
                </div>
                <button onClick={() => cambiarMinutos(v)}
                  className="shrink-0 text-xs font-bold text-[#1a4a85] bg-[#eef4fb] rounded-xl px-3 py-2 hover:bg-[#dbe8f7]">
                  {v.minutos} min
                </button>
                {v.origen === 'externo' && (
                  <button onClick={() => borrarExterno(v)} aria-label="Borrar"
                    className="shrink-0 w-9 h-9 rounded-full text-[#c0392b] bg-[#ffeef0] hover:opacity-80">✕</button>
                )}
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  )
}
