'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { May, useJerga } from '@/lib/jerga'
import Cargando from '@/components/Cargando'

const supabase = createClient()

export default function Permisos() {
  const j = useJerga()
  const [ven, setVen] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('empresas').select('pilotos_ven_reservas').maybeSingle()
      .then(({ data }) => setVen(data?.pilotos_ven_reservas ?? true))
  }, [])

  const cambiar = async (valor: boolean) => {
    setError(null)
    setSaving(true)
    const { error } = await supabase.rpc('fijar_pilotos_ven_reservas', { p_valor: valor })
    setSaving(false)
    if (error) return setError(error.message.includes('no autorizado') ? 'Solo un administrador puede cambiar esto' : 'No se pudo guardar')
    setVen(valor)
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/varios" className="text-[#ffd700] text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">🔒 Permisos</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">
        {ven === null ? <Cargando /> : (
          <label className="bg-white border border-[#d4e6f5] rounded-xl px-5 py-5 flex gap-4 items-start cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-5 h-5 accent-[#2e6db4] shrink-0"
              checked={ven}
              disabled={saving}
              onChange={e => cambiar(e.target.checked)}
            />
            <span>
              <span className="block text-[#0d2b5c] font-bold">Permitir a {j.operador_plural} ver reservas</span>
              <span className="block text-[#2e6db4] text-xs mt-1">
                {ven
                  ? `${May(j.operador_plural)} ven la lista de reservas de la empresa.`
                  : `${May(j.operador_plural)} no ven las reservas: solo sus propios ${j.actividad_plural}, desde el día en que ocurren, en la pantalla de ${j.operador_plural}.`}
              </span>
            </span>
          </label>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </main>
    </div>
  )
}
