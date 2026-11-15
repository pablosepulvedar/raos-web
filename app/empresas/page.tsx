'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Cargando from '@/components/Cargando'
import { esAndroid, fijarBusiness, usaBusiness } from '@/lib/whatsapp'
import Volver from '@/components/Volver'

type Invitacion = {
  id: number
  empresa: string
  logo_url: string | null
  color: string | null
  roles: string
}

type Empresa = {
  id: string
  slug: string
  nombre: string
  logo_url: string | null
  color: string | null
  actual: boolean
  ultimo_vuelo: string | null
}

type Vela = {
  id: number; nombre: string; marca: string; modelo: string; anio: number | null
  tipo: string | null; homologacion: string | null; talla: string | null
  serie: string | null; revision: string | null
}
type FormVela = {
  marca: string; modelo: string; anio: string; tipo: string
  homologacion: string; talla: string; serie: string; revision: string
}
const VELA_VACIA: FormVela = {
  marca: '', modelo: '', anio: '', tipo: '', homologacion: '', talla: '', serie: '', revision: '',
}
// Las clases de la norma EN 926-2, la de competición y las LTF alemanas viejas
const HOMOLOGACIONES = ['EN A', 'EN B', 'EN C', 'EN D', 'CCC', 'LTF 1', 'LTF 1-2', 'LTF 2', 'LTF 2-3', 'Sin homologar']

const campoVela = 'flex-1 min-w-0 border border-[#d4e6f5] rounded-lg px-3 py-2 text-sm'

const supabase = createClient()

// Cada empresa vive en su propio subdominio, así que cambiarse es ir a esa dirección.
const urlDe = (slug: string) =>
  (process.env.NEXT_PUBLIC_TENANT_URL ?? '').replace('{slug}', slug)

const cuando = (fecha: string | null) => {
  if (!fecha) return 'Sin vuelos asignados'
  const dias = Math.round((Date.now() - new Date(fecha + 'T12:00:00').getTime()) / 86_400_000)
  if (dias <= 0) return 'Vuelo hoy'
  if (dias === 1) return 'Último vuelo ayer'
  if (dias < 30) return `Último vuelo hace ${dias} días`
  if (dias < 365) return `Último vuelo hace ${Math.round(dias / 30)} meses`
  return 'Último vuelo hace más de un año'
}

export default function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null)
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [publicado, setPublicado] = useState(false)
  const [respondiendo, setRespondiendo] = useState<number | null>(null)
  // Por dispositivo: se lee después de montar (en el servidor no hay localStorage)
  const [velas, setVelas] = useState<Vela[]>([])
  const [vela, setVela] = useState<FormVela>(VELA_VACIA)
  const [editandoVela, setEditandoVela] = useState<number | null>(null)
  const [velaError, setVelaError] = useState<string | null>(null)
  const ponVela = (k: keyof FormVela) => (v: string) => setVela(f => ({ ...f, [k]: v }))
  const [business, setBusiness] = useState(false)
  const [android, setAndroid] = useState(false)
  useEffect(() => { setBusiness(usaBusiness()); setAndroid(esAndroid()) }, [])

  const cargar = async () => {
    const [mias, invs, pub] = await Promise.all([
      supabase.rpc('mis_empresas'),
      supabase.rpc('mis_invitaciones'),
      supabase.rpc('estoy_publicado'),
    ])
    setEmpresas((mias.data as Empresa[]) ?? [])
    setInvitaciones((invs.data as Invitacion[]) ?? [])
    setPublicado(!!pub.data)
    const { data: vls } = await supabase.from('mis_velas')
      .select('id, nombre, marca, modelo, anio, tipo, homologacion, talla, serie, revision')
      .order('nombre')
    setVelas((vls as Vela[]) ?? [])
  }
  useEffect(() => { cargar() }, [])

  const responder = async (id: number, acepta: boolean) => {
    setRespondiendo(id)
    await supabase.rpc('responder_invitacion', { p_id: id, p_acepta: acepta })
    await cargar()
    setRespondiendo(null)
  }

  // Las velas son del guía: se eligen después en la ficha de cada salida de su bitácora
  const guardarVela = async () => {
    if (!vela.marca.trim() || !vela.modelo.trim()) return
    setVelaError(null)
    const fila = {
      marca: vela.marca.trim(),
      modelo: vela.modelo.trim(),
      anio: vela.anio ? Number(vela.anio) : null,
      tipo: vela.tipo || null,
      homologacion: vela.homologacion || null,
      talla: vela.talla.trim() || null,
      serie: vela.serie.trim() || null,
      revision: vela.revision || null,
    }
    // Cambiarle el nombre a una vela no toca las salidas que ya la tienen anotada:
    // ahí quedó el texto del día en que se voló.
    const { error } = editandoVela
      ? await supabase.from('mis_velas').update(fila).eq('id', editandoVela)
      : await supabase.from('mis_velas').insert(fila)
    if (error) { setVelaError(error.code === '23505' ? 'Esa vela ya está en la lista' : error.message); return }
    setVela(VELA_VACIA)
    setEditandoVela(null)
    await cargar()
  }

  const editarVela = (v: Vela) => {
    setVelaError(null)
    setEditandoVela(v.id)
    setVela({
      marca: v.marca, modelo: v.modelo, anio: v.anio ? String(v.anio) : '',
      tipo: v.tipo ?? '', homologacion: v.homologacion ?? '', talla: v.talla ?? '',
      serie: v.serie ?? '', revision: v.revision ?? '',
    })
  }

  const borrarVela = async (id: number, nombre: string) => {
    if (!confirm(`¿Sacar ${nombre} de tus velas? Las salidas que ya la tengan anotada no cambian.`)) return
    await supabase.from('mis_velas').delete().eq('id', id)
    if (editandoVela === id) { setEditandoVela(null); setVela(VELA_VACIA) }
    await cargar()
  }

  const publicarme = async (valor: boolean) => {
    setPublicado(valor)
    await supabase.rpc('publicarme', { p_disponible: valor })
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Volver href="/" className="text-white" />
        <h1 className="text-white text-xl font-bold flex-1 text-center">Mi cuenta</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-5 py-8">
        {invitaciones.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-[#2e6db4] mb-2 tracking-wider uppercase">
              Te invitaron a trabajar
            </p>
            {invitaciones.map(i => (
              <div key={i.id} className="bg-[#fff8e1] border border-[#ffd700] rounded-xl p-4 mb-3">
                <p className="font-bold text-[#0d2b5c]">{i.empresa}</p>
                <p className="text-xs text-gray-600 mb-3">Te ofrecen entrar como {i.roles}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => responder(i.id, true)}
                    disabled={respondiendo === i.id}
                    className="bg-[#1e5a96] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => responder(i.id, false)}
                    disabled={respondiendo === i.id}
                    className="border border-gray-400 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs font-bold text-[#2e6db4] mb-2 tracking-wider uppercase">
          Donde trabajas
        </p>
        <p className="text-sm text-gray-600 mb-5">
          Primero la que te asignó un vuelo más recientemente. Entras con el mismo
          correo y la misma contraseña en todas.
        </p>

        {empresas === null && <Cargando />}
        {empresas?.length === 0 && (
          <p className="text-gray-500">No perteneces a ninguna empresa todavía.</p>
        )}

        <div className="flex flex-col gap-3">
          {empresas?.map(e => {
            const contenido = (
              <>
                <div
                  className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2"
                  style={{ borderColor: e.color ?? '#1e5a96' }}
                >
                  {e.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-lg font-extrabold text-white"
                      style={{ background: e.color ?? '#1e5a96' }}
                    >
                      {e.nombre[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0d2b5c] truncate">{e.nombre}</p>
                  <p className="text-xs text-gray-500">{cuando(e.ultimo_vuelo)}</p>
                </div>
                {e.actual
                  ? <span className="text-xs font-bold text-green-700 bg-green-100 rounded-full px-3 py-1">Estás aquí</span>
                  : <span className="text-[#2e6db4] text-lg">↗</span>}
              </>
            )

            return e.actual ? (
              <div key={e.id} className="flex items-center gap-4 bg-white border-2 border-green-200 rounded-xl p-4">
                {contenido}
              </div>
            ) : (
              <a
                key={e.id}
                href={urlDe(e.slug)}
                className="flex items-center gap-4 bg-white border border-[#d4e6f5] hover:border-[#2e6db4] rounded-xl p-4 transition-colors"
              >
                {contenido}
              </a>
            )
          })}
        </div>

        {(empresas?.length ?? 0) > 1 && (
          <p className="text-xs text-gray-500 mt-6">
            Cada empresa ve solo lo que pasa en ella. Ninguna sabe para quién más vuelas.
          </p>
        )}

        <div className="mt-8 bg-white border border-[#d4e6f5] rounded-xl p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={publicado}
              onChange={e => publicarme(e.target.checked)}
            />
            <span>
              <span className="block font-bold text-[#0d2b5c]">
                Disponible para otras empresas
              </span>
              <span className="block text-sm text-gray-600 mt-1">
                Otras empresas pueden encontrarte por tu nombre y ofrecerte trabajo. Solo ven
                tu nombre y tu rubro: nunca tu correo ni tu teléfono, ni para quién vuelas hoy.
                Nadie te agrega sin que aceptes, y puedes desmarcarlo cuando quieras.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 bg-white border border-[#d4e6f5] rounded-xl p-5">
          <p className="font-bold text-[#0d2b5c]">Mis velas</p>
          <p className="text-sm text-gray-600 mt-1 mb-3">
            El equipo con el que vuelas. Lo que cargues acá es lo que vas a poder elegir en cada
            salida de tu bitácora. Es tuyo: ninguna empresa lo ve.
          </p>

          {velas.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {velas.map(v => (
                <div key={v.id}
                  className="flex items-center gap-2 border rounded-lg px-3 py-2"
                  style={ editandoVela === v.id
                    ? { background:'#eef4fb', borderColor:'#1e5a96' }
                    : { background:'#f7fbff', borderColor:'#e3eef9' } }>
                  <button onClick={() => editarVela(v)} className="flex-1 min-w-0 text-left">
                    <span className="block text-[#0d2b5c] text-sm font-semibold truncate">
                      {v.nombre}{v.anio ? ` ${v.anio}` : ''}
                    </span>
                    <span className="block text-xs text-gray-500 truncate">
                      {[v.tipo, v.homologacion, v.talla && `talla ${v.talla}`].filter(Boolean).join(' · ') || 'Sin más datos'}
                    </span>
                  </button>
                  <button onClick={() => editarVela(v)}
                    className="text-[#1e5a96] text-sm font-bold px-2">✎</button>
                  <button onClick={() => borrarVela(v.id, v.nombre)}
                    className="text-[#c0392b] text-sm font-bold px-2">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input value={vela.marca} onChange={e => ponVela('marca')(e.target.value)}
                placeholder="Marca" className={campoVela} />
              <input value={vela.modelo} onChange={e => ponVela('modelo')(e.target.value)}
                placeholder="Modelo" className={campoVela} />
            </div>
            <div className="flex gap-2">
              <input value={vela.anio} onChange={e => ponVela('anio')(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric" placeholder="Año" className={campoVela} />
              <select value={vela.tipo} onChange={e => ponVela('tipo')(e.target.value)} className={campoVela + ' bg-white'}>
                <option value="">Biplaza o monoplaza…</option>
                <option value="biplaza">Biplaza</option>
                <option value="monoplaza">Monoplaza</option>
              </select>
            </div>
            <div className="flex gap-2">
              <select value={vela.homologacion} onChange={e => ponVela('homologacion')(e.target.value)}
                className={campoVela + ' bg-white'}>
                <option value="">Homologación…</option>
                {HOMOLOGACIONES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <input value={vela.talla} onChange={e => ponVela('talla')(e.target.value)}
                placeholder="Talla" className={campoVela} />
            </div>
            <div className="flex gap-2">
              <input value={vela.serie} onChange={e => ponVela('serie')(e.target.value)}
                placeholder="N° de serie" className={campoVela} />
              <label className="flex-1 text-xs text-gray-500">
                Última revisión
                <input type="date" value={vela.revision} onChange={e => ponVela('revision')(e.target.value)}
                  className={campoVela + ' w-full'} />
              </label>
            </div>
            <div className="flex gap-2">
              {editandoVela && (
                <button onClick={() => { setEditandoVela(null); setVela(VELA_VACIA); setVelaError(null) }}
                  className="bg-[#eef4fb] text-[#1a4a85] text-sm font-semibold px-4 py-2 rounded-lg">
                  Cancelar
                </button>
              )}
              <button onClick={guardarVela} disabled={!vela.marca.trim() || !vela.modelo.trim()}
                className="flex-1 bg-[#1e5a96] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                {editandoVela ? 'Guardar cambios' : 'Agregar vela'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {editandoVela
                ? 'Las salidas que ya la tengan anotada no cambian.'
                : 'Marca y modelo son lo único obligatorio. Toca una vela para editarla.'}
            </p>
          </div>
          {velaError && <p className="text-[#c0392b] text-sm mt-2">{velaError}</p>}
        </div>

        <div className="mt-4 bg-white border border-[#d4e6f5] rounded-xl p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={business}
              onChange={e => { fijarBusiness(e.target.checked); setBusiness(e.target.checked) }}
            />
            <span>
              <span className="block font-bold text-[#0d2b5c]">
                Abrir WhatsApp Business en este teléfono
              </span>
              <span className="block text-sm text-gray-600 mt-1">
                Márcalo si el número de la empresa está en WhatsApp Business y en este teléfono
                también está instalada la WhatsApp normal: así los botones de WhatsApp no abren la
                equivocada. Vale solo para este teléfono.
              </span>
              {!android && (
                <span className="block text-xs text-amber-700 mt-2">
                  Funciona en Android. En iPhone no se puede elegir la app: si tienes las dos,
                  borra la WhatsApp normal.
                </span>
              )}
            </span>
          </label>
        </div>
      </main>
    </div>
  )
}
