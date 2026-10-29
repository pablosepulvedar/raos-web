'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Volver from '@/components/Volver'
import Cargando from '@/components/Cargando'
import InputMonto from '@/components/InputMonto'
import { ESTADOS, PLANES, alMes, cubreHasta, type Estado, type Plan } from '@/lib/planes'

const supabase = createClient()

type Cuenta = {
  empresa_id: string; slug: string; nombre: string; activa: boolean
  plan: Plan | null; precio: number | null; inicio: string | null; vence: string | null; notas: string | null
  estado: Estado; ultimo_pago: string | null; ultimo_monto: number | null
}
type Pago = { id: number; fecha: string; monto: number; metodo: string | null; hasta: string; nota: string | null }

const clp = (n: number) => `$${n.toLocaleString('es-CL')}`
const dia = (iso: string | null) => iso ? new Date(iso + 'T12:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const hoy = () => new Date().toLocaleDateString('sv-SE')
const masDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE') }
const diasHasta = (iso: string) => Math.round((new Date(iso + 'T12:00').getTime() - new Date(hoy() + 'T12:00').getTime()) / 864e5)
const caja = 'bg-white border border-[#d4e6f5] rounded-xl p-4'
const campo = 'w-full border border-[#b0cce8] rounded-lg p-2 text-sm bg-white'
const etiqueta = 'block text-xs font-bold text-[#2e6db4] mb-1'

export default function Cobros() {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('sa_cuentas')
    if (error) setError(error.message)
    else setCuentas(data as Cuenta[])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Lo que entra al mes: los planes que se cobran y no están suspendidos
  const cobrando = (cuentas ?? []).filter(c => c.plan && ['al_dia', 'vencida'].includes(c.estado))
  const mensual = cobrando.reduce((t, c) => t + alMes(c.plan!, c.precio ?? 0), 0)
  const cuantos = (e: Estado) => (cuentas ?? []).filter(c => c.estado === e).length
  const proximos = (cuentas ?? [])
    .filter(c => c.vence && ['al_dia', 'prueba'].includes(c.estado) && diasHasta(c.vence) <= 15)
    .sort((a, b) => a.vence!.localeCompare(b.vence!))

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Volver href="/admin" className="text-white" />
        <h1 className="text-white text-xl font-bold flex-1 text-center">💰 Cobros</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        {error && <p className="p-3 rounded-lg bg-red-100 text-red-700 text-sm">{error}</p>}
        {!cuentas && !error && <Cargando />}

        {cuentas && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className={`${caja} col-span-2 sm:col-span-1`}>
                <p className="text-xs text-gray-500">Ingreso mensual</p>
                <p className="text-2xl font-extrabold text-[#0d2b5c]">{clp(mensual)}</p>
                <p className="text-[11px] text-gray-400">{cobrando.length} empresas pagando · {clp(mensual * 12)} al año</p>
              </div>
              {(['al_dia', 'vencida', 'suspendida', 'prueba', 'sin_plan'] as Estado[]).map(e => (
                <div key={e} className={caja}>
                  <p className="text-xs text-gray-500">{ESTADOS[e].texto}</p>
                  <p className="text-2xl font-extrabold text-[#0d2b5c]">{cuantos(e)}</p>
                </div>
              ))}
            </div>

            {proximos.length > 0 && (
              <div className={caja}>
                <p className="text-sm font-bold text-[#0d2b5c] mb-2">Vencen en los próximos 15 días</p>
                {proximos.map(c => (
                  <p key={c.empresa_id} className="text-sm text-gray-700 flex justify-between">
                    <span>{c.nombre}</span>
                    <span className="text-gray-500">{dia(c.vence)} · {diasHasta(c.vence!) === 0 ? 'hoy' : `en ${diasHasta(c.vence!)} días`}</span>
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {cuentas.map(c => (
                <div key={c.empresa_id} className={caja}>
                  <button className="w-full text-left" onClick={() => setAbierta(abierta === c.empresa_id ? null : c.empresa_id)}>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#0d2b5c] flex-1 truncate">{c.nombre}</p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ESTADOS[c.estado].color}`}>
                        {ESTADOS[c.estado].texto}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {c.plan ? <>{PLANES[c.plan].nombre} · {clp(c.precio ?? 0)} · vence {dia(c.vence)}</> : 'No se le está cobrando'}
                      {c.ultimo_pago && <> · último pago {dia(c.ultimo_pago)} ({clp(c.ultimo_monto ?? 0)})</>}
                    </p>
                  </button>
                  {abierta === c.empresa_id && <Editor cuenta={c} alGuardar={cargar} />}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Editor({ cuenta, alGuardar }: { cuenta: Cuenta; alGuardar: () => void }) {
  const [plan, setPlan] = useState<Plan>(cuenta.plan ?? 'prueba')
  const [precio, setPrecio] = useState(String(cuenta.precio ?? PLANES.prueba.precio))
  const [inicio, setInicio] = useState(cuenta.inicio ?? hoy())
  const [vence, setVence] = useState(cuenta.vence ?? cubreHasta(hoy(), 1))
  const [notas, setNotas] = useState(cuenta.notas ?? '')
  const [pagos, setPagos] = useState<Pago[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // Nuevo pago: parte el día después del vencimiento (o hoy, si ya se pasó harto)
  const desde = cuenta.vence && cuenta.vence >= masDias(hoy(), -8) ? masDias(cuenta.vence, 1) : hoy()
  const [pFecha, setPFecha] = useState(hoy())
  const [pMonto, setPMonto] = useState(String(cuenta.precio ?? ''))
  const [pMetodo, setPMetodo] = useState('Transferencia')
  const [pHasta, setPHasta] = useState(cubreHasta(desde, PLANES[cuenta.plan ?? 'mensual'].meses))
  const [pNota, setPNota] = useState('')

  // Un pago corre el vencimiento en la base: el formulario tiene que tomar la fecha
  // nueva, o al guardar el plan la devolvería atrás
  useEffect(() => {
    if (!cuenta.vence) return
    setVence(cuenta.vence)
    setPHasta(cubreHasta(masDias(cuenta.vence, 1), PLANES[cuenta.plan ?? 'mensual'].meses))
  }, [cuenta.vence, cuenta.plan])

  const cargarPagos = useCallback(() => {
    supabase.from('pagos_plataforma').select('*').eq('empresa_id', cuenta.empresa_id)
      .order('fecha', { ascending: false }).then(({ data }) => setPagos((data as Pago[]) ?? []))
  }, [cuenta.empresa_id])
  useEffect(() => { cargarPagos() }, [cargarPagos])

  const elegirPlan = (p: Plan) => {
    setPlan(p)
    setPrecio(String(PLANES[p].precio))
    setVence(cubreHasta(inicio, PLANES[p].meses))
  }

  const correr = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setOcupado(true); setMsg(null)
    const { error } = await fn()
    setOcupado(false)
    setMsg(error ? `Error: ${error.message}` : ok)
    if (!error) { alGuardar(); cargarPagos() }
  }

  const guardar = () => correr(() => supabase.from('suscripciones').upsert({
    empresa_id: cuenta.empresa_id, plan, precio: parseInt(precio || '0', 10), inicio, vence,
    notas: notas.trim() || null, updated_at: new Date().toISOString(),
  }), 'Plan guardado')

  const quitar = () => {
    if (!confirm(`¿Dejar de cobrarle a ${cuenta.nombre}? Sus pagos anteriores quedan guardados.`)) return
    correr(() => supabase.from('suscripciones').delete().eq('empresa_id', cuenta.empresa_id), 'Ya no se le cobra')
  }

  const registrarPago = () => {
    const monto = parseInt(pMonto || '0', 10)
    if (!monto) return setMsg('Error: escribe el monto')
    if (!cuenta.plan) return setMsg('Error: primero guarda un plan')
    correr(() => supabase.from('pagos_plataforma').insert({
      empresa_id: cuenta.empresa_id, fecha: pFecha, monto, metodo: pMetodo, hasta: pHasta, nota: pNota.trim() || null,
    }), `Pago registrado: queda pagado hasta el ${dia(pHasta)}`)
  }

  const borrarPago = (p: Pago) => {
    if (!confirm(`¿Borrar el pago de ${clp(p.monto)} del ${dia(p.fecha)}? El vencimiento no vuelve atrás solo: corrígelo arriba si hace falta.`)) return
    correr(() => supabase.from('pagos_plataforma').delete().eq('id', p.id), 'Pago borrado')
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#eef3f7] space-y-4">
      {msg && <p className={`text-sm p-2 rounded-lg ${msg.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'}`}>{msg}</p>}

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2">
          <span className={etiqueta}>Plan</span>
          <select className={campo} value={plan} onChange={e => elegirPlan(e.target.value as Plan)}>
            {(Object.keys(PLANES) as Plan[]).map(p => (
              <option key={p} value={p}>{PLANES[p].nombre} — {clp(PLANES[p].precio)}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={etiqueta}>Precio pactado (por período)</span>
          <InputMonto className={campo} value={precio} onChange={setPrecio} />
        </label>
        <label>
          <span className={etiqueta}>Al mes</span>
          <p className="p-2 text-sm text-gray-600">{clp(alMes(plan, parseInt(precio || '0', 10)))}</p>
        </label>
        <label>
          <span className={etiqueta}>Inicio</span>
          <input type="date" className={campo} value={inicio} onChange={e => setInicio(e.target.value)} />
        </label>
        <label>
          <span className={etiqueta}>Pagado hasta</span>
          <input type="date" className={campo} value={vence} onChange={e => setVence(e.target.value)} />
        </label>
        <label className="col-span-2">
          <span className={etiqueta}>Notas</span>
          <input className={campo} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej.: precio fundador, paga por transferencia" />
        </label>
      </div>
      <p className="text-[11px] text-gray-500">
        Al vencer, la empresa ve una franja amarilla durante 7 días; después se le suspende el sistema
        hasta que registres el pago. Cortesía no vence nunca.
      </p>
      <div className="flex gap-2">
        <button onClick={guardar} disabled={ocupado}
          className="flex-1 py-2.5 rounded-xl bg-[#0d2b5c] text-white font-bold text-sm disabled:opacity-60">
          Guardar plan
        </button>
        {cuenta.plan && (
          <button onClick={quitar} disabled={ocupado}
            className="px-4 py-2.5 rounded-xl text-red-600 font-semibold text-sm hover:bg-red-50 disabled:opacity-60">
            Dejar de cobrar
          </button>
        )}
      </div>

      {cuenta.plan && (
        <div className="rounded-xl bg-[#f0f9f3] border border-[#bfe5cc] p-3 space-y-3">
          <p className="text-sm font-bold text-[#1d6b3a]">Registrar pago</p>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={etiqueta}>Fecha</span>
              <input type="date" className={campo} value={pFecha} onChange={e => setPFecha(e.target.value)} />
            </label>
            <label>
              <span className={etiqueta}>Monto</span>
              <InputMonto className={campo} value={pMonto} onChange={setPMonto} />
            </label>
            <label>
              <span className={etiqueta}>Método</span>
              <select className={campo} value={pMetodo} onChange={e => setPMetodo(e.target.value)}>
                {['Transferencia', 'Efectivo', 'Tarjeta', 'Mercado Pago', 'Otro'].map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label>
              <span className={etiqueta}>Cubre hasta</span>
              <input type="date" className={campo} value={pHasta} onChange={e => setPHasta(e.target.value)} />
            </label>
            <label className="col-span-2">
              <span className={etiqueta}>Nota</span>
              <input className={campo} value={pNota} onChange={e => setPNota(e.target.value)} placeholder="Ej.: N° de transferencia o boleta" />
            </label>
          </div>
          <button onClick={registrarPago} disabled={ocupado}
            className="w-full py-2.5 rounded-xl bg-[#2e9e52] text-white font-bold text-sm disabled:opacity-60">
            Registrar pago
          </button>
        </div>
      )}

      {pagos.length > 0 && (
        <div>
          <p className="text-sm font-bold text-[#0d2b5c] mb-1">Pagos recibidos</p>
          {pagos.map(p => (
            <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-[#eef3f7] text-sm">
              <span className="flex-1 min-w-0">
                <b>{clp(p.monto)}</b> · {dia(p.fecha)} · {p.metodo}
                <span className="block text-xs text-gray-500 truncate">cubre hasta {dia(p.hasta)}{p.nota && ` · ${p.nota}`}</span>
              </span>
              <button onClick={() => borrarPago(p)} aria-label="Borrar pago" className="w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-red-500">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
