'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type Valor = { id: number; servicio: string; monto: number; piloto: boolean; pasajero: boolean; created_at: string }

const formatCLP = (value: number) =>
  `$${Number(value).toLocaleString('es-CL')}`

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[#1e5a96] font-bold text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#2e6db4]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

export default function Valores() {
  const [valores, setValores] = useState<Valor[]>([])
  const [servicio, setServicio] = useState('')
  const [monto, setMonto] = useState('')
  const [piloto, setPiloto] = useState(false)
  const [pasajero, setPasajero] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchValores = async () => {
    setLoading(true)
    const { data } = await supabase.from('valores').select('*').order('updated_at', { ascending: false })
    setValores(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchValores() }, [])

  const resetForm = () => {
    setServicio(''); setMonto(''); setPiloto(false); setPasajero(true)
    setEditingId(null); setError(null)
  }

  const saveValor = async () => {
    setError(null)
    if (!servicio.trim() || !monto.trim()) return setError('Completa el servicio y el monto')
    const numericMonto = Number(monto.replace(/[^0-9]/g, ''))
    if (isNaN(numericMonto)) return setError('El monto debe ser un número')
    setSaving(true)
    try {
      const payload = { servicio: servicio.trim(), monto: numericMonto, piloto, pasajero }
      if (editingId) {
        const { error } = await supabase.from('valores').update(payload).eq('id', editingId)
        if (error) throw error
        setSuccess('Valor actualizado correctamente')
      } else {
        const { error } = await supabase.from('valores').insert(payload)
        if (error) throw error
        setSuccess('Valor agregado correctamente')
      }
      resetForm()
      await fetchValores()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el valor')
    } finally {
      setSaving(false)
    }
  }

  const editValor = (item: Valor) => {
    setServicio(item.servicio || '')
    setMonto(String(item.monto ?? ''))
    setPiloto(Boolean(item.piloto))
    setPasajero(item.pasajero !== false)
    setEditingId(item.id)
    setError(null)
  }

  const deleteValor = async (item: Valor) => {
    if (!confirm(`¿Eliminar el servicio "${item.servicio}"?`)) return
    const { error } = await supabase.from('valores').delete().eq('id', item.id)
    if (error) setError('No se pudo eliminar el valor')
    else await fetchValores()
  }

  const tipoLabel = (item: Valor) => {
    if (item.piloto && item.pasajero) return 'Piloto · Pasajero'
    if (item.piloto) return 'Piloto'
    if (item.pasajero) return 'Pasajero'
    return 'Sin tipo'
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/varios" className="text-[#ffd700] text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">💲 Valores</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">
        {success && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-800 rounded-lg flex justify-between text-sm">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="font-bold ml-2">×</button>
          </div>
        )}

        {/* Lista */}
        <div>
          <p className="text-[#333] text-sm font-semibold mb-3">Valores existentes</p>
          {loading ? (
            <p className="text-[#2e6db4] text-sm">Cargando...</p>
          ) : valores.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay valores registrados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {valores.map((item) => (
                <div key={item.id} className="bg-white border border-[#d4e6f5] rounded-xl p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0d2b5c] font-bold text-base truncate">{item.servicio}</p>
                    <p className="text-[#2e6db4] font-semibold text-sm mt-1">{formatCLP(item.monto)}</p>
                    <p className="text-gray-500 text-xs mt-1">{tipoLabel(item)}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Creado: {item.created_at ? new Date(item.created_at).toLocaleString('es-CL') : '---'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => editValor(item)}
                      className="px-3 py-1.5 bg-[#2e6db4] text-white text-sm font-bold rounded-lg hover:bg-[#255d9a]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteValor(item)}
                      className="px-3 py-1.5 bg-[#d9534f] text-white text-sm font-bold rounded-lg hover:bg-[#c9302c]"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulario */}
        <div className="bg-white border border-[#d4e6f5] rounded-xl p-5">
          <p className="text-[#0d2b5c] font-bold text-base mb-4">{editingId ? 'Editar valor' : 'Agregar valor'}</p>
          {error && (
            <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm">{error}</div>
          )}

          <label className="block text-[#1e5a96] font-bold text-sm mb-1">Servicio</label>
          <input
            className="w-full border border-[#b0cce8] rounded-lg p-3 text-sm mb-3 bg-white"
            placeholder="vuelo normal"
            value={servicio}
            onChange={(e) => setServicio(e.target.value)}
          />

          <label className="block text-[#1e5a96] font-bold text-sm mb-1">Monto (CLP)</label>
          <div className="flex items-center border border-[#b0cce8] rounded-lg mb-3 bg-white overflow-hidden">
            <span className="px-3 text-gray-400 text-sm font-semibold">$</span>
            <input
              className="flex-1 p-3 text-sm bg-transparent outline-none"
              placeholder="65000"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/[^0-9]/g, ''))}
            />
            {monto && <span className="px-3 text-[#2e6db4] text-xs font-semibold">{formatCLP(Number(monto))}</span>}
          </div>

          <div className="border border-[#b0cce8] rounded-lg px-3 mb-4 divide-y divide-[#e8f0f7]">
            <Toggle value={piloto} onChange={setPiloto} label="Aplica a piloto" />
            <Toggle value={pasajero} onChange={setPasajero} label="Aplica a pasajero" />
          </div>

          <button
            onClick={saveValor}
            disabled={saving}
            className="w-full bg-[#2e6db4] text-white font-bold py-3 rounded-xl hover:bg-[#255d9a] transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : editingId ? 'Actualizar valor' : 'Agregar valor'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="w-full mt-3 bg-[#f0f0f0] text-[#0d2b5c] font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
