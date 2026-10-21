'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { InputPassword } from '@/components/InputPassword'
import Cargando from '@/components/Cargando'

type Config = { configurado: boolean; activo: boolean; public_key: string; token_termina_en: string | null }

const input = 'w-full border border-[#b0cce8] rounded-lg p-3 mb-3 text-sm bg-white'
const label = 'block text-[#1e5a96] font-bold text-sm mb-1'
const btn = 'bg-[#1e5a96] text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-[#174a82] transition-colors disabled:opacity-60'
const btnSec = 'border border-[#1e5a96] text-[#1e5a96] font-semibold py-2 px-3 rounded-lg hover:bg-[#e8f0f7] transition-colors text-sm'

export default function Pagos() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [publicKey, setPublicKey] = useState('')
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargar = async () => {
    const res = await fetch('/api/pagos/config')
    if (!res.ok) return
    const d: Config = await res.json()
    setCfg(d)
    setPublicKey(d.public_key)
  }
  useEffect(() => { cargar() }, [])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setMsg(null)
    const res = await fetch('/api/pagos/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: publicKey, access_token: token || undefined, activo: true }),
    })
    const d = await res.json()
    setCargando(false)
    if (!res.ok) return setMsg({ ok: false, texto: d.error })
    setToken('')
    setMsg({ ok: true, texto: d.cuenta ? `Conectado a la cuenta ${d.cuenta}` : 'Guardado' })
    cargar()
  }

  const cambiarActivo = async (activo: boolean) => {
    await fetch('/api/pagos/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo, public_key: publicKey }),
    })
    cargar()
  }

  const desconectar = async () => {
    await fetch('/api/pagos/config', { method: 'DELETE' })
    setMsg({ ok: true, texto: 'Credenciales borradas' })
    cargar()
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/varios" className="text-[#ffd700] text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">💳 Cobro en línea</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-5 py-8">
        {/* Hasta saber si ya está conectada, el formulario diría "Conectar" aunque
            la empresa ya tenga su cuenta puesta */}
        {cfg === null && <Cargando />}
        {cfg !== null && <>
        <div className="bg-white border border-[#d4e6f5] rounded-xl p-5 mb-5">
          <p className="text-[#0d2b5c] font-bold mb-1">Mercado Pago</p>
          <p className="text-sm text-gray-600">
            Conecta la cuenta de Mercado Pago de tu empresa y vas a poder mandar un link de pago por
            cada reserva. El dinero llega directo a tu cuenta: nosotros solo generamos el link y
            anotamos el pago cuando Mercado Pago avisa.
          </p>
          {cfg?.configurado && (
            <p className="mt-3 text-sm">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cfg.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                {cfg.activo ? 'Activo' : 'Pausado'}
              </span>
              <span className="text-gray-500 ml-2">token …{cfg.token_termina_en}</span>
            </p>
          )}
        </div>

        {msg && (
          <p className={`mb-4 p-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {msg.texto}
          </p>
        )}

        <form onSubmit={guardar} className="bg-white border border-[#d4e6f5] rounded-xl p-5">
          <label className={label}>Public key</label>
          <input className={input} value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="APP_USR-..." />

          <label className={label}>Access token {cfg?.configurado && <span className="font-normal text-gray-500">(solo si lo vas a cambiar)</span>}</label>
          <InputPassword className={input} value={token} onChange={(e) => setToken(e.target.value)} placeholder="APP_USR-..." autoComplete="off" />

          <p className="text-xs text-gray-500 mb-4">
            Los sacas de tu panel de Mercado Pago, en <strong>Tus integraciones → Credenciales de producción</strong>.
            Se guardan solo en el servidor y no se vuelven a mostrar.
          </p>

          <div className="flex gap-2 flex-wrap">
            <button type="submit" disabled={cargando || (!token && !cfg?.configurado)} className={btn}>
              {cargando ? 'Probando...' : cfg?.configurado ? 'Guardar' : 'Conectar'}
            </button>
            {cfg?.configurado && (
              <>
                <button type="button" className={btnSec} onClick={() => cambiarActivo(!cfg.activo)}>
                  {cfg.activo ? 'Pausar cobro' : 'Reanudar'}
                </button>
                <button type="button" className={btnSec} onClick={desconectar}>Desconectar</button>
              </>
            )}
          </div>
        </form>
        </>}
      </main>
    </div>
  )
}
