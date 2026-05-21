'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type Metodo = { id: number; nombre: string; activo: boolean; created_at: string }

export default function MetodosPago() {
  const [metodos, setMetodos] = useState<Metodo[]>([])
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchMetodos = async () => {
    setLoading(true)
    const { data } = await supabase.from('metodos_pago').select('*').order('nombre')
    setMetodos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchMetodos() }, [])

  const resetForm = () => { setNombre(''); setEditingId(null); setError(null) }

  const saveMetodo = async () => {
    setError(null)
    if (!nombre.trim()) return setError('Ingresa el nombre del método de pago')
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('metodos_pago').update({ nombre: nombre.trim() }).eq('id', editingId)
        if (error) throw error
        setSuccess('Método actualizado correctamente')
      } else {
        const { error } = await supabase.from('metodos_pago').insert({ nombre: nombre.trim(), activo: true })
        if (error) throw error
        setSuccess('Método agregado correctamente')
      }
      resetForm()
      await fetchMetodos()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el método de pago')
    } finally {
      setSaving(false)
    }
  }

  const deleteMetodo = async (item: Metodo) => {
    if (!confirm(`¿Eliminar "${item.nombre}"?`)) return
    try {
      const { error } = await supabase.from('metodos_pago').delete().eq('id', item.id)
      if (error) throw error
      if (editingId === item.id) resetForm()
      await fetchMetodos()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('foreign key') ? 'No se puede eliminar: el método está en uso' : 'No se pudo eliminar el método de pago')
    }
  }

  const toggleActivo = async (item: Metodo) => {
    const { error } = await supabase.from('metodos_pago').update({ activo: !item.activo }).eq('id', item.id)
    if (!error) await fetchMetodos()
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/varios" className="text-[#ffd700] text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">💳 Métodos de pago</h1>
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
          <p className="text-[#333] text-sm font-semibold mb-3">Métodos existentes</p>
          {loading ? (
            <p className="text-[#2e6db4] text-sm">Cargando...</p>
          ) : metodos.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay métodos de pago registrados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {metodos.map((item) => (
                <div key={item.id} className="bg-white border border-[#d4e6f5] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[#0d2b5c] font-bold text-base">{item.nombre}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {item.activo ? '✅ Activo' : '❌ Inactivo'} · Creado: {item.created_at ? new Date(item.created_at).toLocaleString('es-CL') : '---'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActivo(item)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${item.activo ? 'bg-[#a8c8e8]' : 'bg-gray-300'}`}
                      title={item.activo ? 'Desactivar' : 'Activar'}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${item.activo ? 'translate-x-5 bg-[#2e6db4]' : 'translate-x-0 bg-gray-400'}`} />
                    </button>
                    <button
                      onClick={() => { setNombre(item.nombre); setEditingId(item.id); setError(null) }}
                      className="px-3 py-1.5 bg-[#2e6db4] text-white text-sm font-bold rounded-lg hover:bg-[#255d9a]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteMetodo(item)}
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
          <p className="text-[#0d2b5c] font-bold text-base mb-4">{editingId ? 'Editar método' : 'Agregar método'}</p>
          {error && (
            <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm">{error}</div>
          )}
          <label className="block text-[#1e5a96] font-bold text-sm mb-1">Nombre</label>
          <input
            className="w-full border border-[#b0cce8] rounded-lg p-3 text-sm mb-4 bg-white"
            placeholder="efectivo, transferencia, débito..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveMetodo()}
          />
          <button
            onClick={saveMetodo}
            disabled={saving}
            className="w-full bg-[#2e6db4] text-white font-bold py-3 rounded-xl hover:bg-[#255d9a] transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : editingId ? 'Actualizar método' : 'Agregar método'}
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
