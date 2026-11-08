'use client'

const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

export const mesActual = () => {
  const h = new Date()
  return { desde: toStr(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: toStr(h) }
}
const mesPasado = () => {
  const h = new Date()
  return {
    desde: toStr(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
    hasta: toStr(new Date(h.getFullYear(), h.getMonth(), 0)),
  }
}
const ultimos = (n: number) => {
  const h = new Date(); const d = new Date(); d.setDate(d.getDate() - n + 1)
  return { desde: toStr(d), hasta: toStr(h) }
}

export type Periodo = { desde: string; hasta: string }

export default function Rango({ valor, onCambiar }: { valor: Periodo; onCambiar: (p: Periodo) => void }) {
  const atajos: [string, () => Periodo][] = [
    ['Este mes', mesActual], ['Mes pasado', mesPasado], ['30 días', () => ultimos(30)],
  ]
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex gap-2">
        {atajos.map(([nombre, calcular]) => {
          const p = calcular()
          const activo = p.desde === valor.desde && p.hasta === valor.hasta
          return (
            <button key={nombre} onClick={() => onCambiar(p)}
              className={`flex-1 text-xs font-bold py-2 rounded-xl transition-colors ${
                activo ? 'bg-[#1a4a85] text-white' : 'bg-[#eef4fb] text-[#1a4a85] hover:bg-[#dbe8f7]'}`}>
              {nombre}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex-1 text-xs text-gray-500 font-semibold">Desde
          <input type="date" value={valor.desde} max={valor.hasta}
            onChange={e => onCambiar({ ...valor, desde: e.target.value })}
            className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
        </label>
        <label className="flex-1 text-xs text-gray-500 font-semibold">Hasta
          <input type="date" value={valor.hasta} min={valor.desde}
            onChange={e => onCambiar({ ...valor, hasta: e.target.value })}
            className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800" />
        </label>
      </div>
    </div>
  )
}
