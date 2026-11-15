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
  ref: number          // con qué se guarda: persona_id si es del sistema, id de la fila si es de fuera
  fecha: string
  empresa: string
  pasajero: string | null
  camara: string | null
  valor: number | null
  minutos: number
  sitio: string | null
  vela: string | null   // queda en la base: la pondra la configuracion del perfil, no este formulario
  tipo: string
  nota: string | null
}

const CAMARAS = [
  { valor: 'sin',    texto: 'Sin cámara' },
  { valor: 'normal', texto: 'Cámara normal' },
  { valor: '360',    texto: 'Cámara 360°' },
]
const TIPOS = [
  { valor: 'biplaza',     texto: 'Biplaza' },
  { valor: 'solo',        texto: 'Solo' },
  { valor: 'instruccion', texto: 'Instrucción' },
]
const textoDe = (lista: { valor: string; texto: string }[], v: string | null, porDefecto = '') =>
  lista.find(x => x.valor === v)?.texto ?? porDefecto

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

type Form = {
  fecha: string; empresa: string; empresaNueva: string; pasajero: string; camara: string
  valor: string; minutos: string; sitio: string; vela: string; tipo: string; nota: string
}
const FORM_VACIO: Form = {
  fecha: '', empresa: '', empresaNueva: '', pasajero: '', camara: 'sin',
  valor: '', minutos: '', sitio: '', vela: '', tipo: 'biplaza', nota: '',
}
const campo = 'w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800'
const etiqueta = 'text-xs text-gray-500 font-semibold'

export default function MisVuelos() {
  const j = useJerga()
  const sb = useRef(createClient()).current

  const [vuelos, setVuelos] = useState<Vuelo[] | null>(null)
  const [empresas, setEmpresas] = useState<string[]>([])
  const [velas, setVelas] = useState<{ label: string; tipo: string | null; principal: boolean }[]>([])
  const [periodo, setPeriodo] = useState<Periodo>(mesActual)
  const [guardando, setGuardando] = useState(false)
  const [verResumen, setVerResumen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Qué se está editando: un vuelo de la lista, 'nuevo', o nada
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(FORM_VACIO)
  const set = (k: keyof Form) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const cargar = async () => {
    const [bita, emps, vls] = await Promise.all([
      sb.rpc('mi_bitacora'),
      sb.rpc('nombres_de_empresas'),
      sb.from('mis_velas').select('nombre, anio, tipo, principal').order('nombre'),   // las suyas, de Mi cuenta
    ])
    setVuelos((bita.data as Vuelo[]) ?? [])
    setEmpresas(((emps.data as { nombre: string }[]) ?? []).map(e => e.nombre))
    // Se anota con el año: el mismo modelo cambia de un año a otro
    setVelas(((vls.data as { nombre: string; anio: number | null; tipo: string | null; principal: boolean }[]) ?? [])
      .map(v => ({ label: v.anio ? `${v.nombre} ${v.anio}` : v.nombre, tipo: v.tipo, principal: v.principal })))
  }
  useEffect(() => { cargar() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // Las empresas inscritas más las que ya escribió a mano
  const paraElegir = useMemo(() => {
    const usadas = (vuelos ?? []).map(v => v.empresa)
    return [...new Set([...empresas, ...usadas])].sort((a, b) => a.localeCompare(b, 'es'))
  }, [vuelos, empresas])

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

  const clave = (v: Vuelo) => `${v.origen}-${v.ref}`

  // Por año, por vela, por empresa y por tipo: lo que se le pregunta a un libro de vuelo
  const resumen = useMemo(() => {
    const juntar = (de: (v: Vuelo) => string) => {
      const m = new Map<string, [number, number]>()
      for (const v of vuelos ?? []) {
        const k = de(v)
        const [n, min] = m.get(k) ?? [0, 0]
        m.set(k, [n + 1, min + v.minutos])
      }
      return [...m.entries()].map(([k, [n, min]]) => [k, n, min] as [string, number, number])
    }
    const porMinutos = (a: [string, number, number], b: [string, number, number]) => b[2] - a[2]
    return [
      ['Por año', juntar(v => v.fecha.slice(0, 4)).sort((a, b) => b[0].localeCompare(a[0]))],
      ['Por vela', juntar(v => v.vela ?? 'Sin vela anotada').sort(porMinutos)],
      ['Por empresa', juntar(v => v.empresa || 'Sin empresa').sort(porMinutos)],
      ['Por tipo', juntar(v => TIPOS.find(t => t.valor === v.tipo)?.texto ?? v.tipo).sort(porMinutos)],
    ] as [string, [string, number, number][]][]
  }, [vuelos])

  // Con ?nuevo (el boton de Pilotos) abre derecho el formulario del vuelo de fuera
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('nuevo')) abrirNuevo()
  }, [])

  // La que usa siempre para ese tipo de vuelo: así la salida entra con su vela puesta
  const laDeSiempre = (tipo: string) =>
    velas.find(v => v.principal && v.tipo === (tipo === 'solo' ? 'monoplaza' : 'biplaza'))?.label ?? ''

  const abrirNuevo = () => {
    setError(null)
    setForm({ ...FORM_VACIO, fecha: hoyStr(), vela: laDeSiempre('biplaza') })
    setEditando('nuevo')
  }
  const abrirVuelo = (v: Vuelo) => {
    setError(null)
    setForm({
      fecha: v.fecha, empresa: v.empresa, empresaNueva: '', pasajero: v.pasajero ?? '',
      camara: v.camara ?? 'sin', valor: v.valor ? String(v.valor) : '',
      minutos: String(v.minutos), sitio: v.sitio ?? '', vela: v.vela ?? '',
      tipo: v.tipo, nota: v.nota ?? '',
    })
    setEditando(clave(v))
  }

  // Lo que anota el guía: va igual en los dos casos
  const deLaBitacora = () => ({
    minutos: form.minutos.trim() ? Number(form.minutos) : null,
    sitio: form.sitio.trim() || null,
    vela: form.vela || null,
    tipo: form.tipo,
    nota: form.nota.trim() || null,
  })

  const guardar = async (v: Vuelo | null) => {
    const min = form.minutos.trim() ? Number(form.minutos) : null
    if (min !== null && (!Number.isInteger(min) || min < 1 || min > 1440)) {
      setError('Los minutos van entre 1 y 1440'); return
    }
    const empresa = (form.empresa === OTRA ? form.empresaNueva : form.empresa).trim()
    if (v?.origen !== 'interno' && !empresa) { setError('Falta la empresa'); return }

    setError(null); setGuardando(true)
    const deFuera = {
      fecha: form.fecha, empresa, pasajero: form.pasajero.trim() || null,
      camara: form.camara, valor: form.valor ? Number(form.valor) : null,
      ...deLaBitacora(),
    }
    const { error } =
      v?.origen === 'interno'
        // El vuelo ya existe en el sistema: esto es solo la anotación del guía
        ? await sb.from('mis_vuelos').upsert({ persona_id: v.ref, ...deLaBitacora() }, { onConflict: 'persona_id' })
        : v
          ? await sb.from('mis_vuelos').update(deFuera).eq('id', v.ref)
          : await sb.from('mis_vuelos').insert(deFuera)
    setGuardando(false)
    if (error) { setError('No se pudo guardar: ' + error.message); return }

    // Si el vuelo quedó fuera del rango a la vista, "desaparecería" sin explicación
    const f = v?.origen === 'interno' ? v.fecha : form.fecha
    if (f < periodo.desde || f > periodo.hasta) {
      setPeriodo(p => ({ desde: f < p.desde ? f : p.desde, hasta: f > p.hasta ? f : p.hasta }))
    }
    setEditando(null)
    await cargar()
  }

  const borrar = async (v: Vuelo) => {
    if (!confirm(`¿Borrar el ${j.actividad} del ${fmtDia(v.fecha)} en ${v.empresa}?`)) return
    const { error } = await sb.from('mis_vuelos').delete().eq('id', v.ref)
    if (error) { setError('No se pudo borrar: ' + error.message); return }
    setEditando(null)
    await cargar()
  }

  const formulario = (v: Vuelo | null) => (
    <div className="px-4 py-3 bg-[#f7fbff] border-t border-gray-100 flex flex-col gap-3">
      {v?.origen !== 'interno' && (
        <>
          <label className={etiqueta}>Fecha
            <input type="date" value={form.fecha} onChange={e => set('fecha')(e.target.value)} className={campo} />
          </label>
          <label className={etiqueta}>Empresa
            <select value={form.empresa} onChange={e => set('empresa')(e.target.value)} className={campo + ' bg-white'}>
              <option value="">Elige una…</option>
              {paraElegir.map(e => <option key={e} value={e}>{e}</option>)}
              <option value={OTRA}>Otra…</option>
            </select>
          </label>
          {form.empresa === OTRA && (
            <input value={form.empresaNueva} onChange={e => set('empresaNueva')(e.target.value)}
              placeholder="Nombre de la empresa" className={campo} />
          )}
          <label className={etiqueta}>{May(j.cliente)}
            <input value={form.pasajero} onChange={e => set('pasajero')(e.target.value)}
              placeholder="Nombre" className={campo} />
          </label>
          <div className="flex gap-3">
            <label className={etiqueta + ' flex-1'}>Cámara
              <select value={form.camara} onChange={e => set('camara')(e.target.value)} className={campo + ' bg-white'}>
                {CAMARAS.map(c => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
              </select>
            </label>
            <label className={etiqueta + ' flex-1'}>Valor
              <InputMonto value={form.valor} onChange={set('valor')} placeholder="$" className={campo} />
            </label>
          </div>
        </>
      )}

      <div className="flex gap-3">
        <label className={etiqueta + ' flex-1'}>Minutos
          <input value={form.minutos} onChange={e => set('minutos')(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric" placeholder="10" className={campo} />
        </label>
        <label className={etiqueta + ' flex-1'}>Tipo
          <select value={form.tipo} onChange={e => set('tipo')(e.target.value)} className={campo + ' bg-white'}>
            {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-3">
        <label className={etiqueta + ' flex-1'}>Despegue
          <input value={form.sitio} onChange={e => set('sitio')(e.target.value)}
            placeholder="Sitio" className={campo} />
        </label>
        {/* La vela se elige de las suyas (Mi cuenta). Sin velas cargadas, no hay campo. */}
        {(velas.length > 0 || form.vela) && (
          <label className={etiqueta + ' flex-1'}>Vela
            <select value={form.vela} onChange={e => set('vela')(e.target.value)} className={campo + ' bg-white'}>
              <option value="">Sin anotar</option>
              {[...new Set([...velas.map(v2 => v2.label), ...(form.vela ? [form.vela] : [])])].map(v2 => (
                <option key={v2} value={v2}>{v2}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className={etiqueta}>Observaciones
        <textarea value={form.nota} onChange={e => set('nota')(e.target.value)} rows={2}
          placeholder="Condiciones, novedades…" className={campo} />
      </label>

      <div className="flex gap-2">
        <button onClick={() => { setEditando(null); setError(null) }}
          className="flex-1 bg-[#eef4fb] text-[#1a4a85] font-bold py-2.5 rounded-xl text-sm">Cerrar</button>
        {v?.origen === 'externo' && (
          <button onClick={() => borrar(v)}
            className="bg-[#ffeef0] text-[#c0392b] font-bold py-2.5 px-4 rounded-xl text-sm">Borrar</button>
        )}
        <button onClick={() => guardar(v)} disabled={guardando}
          className="flex-1 bg-[#1a4a85] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )

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
        <Rango valor={periodo} onCambiar={setPeriodo} conAnios />

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

        {/* El resumen de un libro de vuelo: siempre sobre todo lo volado, no sobre el rango */}
        {vuelos !== null && vuelos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => setVerResumen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-[#0d2b5c]">
              <span>Mis horas, desde siempre</span>
              <span className="text-[#7aafd4]">{verResumen ? '▲' : '▼'}</span>
            </button>
            {verResumen && (
              <div className="px-4 pb-4 flex flex-col gap-4">
                {resumen.map(([titulo, filas]) => (
                  <div key={titulo}>
                    <p className="text-xs font-bold text-[#1a4a85] uppercase tracking-wide mb-1">{titulo}</p>
                    <div className="rounded-xl border border-[#e3eef9] divide-y divide-[#e3eef9]">
                      {filas.map(([que, cuantos, minutos]) => (
                        <div key={que} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                          <span className="text-[#0d2b5c] truncate">{que}</span>
                          <span className="text-xs text-gray-500 shrink-0">
                            {cuantos} · <b className="text-[#0d2b5c]">{enHoras(minutos)}</b>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="bg-[#ffeef0] text-[#c0392b] text-sm rounded-xl px-4 py-2">{error}</p>}

        {editando !== 'nuevo' ? (
          <button onClick={abrirNuevo}
            className="bg-[#1a4a85] text-white font-bold py-3 rounded-2xl text-sm hover:opacity-95">
            + Agregar un {j.actividad} de otra empresa
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <p className="px-4 py-2 bg-[#eef4fb] text-xs font-bold text-[#1a4a85] uppercase">
              {May(j.actividad)} de otra empresa
            </p>
            {formulario(null)}
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
              <div key={clave(v)} className="border-t border-gray-100">
                <button onClick={() => editando === clave(v) ? setEditando(null) : abrirVuelo(v)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#f7fbff]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#0d2b5c] truncate">
                      {v.pasajero || `Sin ${j.cliente}`}
                      {v.origen === 'externo' && <span className="ml-2 text-[10px] font-bold text-[#b45309] bg-[#fde68a] rounded px-1.5 py-0.5">fuera</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {v.empresa} · {textoDe(CAMARAS, v.camara, 'Sin cámara')}
                      {v.tipo !== 'biplaza' ? ` · ${textoDe(TIPOS, v.tipo)}` : ''}
                      {v.sitio ? ` · ${v.sitio}` : ''}
                      {v.valor ? ` · ${fmtCLP(v.valor)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[#1a4a85] bg-[#eef4fb] rounded-xl px-3 py-2">
                    {v.minutos} min
                  </span>
                </button>
                {editando === clave(v) && formulario(v)}
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  )
}
