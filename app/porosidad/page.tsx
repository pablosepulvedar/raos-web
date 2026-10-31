'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Volver from '@/components/Volver'
import Cargando from '@/components/Cargando'

// Test de porosidad de velas. Herramienta solo de RAOS (la plantilla PDF es suya) y
// solo para quien administra. Ramón llena los datos, la app rellena
// public/porosidad/plantilla.pdf y la APLANA: el cliente recibe un PDF que no puede
// editar. Cada test queda guardado (tests_porosidad) para volver a compartirlo.
const EMPRESA_POROSIDAD = 'raos'

type Campo = { n: string; label: string; ancho?: boolean; num?: boolean; ph?: string; tipo?: 'ext' | 'int' }
const SECCIONES: { titulo: string; campos: Campo[] }[] = [
  { titulo: 'Equipo', campos: [
    { n: 'Marca', label: 'Marca' }, { n: 'Modelo', label: 'Modelo' },
    { n: 'Homologacion', label: 'Homologación' }, { n: 'Talla', label: 'Talla', ph: 'L · 135-230 kg' },
    { n: 'N Serie', label: 'N° de serie' }, { n: 'Fabricado', label: 'Fabricado', ph: '03/2024' },
  ] },
  { titulo: 'Piloto', campos: [
    { n: 'Nombre y apellido', label: 'Nombre y apellido', ancho: true },
    { n: 'Celular', label: 'Celular' }, { n: 'Email', label: 'Email' },
  ] },
  { titulo: 'Test', campos: [
    { n: 'Test tomado', label: 'Test tomado (fecha)' }, { n: 'Test Disc', label: 'Test Disc (seg)', num: true },
    { n: 'Hora inicio', label: 'Hora inicio', ph: '17:26' }, { n: 'Hora Fin', label: 'Hora fin', ph: '19:48' },
    { n: 'Control inicio test disc', label: 'Control inicio Test Disc', num: true },
    { n: 'Control fin test disc', label: 'Control fin Test Disc', num: true },
  ] },
  { titulo: 'Extradós (segundos)', campos: [
    { n: 'Extrados 1ro Cajon Der', label: '1ro cajón derecho', num: true, tipo: 'ext' },
    { n: 'Extrados 1ro Cajon Izq', label: '1ro cajón izquierdo', num: true, tipo: 'ext' },
    { n: 'Extrados 8vo Cajon Der', label: '8vo cajón derecho', num: true, tipo: 'ext' },
    { n: 'Extrados 8vo Cajon Izq', label: '8vo cajón izquierdo', num: true, tipo: 'ext' },
    { n: 'Extrados Cajon Central', label: 'Cajón central', num: true, tipo: 'ext', ancho: true },
  ] },
  { titulo: 'Intradós (segundos)', campos: [
    { n: 'Intrados 1ro Cajon Der', label: '1ro cajón derecho', num: true, tipo: 'int' },
    { n: 'Intrados 1ro Cajon Izq', label: '1ro cajón izquierdo', num: true, tipo: 'int' },
    { n: 'Intrados Cajon Central', label: 'Cajón central', num: true, tipo: 'int', ancho: true },
  ] },
  { titulo: 'Condiciones del test', campos: [
    { n: 'Temperatura min', label: 'Temperatura desde (°C)', num: true }, { n: 'Temperatura max', label: 'Temperatura hasta (°C)', num: true },
    { n: 'Humedad min', label: 'Humedad desde (%)', num: true }, { n: 'Humedad max', label: 'Humedad hasta (%)', num: true },
  ] },
]

const num = (v: string) => parseFloat(v.replace(',', '.'))
const coma = (n: number) => n.toFixed(2).replace('.', ',')
const hoy = () => new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/-/g, '/')
// Misma tabla que la hoja de resultados
const condicionDe = (s: number) => s > 200 ? 'Más de 200 seg. · Excelente' : s > 70 ? 'Entre 70 y 200 seg. · Bueno'
  : s > 25 ? 'Entre 25 y 70 seg. · Medio' : s >= 18 ? 'Entre 18 y 25 seg. · Regular' : 'Menos de 18 seg. · Inadecuado'

const inicial = () => ({ 'Test tomado': hoy(), Fecha: hoy(), Firma: 'Ramón A. Ocando S.' } as Record<string, string>)

type Guardado = { id: number; piloto: string; fecha: string; equipo: string | null; datos: Record<string, string>; created_at: string }

// El nombre del archivo y el título del PDF: a quién se le hizo y cuándo
const tituloDe = (d: Record<string, string>) =>
  ['Test de porosidad', d['Nombre y apellido']?.trim() || 'sin nombre', (d['Test tomado'] || d.Fecha || '').trim().replace(/\//g, '-')]
    .filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '')

// Arma el PDF bloqueado a partir de los valores (los mismos que se guardan)
async function pdfDe(valores: Record<string, string>) {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.load(await (await fetch('/porosidad/plantilla.pdf', { cache: 'no-store' })).arrayBuffer())
  const form = pdf.getForm()
  for (const [n, val] of Object.entries(valores)) {
    try {
      const tf = form.getTextField(n)
      // Los comentarios en letra chica fija; el resto se achica solo para caber
      tf.acroField.setDefaultAppearance(n === 'Valoracion y recomendaciones' ? '/Helv 9 Tf 0.001 0.014 0.2 rg' : '/Helv 0 Tf 0.001 0.014 0.2 rg')
      tf.setText((val ?? '').trim())
    } catch { /* un dato sin campo en la plantilla se ignora */ }
  }
  form.flatten() // los valores quedan dibujados: ya no son campos editables
  const titulo = tituloDe(valores)
  pdf.setTitle(titulo)
  return new File([(await pdf.save()) as BlobPart], titulo + '.pdf', { type: 'application/pdf' })
}

// En el teléfono o el iPad se abre Compartir (WhatsApp, correo…); en el PC se descarga
async function entregar(archivo: File) {
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [archivo] })) {
    await navigator.share({ files: [archivo], title: archivo.name.replace(/\.pdf$/, '') })
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(archivo); a.download = archivo.name; a.click()
  }
}

export default function Porosidad() {
  const [esRaos, setEsRaos] = useState<boolean | null>(null)
  const [vista, setVista] = useState<'nuevo' | 'guardados'>('nuevo')
  const [guardados, setGuardados] = useState<Guardado[] | null>(null)
  const [busca, setBusca] = useState('')
  // Si se está corrigiendo un test guardado, generar lo actualiza en vez de crear otro
  const [editando, setEditando] = useState<number | null>(null)
  const [v, setV] = useState<Record<string, string>>(inicial)
  const [condicionAMano, setCondicionAMano] = useState(false)
  const [msg, setMsg] = useState('')
  const [generando, setGenerando] = useState(false)
  const sb = useRef(createClient()).current

  // Solo RAOS, y dentro de RAOS solo quien administra
  useEffect(() => {
    Promise.all([sb.from('empresas').select('slug').maybeSingle(), sb.rpc('puedo_administrar')])
      .then(([{ data }, { data: admin }]) => setEsRaos(data?.slug === EMPRESA_POROSIDAD && !!admin))
  }, [sb])

  const cargarGuardados = async () => {
    const { data } = await sb.from('tests_porosidad').select('id, piloto, fecha, equipo, datos, created_at')
      .order('created_at', { ascending: false })
    setGuardados((data as Guardado[]) ?? [])
  }

  const prom = (t: 'ext' | 'int') => {
    const xs = SECCIONES.flatMap(s => s.campos).filter(c => c.tipo === t).map(c => num(v[c.n] ?? '')).filter(Number.isFinite)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }
  const ext = prom('ext'), int = prom('int')
  const condicion = condicionAMano ? (v.Condicion ?? '') : ext == null ? '' : condicionDe(ext)
  const poner = (n: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(p => ({ ...p, [n]: e.target.value }))

  const generar = async () => {
    if (!v['Nombre y apellido']?.trim()) return setMsg('Falta el nombre del piloto')
    setGenerando(true); setMsg('Generando…')
    try {
      const valores: Record<string, string> = {
        ...v, Condicion: condicion,
        'Valor medio extrados': ext == null ? '' : coma(ext), 'Valor medio intrados': int == null ? '' : coma(int),
      }
      const archivo = await pdfDe(valores)
      // Se guarda antes de compartir: si el teléfono cancela el envío, el test igual queda
      const fila = {
        piloto: valores['Nombre y apellido'].trim(), fecha: (valores['Test tomado'] || valores.Fecha || '').trim(),
        equipo: [valores.Marca, valores.Modelo].filter(Boolean).join(' ').trim() || null, datos: valores,
        updated_at: new Date().toISOString(),
      }
      const { error } = editando
        ? await sb.from('tests_porosidad').update(fila).eq('id', editando)
        : await sb.from('tests_porosidad').insert(fila)
      if (error) throw new Error(`no se pudo guardar (${error.message})`)
      setGuardados(null)
      setMsg(`Guardado: ${archivo.name}`)
      await entregar(archivo)
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) setMsg(`No se pudo generar: ${e instanceof Error ? e.message : e}`)
    } finally { setGenerando(false) }
  }

  const compartir = async (g: Guardado) => {
    setMsg('Generando…')
    try { const archivo = await pdfDe(g.datos); setMsg(''); await entregar(archivo) }
    catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setMsg(`No se pudo generar: ${e instanceof Error ? e.message : e}`) }
  }
  const corregir = (g: Guardado) => {
    setV(g.datos); setCondicionAMano(true); setEditando(g.id); setVista('nuevo'); setMsg(`Corrigiendo el test de ${g.piloto}`)
    window.scrollTo(0, 0)
  }
  const borrar = async (g: Guardado) => {
    if (!confirm(`¿Borrar el test de ${g.piloto} del ${g.fecha}? No se puede deshacer.`)) return
    await sb.from('tests_porosidad').delete().eq('id', g.id)
    cargarGuardados()
  }
  const verGuardados = () => { setVista('guardados'); setMsg(''); cargarGuardados() }

  const limpiar = () => {
    if (!confirm('¿Borrar todos los datos del formulario?')) return
    setV(inicial()); setCondicionAMano(false); setMsg(''); setEditando(null)
  }

  const input = 'w-full mt-1 px-3 py-2.5 rounded-xl border border-[#c9d8ea] bg-white text-[#12233d] text-base'
  const etiqueta = 'block text-xs font-semibold text-[#3a5577]'

  if (esRaos === null) return <Cargando />
  if (!esRaos) return <p className="p-10 text-center text-gray-500">Esta herramienta no está disponible para tu usuario.</p>

  const pestanas = (
    <div className="flex gap-2 max-w-2xl mx-auto px-4 pt-4">
      {([['nuevo', editando ? 'Corrigiendo test' : 'Nuevo test'], ['guardados', 'Guardados']] as const).map(([k, txt]) => (
        <button key={k} onClick={() => (k === 'guardados' ? verGuardados() : setVista('nuevo'))}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${vista === k ? 'bg-[#2e6db4] text-white' : 'bg-[#d6e4f3] text-[#2e6db4]'}`}>
          {txt}
        </button>
      ))}
    </div>
  )
  const lista = (guardados ?? []).filter(g => !busca.trim()
    || `${g.piloto} ${g.fecha} ${g.equipo ?? ''}`.toLowerCase().includes(busca.trim().toLowerCase()))

  return (
    <div className="min-h-screen bg-[#eef3f8] pb-32">
      <header className="bg-[#0d2b5c] px-5 py-4 flex items-center gap-4">
        <Volver href="/" className="text-white" />
        <div className="flex-1">
          <h1 className="text-white text-lg font-bold">🧪 Test de porosidad</h1>
          <p className="text-[#a8c4e0] text-xs">El PDF sale bloqueado: el cliente no puede cambiar los valores.</p>
        </div>
      </header>
      {pestanas}

      {vista === 'guardados' ? (
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
          <input className={input} placeholder="Buscar por piloto, fecha o equipo" value={busca} onChange={e => setBusca(e.target.value)} />
          {guardados === null && <Cargando />}
          {guardados?.length === 0 && <p className="text-center text-gray-500 text-sm py-8">Todavía no hay tests guardados.</p>}
          {msg && <p className="text-center text-sm text-[#1d6b3a]">{msg}</p>}
          {lista.map(g => (
            <div key={g.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-[#0d2b5c]">{g.piloto} · {g.fecha}</p>
              <p className="text-xs text-gray-500">{g.equipo || 'Sin equipo'} · condición {g.datos.Condicion || '—'}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => compartir(g)} className="flex-1 py-2 rounded-xl bg-[#ffd700] text-[#0d2b5c] text-sm font-bold">Compartir PDF</button>
                <button onClick={() => corregir(g)} className="px-4 py-2 rounded-xl bg-[#e6edf5] text-[#0d2b5c] text-sm font-bold">Corregir</button>
                <button onClick={() => borrar(g)} aria-label={`Borrar el test de ${g.piloto}`} className="px-3 py-2 rounded-xl text-red-500 text-sm font-bold">✕</button>
              </div>
            </div>
          ))}
        </main>
      ) : (<>
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {SECCIONES.map(s => (
          <section key={s.titulo} className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-[#0d2b5c] font-extrabold text-xs uppercase tracking-wide mb-3">{s.titulo}</h2>
            <div className="grid grid-cols-2 gap-3">
              {s.campos.map(c => (
                <label key={c.n} className={`${etiqueta} ${c.ancho ? 'col-span-2' : ''}`}>
                  {c.label}
                  <input className={input} value={v[c.n] ?? ''} onChange={poner(c.n)} placeholder={c.ph}
                    inputMode={c.num ? 'decimal' : undefined} />
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-[#0d2b5c] font-extrabold text-xs uppercase tracking-wide mb-3">Resultados</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className={etiqueta}>Valor medio extradós
              <input className={`${input} bg-[#f2f6fb] font-bold`} readOnly value={ext == null ? '' : coma(ext)} /></label>
            <label className={etiqueta}>Valor medio intradós
              <input className={`${input} bg-[#f2f6fb] font-bold`} readOnly value={int == null ? '' : coma(int)} /></label>
            <label className={`${etiqueta} col-span-2`}>Condición
              <input className={input} value={condicion}
                onChange={e => { setCondicionAMano(true); setV(p => ({ ...p, Condicion: e.target.value })) }} /></label>
            <label className={`${etiqueta} col-span-2`}>Valoración y recomendaciones
              <textarea className={`${input} min-h-28`} value={v['Valoracion y recomendaciones'] ?? ''} onChange={poner('Valoracion y recomendaciones')} /></label>
            <label className={etiqueta}>Firma<input className={input} value={v.Firma ?? ''} onChange={poner('Firma')} /></label>
            <label className={etiqueta}>Fecha<input className={input} value={v.Fecha ?? ''} onChange={poner('Fecha')} /></label>
          </div>
          <p className="text-xs text-[#5a7392] mt-2">Los promedios y la condición se calculan solos; la condición se puede cambiar a mano.</p>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 bg-white border-t border-[#c9d8ea] px-4 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <p role="status" className="text-center text-sm text-[#1d6b3a] min-h-5 mb-1">{msg}</p>
        <div className="max-w-2xl mx-auto flex gap-2">
          <button onClick={limpiar} className="px-4 min-h-12 rounded-xl bg-[#e6edf5] text-[#0d2b5c] font-bold">Limpiar</button>
          <button onClick={generar} disabled={generando} id="generar"
            className="flex-1 min-h-12 rounded-xl bg-[#ffd700] text-[#0d2b5c] font-bold disabled:opacity-60">
            {generando ? 'Generando…' : editando ? 'Guardar corrección y generar PDF' : 'Generar PDF'}
          </button>
        </div>
      </div>
      </>)}
    </div>
  )
}
