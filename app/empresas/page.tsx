'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

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

  useEffect(() => {
    supabase.rpc('mis_empresas').then(({ data }) => setEmpresas((data as Empresa[]) ?? []))
  }, [])

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/" className="text-white text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">Mis empresas</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-5 py-8">
        <p className="text-sm text-gray-600 mb-5">
          Primero la que te asignó un vuelo más recientemente. Entras con el mismo
          correo y la misma contraseña en todas.
        </p>

        {empresas === null && <p className="text-gray-500">Cargando…</p>}
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
      </main>
    </div>
  )
}
