'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Cargando from '@/components/Cargando'
import Volver from '@/components/Volver'

// Altas de empresas: generar el link, mandarlo y ver lo que contestaron.
// La tabla la protege el RLS (solo superadmin); acá no se esconde nada a mano.

const sb = createClient()

type Alta = {
  id: number; token: string; etiqueta: string; created_at: string
  empresa_nombre: string | null; empresa_rut: string | null; giro: string | null
  direccion: string | null; comuna: string | null; ciudad: string | null
  rubro: string | null; sitio_web: string | null
  contacto_nombre: string | null; contacto_cargo: string | null
  contacto_email: string | null; contacto_telefono: string | null
  comentarios: string | null
  aceptado_at: string | null; firmante_nombre: string | null; firmante_rut: string | null
  texto_version: string | null; texto_hash: string | null; ip: string | null; user_agent: string | null
  empresa_id: string | null
}

const fecha = (s: string | null) => s ? new Date(s).toLocaleString('es-CL') : '—'

export default function Altas() {
  const [filas, setFilas] = useState<Alta[]>([])
  const [cargando, setCargando] = useState(true)
  const [etiqueta, setEtiqueta] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<number | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const cargar = async () => {
    setCargando(true)
    const { data, error } = await sb.from('onboarding').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    setFilas((data ?? []) as Alta[])
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const crear = async () => {
    setError('')
    if (!etiqueta.trim()) return setError('Ponle un nombre para reconocerlo después.')
    setCreando(true)
    const { error } = await sb.rpc('sa_nuevo_onboarding', { p_etiqueta: etiqueta.trim() })
    setCreando(false)
    if (error) return setError(error.message)
    setEtiqueta('')
    cargar()
  }

  // El dominio raíz lo sirve la landing estática, no la aplicación: el link tiene que ir
  // a un subdominio del worker. Se usa `admin`, que no es de ninguna empresa.
  const linkDe = (t: string) => {
    const h = location.hostname
    const raiz = h.split('.').slice(1).join('.')
    const base = raiz ? `admin.${raiz}` : location.host    // en localhost se deja tal cual
    return `${location.protocol}//${base}/alta/${t}`
  }

  const copiar = async (t: string) => {
    await navigator.clipboard.writeText(linkDe(t))
    setCopiado(t)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#e8f2ff 0%,#d0e6ff 100%)' }}>
      <header className="sticky top-0 z-20 flex items-center gap-2 px-4 py-4"
        style={{ background: 'linear-gradient(135deg,#0d2b5c 0%,#1a4a85 100%)' }}>
        <Volver href="/admin" className="text-[#7aafd4]" />
        <p className="flex-1 text-center text-white font-extrabold text-sm">Altas de empresas</p>
        <span className="w-8" />
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-[#0d2b5c] font-bold text-sm uppercase tracking-wide mb-3">Nuevo link</p>
          <p className="text-sm text-gray-600 mb-3">
            Genera un link, mándaselo al cliente y él llena sus datos y acepta el acuerdo. Cada link sirve una sola vez.
          </p>
          <div className="flex gap-2">
            <input value={etiqueta} onChange={e => setEtiqueta(e.target.value)}
              placeholder="¿Para quién es? Ej: Alma Outdoor"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            <button onClick={crear} disabled={creando}
              className="px-4 py-2 rounded-xl bg-[#1a4a85] text-white text-sm font-bold disabled:opacity-50">
              {creando ? 'Creando…' : 'Generar'}
            </button>
          </div>
          {error && <p className="text-red-600 text-sm mt-3" role="alert">{error}</p>}
        </div>

        {cargando ? <Cargando /> : filas.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Todavía no has generado ningún link.</p>
        ) : filas.map(f => (
          <div key={f.id} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-[#0d2b5c]">{f.etiqueta}</p>
                <p className="text-xs text-gray-500">Creado el {fecha(f.created_at)}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${
                f.empresa_id ? 'bg-green-100 text-green-700'
                : f.aceptado_at ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-500'}`}>
                {f.empresa_id ? 'Empresa creada' : f.aceptado_at ? 'Aceptado' : 'Pendiente'}
              </span>
            </div>

            {!f.aceptado_at ? (
              <div className="flex gap-2 mt-3">
                <input readOnly value={linkDe(f.token)}
                  className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600" />
                <button onClick={() => copiar(f.token)}
                  className="px-3 py-2 rounded-xl border border-gray-300 text-sm whitespace-nowrap">
                  {copiado === f.token ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-700 mt-3">
                  <b>{f.empresa_nombre}</b>{f.empresa_rut && <> · {f.empresa_rut}</>}
                </p>
                <p className="text-sm text-gray-600">{f.contacto_nombre} · {f.contacto_email}</p>
                <button onClick={() => setAbierta(abierta === f.id ? null : f.id)}
                  className="text-[#2e6db4] text-sm font-semibold mt-2 hover:underline">
                  {abierta === f.id ? 'Ocultar el detalle' : 'Ver el detalle y la firma'}
                </button>

                {abierta === f.id && (
                  <dl className="mt-3 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                    {[
                      ['Giro', f.giro], ['Dirección', [f.direccion, f.comuna, f.ciudad].filter(Boolean).join(', ')],
                      ['Rubro', f.rubro], ['Sitio', f.sitio_web],
                      ['Cargo', f.contacto_cargo], ['Teléfono', f.contacto_telefono],
                      ['Comentarios', f.comentarios],
                      ['Aceptado', fecha(f.aceptado_at)],
                      ['Quién aceptó', [f.firmante_nombre, f.firmante_rut].filter(Boolean).join(' · ')],
                      ['Versión del texto', f.texto_version],
                      ['Hash', f.texto_hash?.slice(0, 32)],
                      ['IP', f.ip], ['Navegador', f.user_agent?.slice(0, 60)],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k as string} className="contents">
                        <dt className="text-gray-500 whitespace-nowrap">{k}</dt>
                        <dd className="text-gray-800 break-words">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {!f.empresa_id && (
                  <Link href={`/admin?alta=${f.id}`} className="inline-block mt-3 px-4 py-2 rounded-xl bg-[#1a4a85] text-white text-sm font-bold">
                    Crear la empresa con estos datos
                  </Link>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
