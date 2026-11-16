'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { May, useJerga } from '@/lib/jerga'
import InputMonto from '@/components/InputMonto'
import Cargando from '@/components/Cargando'
import Volver from '@/components/Volver'

type Sitio = {
  id: number; nombre: string; costo: number
  cuando: 'fin_de_mes' | 'al_momento'; predeterminado: boolean; activo: boolean
}

const VACIO = { nombre: '', costo: '', cuando: 'fin_de_mes', predeterminado: false }
const fmtCLP = (v: number) => `$${Number(v).toLocaleString('es-CL')}`

export default function Sitios() {
  const j = useJerga()
  const sb = useRef(createClient()).current
  const [sitios, setSitios] = useState<Sitio[] | null>(null)
  const [form, setForm] = useState<typeof VACIO>(VACIO)
  const [editando, setEditando] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    const { data } = await sb.from('sitios').select('*')
      .order('predeterminado', { ascending: false }).order('nombre')
    setSitios((data as Sitio[]) ?? [])
  }
  useEffect(() => { cargar() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!form.nombre.trim()) return setError('Ponle nombre al sitio')
    setError(null); setGuardando(true)
    const fila = {
      nombre: form.nombre.trim(),
      costo: Number(form.costo || 0),
      cuando: form.cuando,
      predeterminado: form.predeterminado,
    }
    const { error: err } = editando
      ? await sb.from('sitios').update(fila).eq('id', editando)
      : await sb.from('sitios').insert(fila)
    setGuardando(false)
    if (err) return setError(err.code === '23505' ? 'Ya tienes un sitio con ese nombre' : err.message)
    setForm(VACIO); setEditando(null)
    await cargar()
  }

  const borrar = async (s: Sitio) => {
    if (!confirm(`¿Borrar ${s.nombre}? Los días que ya lo tengan marcado vuelven al sitio de siempre.`)) return
    const { error: err } = await sb.from('sitios').delete().eq('id', s.id)
    if (err) return setError('No se pudo borrar: ' + err.message)
    if (editando === s.id) { setEditando(null); setForm(VACIO) }
    await cargar()
  }

  const editar = (s: Sitio) => {
    setError(null); setEditando(s.id)
    setForm({
      nombre: s.nombre, costo: String(s.costo),
      cuando: s.cuando, predeterminado: s.predeterminado,
    })
  }

  const campo = 'w-full border border-[#d4e6f5] rounded-lg px-3 py-2 text-sm'

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Volver href="/varios" className="text-[#ffd700]" />
        <h1 className="text-white text-xl font-bold flex-1 text-center">🏔️ Sitios</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Dónde opera tu empresa y <b>cuánto cobra cada lugar por {j.actividad}</b>. El cuadre del día
          descuenta eso usando el sitio de ese día, así que no hay que cuadrarlo a mano cuando se sale
          a otro lado.
        </p>

        {error && <p className="bg-[#ffeef0] text-[#c0392b] text-sm rounded-xl px-4 py-2">{error}</p>}

        {sitios === null ? <Cargando /> : sitios.length === 0 ? (
          <p className="text-gray-500 text-sm">Todavía no hay sitios cargados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sitios.map(s => (
              <div key={s.id}
                className="bg-white border rounded-xl p-4 flex items-center gap-3"
                style={{ borderColor: editando === s.id ? '#2e6db4' : '#d4e6f5' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0d2b5c] font-bold">
                    {s.nombre}
                    {s.predeterminado && (
                      <span className="ml-2 text-[10px] font-bold text-[#1e5a96] bg-[#e8f0fb] rounded-full px-2 py-0.5">
                        el de siempre
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {fmtCLP(s.costo)} por {j.actividad} · {s.cuando === 'fin_de_mes' ? 'se paga a fin de mes' : 'se paga en el día'}
                  </p>
                </div>
                <button onClick={() => editar(s)} className="text-[#2e6db4] font-bold px-2">✎</button>
                <button onClick={() => borrar(s)} className="text-[#c0392b] font-bold px-2">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border border-[#d4e6f5] rounded-xl p-5 flex flex-col gap-3">
          <p className="text-[#0d2b5c] font-bold">{editando ? 'Editar sitio' : 'Agregar sitio'}</p>

          <label className="text-xs text-gray-500 font-semibold">Nombre
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Las Vizcachas" className={campo} />
          </label>

          <div className="flex gap-3">
            <label className="flex-1 min-w-0 text-xs text-gray-500 font-semibold">
              Cuánto cobra por {j.actividad}
              <InputMonto value={form.costo} onChange={v => setForm(f => ({ ...f, costo: v }))}
                placeholder="$" className={campo} />
            </label>
            <label className="flex-1 min-w-0 text-xs text-gray-500 font-semibold">Cuándo se paga
              <select value={form.cuando} onChange={e => setForm(f => ({ ...f, cuando: e.target.value }))}
                className={campo + ' bg-white'}>
                <option value="fin_de_mes">A fin de mes</option>
                <option value="al_momento">En el día</option>
              </select>
            </label>
          </div>

          <label className="flex items-start gap-2 text-sm text-[#0d2b5c]">
            <input type="checkbox" className="mt-1" checked={form.predeterminado}
              onChange={e => setForm(f => ({ ...f, predeterminado: e.target.checked }))} />
            <span>
              <span className="block font-semibold">Es el sitio de siempre</span>
              <span className="block text-xs text-gray-500">
                El que se usa en todos los días que no marques otro. Solo uno puede serlo.
              </span>
            </span>
          </label>

          <div className="flex gap-2">
            {editando && (
              <button onClick={() => { setEditando(null); setForm(VACIO); setError(null) }}
                className="bg-[#eef4fb] text-[#1a4a85] font-bold py-2.5 px-4 rounded-xl text-sm">Cancelar</button>
            )}
            <button onClick={guardar} disabled={guardando || !form.nombre.trim()}
              className="flex-1 bg-[#1e5a96] text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar sitio'}
            </button>
          </div>
        </div>

        <div className="bg-[#fff8e1] border border-[#ffd700] rounded-xl p-4 text-sm text-[#5a4b00]">
          <b>Cómo se ve en el cuadre.</b> Un sitio que se paga <b>a fin de mes</b> sale como
          <i> provisión</i>, que es plata que todavía tienes pero que ya debes. Uno que se paga
          <i> en el día</i> sale como gasto de esa jornada. En los dos casos se descuenta una sola vez:
          no hay que anotar además el pago al {May(j.operador)} del lugar.
        </div>
      </div>
    </div>
  )
}
