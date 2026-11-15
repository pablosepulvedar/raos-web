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
  const [velas, setVelas] = useState<{ id: number; nombre: string }[]>([])
  const [velaNueva, setVelaNueva] = useState('')
  const [velaError, setVelaError] = useState<string | null>(null)
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
    const { data: vls } = await supabase.from('mis_velas').select('id, nombre').order('nombre')
    setVelas(vls ?? [])
  }
  useEffect(() => { cargar() }, [])

  const responder = async (id: number, acepta: boolean) => {
    setRespondiendo(id)
    await supabase.rpc('responder_invitacion', { p_id: id, p_acepta: acepta })
    await cargar()
    setRespondiendo(null)
  }

  // Las velas son del guía: se eligen después en la ficha de cada salida de su bitácora
  const agregarVela = async () => {
    const nombre = velaNueva.trim()
    if (!nombre) return
    setVelaError(null)
    const { error } = await supabase.from('mis_velas').insert({ nombre })
    if (error) { setVelaError(error.code === '23505' ? 'Esa vela ya está en la lista' : error.message); return }
    setVelaNueva('')
    await cargar()
  }

  const borrarVela = async (id: number, nombre: string) => {
    if (!confirm(`¿Sacar ${nombre} de tus velas? Las salidas que ya la tengan anotada no cambian.`)) return
    await supabase.from('mis_velas').delete().eq('id', id)
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
                <div key={v.id} className="flex items-center gap-2 bg-[#f7fbff] border border-[#e3eef9] rounded-lg px-3 py-2">
                  <span className="flex-1 text-[#0d2b5c] text-sm truncate">{v.nombre}</span>
                  <button onClick={() => borrarVela(v.id, v.nombre)}
                    className="text-[#c0392b] text-sm font-bold px-2">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={velaNueva}
              onChange={e => setVelaNueva(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') agregarVela() }}
              placeholder="Marca y modelo"
              className="flex-1 border border-[#d4e6f5] rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={agregarVela} disabled={!velaNueva.trim()}
              className="bg-[#1e5a96] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              Agregar
            </button>
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
