'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type Horario = { id: number; horario: number; created_at: string }

const formatHorario = (value: number) => {
  const s = String(value).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

export default function Horarios() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [hour, setHour] = useState('12')
  const [minute, setMinute] = useState('00')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchHorarios = async () => {
    setLoading(true)
    const { data } = await supabase.from('horarios').select('*').order('horario')
    setHorarios(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchHorarios() }, [])

  const resetForm = () => { setHour('12'); setMinute('00'); setEditingId(null); setError(null) }

  const saveHorario = async () => {
    setError(null)
    const h = hour.padStart(2, '0')
    const m = minute.padStart(2, '0')
    if (Number(h) > 23 || Number(m) > 59 || !hour || !minute) {
      return setError('Ingresa una hora válida (00-23) y minutos (00-59)')
    }
    const horarioInt = Number(`${h}${m}`)
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('horarios').update({ horario: horarioInt }).eq('id', editingId)
        if (error) throw error
        setSuccess('Horario actualizado correctamente')
      } else {
        const { error } = await supabase.from('horarios').insert({ horario: horarioInt })
        if (error) throw error
        setSuccess('Horario agregado correctamente')
      }
      resetForm()
      await fetchHorarios()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el horario')
    } finally {
      setSaving(false)
    }
  }

  const deleteHorario = async (item: Horario) => {
    if (!confirm(`¿Eliminar horario ${formatHorario(item.horario)}?`)) return
    const { error } = await supabase.from('horarios').delete().eq('id', item.id)
    if (error) {
      setError('No se pudo eliminar el horario')
    } else {
      await fetchHorarios()
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/varios" className="text-[#ffd700] text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">🕒 Horarios</h1>
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
          <p className="text-[#333] text-sm font-semibold mb-3">Horarios guardados</p>
          {loading ? (
            <p className="text-[#2e6db4] text-sm">Cargando...</p>
          ) : horarios.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay horarios registrados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {horarios.map((item) => (
                <div key={item.id} className="bg-white border border-[#d4e6f5] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[#0d2b5c] font-bold text-xl tabular-nums">{formatHorario(item.horario)}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Creado: {item.created_at ? new Date(item.created_at).toLocaleString('es-CL') : '---'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const raw = String(item.horario).padStart(4, '0')
                        setHour(raw.slice(0, 2))
                        setMinute(raw.slice(2))
                        setEditingId(item.id)
                        setError(null)
                      }}
                      className="px-3 py-1.5 bg-[#2e6db4] text-white text-sm font-bold rounded-lg hover:bg-[#255d9a]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteHorario(item)}
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
          <p className="text-[#0d2b5c] font-bold text-base mb-4">{editingId ? 'Editar horario' : 'Agregar horario'}</p>
          {error && (
            <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm">{error}</div>
          )}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-[#1e5a96] font-bold text-sm mb-1">Hora</label>
              <input
                className="w-full border border-[#b0cce8] rounded-lg p-3 text-sm text-center tabular-nums bg-white"
                placeholder="12"
                value={hour}
                maxLength={2}
                onChange={(e) => setHour(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              />
            </div>
            <div className="flex items-end pb-3 text-[#0d2b5c] font-bold text-2xl">:</div>
            <div className="flex-1">
              <label className="block text-[#1e5a96] font-bold text-sm mb-1">Minutos</label>
              <input
                className="w-full border border-[#b0cce8] rounded-lg p-3 text-sm text-center tabular-nums bg-white"
                placeholder="00"
                value={minute}
                maxLength={2}
                onChange={(e) => setMinute(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              />
            </div>
          </div>
          <button
            onClick={saveHorario}
            disabled={saving}
            className="w-full bg-[#2e6db4] text-white font-bold py-3 rounded-xl hover:bg-[#255d9a] transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : editingId ? 'Actualizar horario' : 'Agregar horario'}
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
