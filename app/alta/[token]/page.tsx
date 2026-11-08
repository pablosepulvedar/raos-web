'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { CONTRATO_TEXTO, CONTRATO_TITULO } from '@/lib/contrato-texto'
import Cargando from '@/components/Cargando'

// Alta de una empresa nueva. Se abre sin cuenta, solo con el token del link.
// Un solo formulario: los datos de la empresa y la aceptación del acuerdo. Mandar
// dos links (contrato por un lado, datos por otro) hacía que se abandonara el primero.

const sb = createClient()

const RUBROS = [
  ['parapente', 'Parapente'], ['rafting', 'Rafting'], ['cabalgatas', 'Cabalgatas'],
  ['trekking', 'Trekking'], ['buceo', 'Buceo'], ['navegacion', 'Navegación'],
  ['tours', 'Tours'], ['generico', 'Otro'],
]

const campo = 'w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-[#7aafd4] border border-white/15 focus:outline-none focus:border-[#ffd700]'
const label = 'text-[#ffd700] text-xs font-bold uppercase tracking-wide'

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-5 py-8" style={{ background: 'linear-gradient(160deg,#0d2b5c 0%,#1a4a85 100%)' }}>
      <div className="max-w-xl mx-auto">{children}</div>
    </div>
  )
}

export default function Alta() {
  const token = String(useParams().token ?? '')

  const [estado, setEstado] = useState<'cargando' | 'form' | 'noExiste' | 'yaEnviado' | 'listo'>('cargando')
  const [etiqueta, setEtiqueta] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [d, setD] = useState({
    empresa_nombre: '', empresa_rut: '', giro: '', direccion: '', comuna: '', ciudad: '',
    rubro: 'generico', sitio_web: '',
    contacto_nombre: '', contacto_cargo: '', contacto_email: '', contacto_telefono: '',
    comentarios: '', firmante_nombre: '', firmante_rut: '',
  })
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD(x => ({ ...x, [k]: e.target.value }))

  useEffect(() => {
    ;(async () => {
      const { data } = await sb.rpc('onboarding_abrir', { p_token: token })
      const fila = Array.isArray(data) ? data[0] : null
      if (!fila) return setEstado('noExiste')
      setEtiqueta(fila.etiqueta ?? '')
      setEstado(fila.aceptado ? 'yaEnviado' : 'form')
    })()
  }, [token])

  const enviar = async () => {
    setError('')
    if (!d.empresa_nombre.trim()) return setError('Falta el nombre de la empresa.')
    if (!d.contacto_nombre.trim() || !d.contacto_email.trim()) return setError('Falta el nombre y el correo de contacto.')
    if (!d.firmante_nombre.trim()) return setError('Falta el nombre de quien acepta el acuerdo.')
    if (!acepta) return setError('Hay que aceptar el acuerdo para continuar.')

    setEnviando(true)
    try {
      const r = await fetch('/api/alta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acepta, ...d }),
      })
      const j = await r.json()
      if (!r.ok) setError(j.error ?? 'No se pudo enviar.')
      else setEstado('listo')
    } catch {
      setError('No se pudo enviar. Revisa tu conexión e inténtalo otra vez.')
    } finally {
      setEnviando(false)
    }
  }

  if (estado === 'cargando') return <Marco><div className="py-16"><Cargando /></div></Marco>

  if (estado === 'noExiste') return (
    <Marco>
      <h1 className="text-[#ffd700] text-2xl font-extrabold">Este link ya no es válido</h1>
      <p className="text-[#dceeff] mt-3">Pídele uno nuevo a Reservaps.</p>
    </Marco>
  )

  if (estado === 'yaEnviado') return (
    <Marco>
      <h1 className="text-[#ffd700] text-2xl font-extrabold">Este formulario ya se envió</h1>
      <p className="text-[#dceeff] mt-3">Si necesitas corregir algún dato, escríbenos y lo cambiamos.</p>
    </Marco>
  )

  if (estado === 'listo') return (
    <Marco>
      <h1 className="text-[#ffd700] text-2xl font-extrabold">Listo, recibimos tus datos</h1>
      <p className="text-[#dceeff] mt-3">
        Quedó registrada la aceptación del acuerdo. Vamos a crear la cuenta de <b>{d.empresa_nombre}</b> y
        te escribimos a <b>{d.contacto_email}</b> con los accesos.
      </p>
    </Marco>
  )

  const texto = CONTRATO_TEXTO.replaceAll('{empresa}', d.empresa_nombre.trim() || 'tu empresa')

  return (
    <Marco>
      <h1 className="text-[#ffd700] text-2xl font-extrabold leading-snug">Dar de alta tu empresa en Reservaps</h1>
      <p className="text-[#a8c4e0] text-sm mt-1 mb-7">
        {etiqueta && <>{etiqueta} · </>}Llena estos datos y acepta el acuerdo. Toma un par de minutos.
      </p>

      <h2 className={label}>La empresa</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-3 mb-7">
        <input className={`${campo} sm:col-span-2`} placeholder="Nombre o razón social *" value={d.empresa_nombre} onChange={set('empresa_nombre')} />
        <input className={campo} placeholder="RUT de la empresa" value={d.empresa_rut} onChange={set('empresa_rut')} />
        <input className={campo} placeholder="Giro" value={d.giro} onChange={set('giro')} />
        <input className={`${campo} sm:col-span-2`} placeholder="Dirección" value={d.direccion} onChange={set('direccion')} />
        <input className={campo} placeholder="Comuna" value={d.comuna} onChange={set('comuna')} />
        <input className={campo} placeholder="Ciudad" value={d.ciudad} onChange={set('ciudad')} />
        <select className={campo} value={d.rubro} onChange={set('rubro')}>
          {RUBROS.map(([v, n]) => <option key={v} value={v} className="text-gray-800">{n}</option>)}
        </select>
        <input className={campo} placeholder="Sitio web o Instagram" value={d.sitio_web} onChange={set('sitio_web')} />
      </div>

      <h2 className={label}>Contacto</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-3 mb-7">
        <input className={campo} placeholder="Nombre *" value={d.contacto_nombre} onChange={set('contacto_nombre')} />
        <input className={campo} placeholder="Cargo" value={d.contacto_cargo} onChange={set('contacto_cargo')} />
        <input className={campo} type="email" placeholder="Correo *" value={d.contacto_email} onChange={set('contacto_email')} />
        <input className={campo} placeholder="Teléfono" value={d.contacto_telefono} onChange={set('contacto_telefono')} />
        <textarea className={`${campo} sm:col-span-2`} rows={3} placeholder="¿Algo que debamos saber? (opcional)" value={d.comentarios} onChange={set('comentarios')} />
      </div>

      <h2 className={label}>{CONTRATO_TITULO}</h2>
      <div className="mt-3 mb-4 max-h-80 overflow-y-auto rounded-xl bg-white/10 border border-white/15 p-4">
        <pre className="text-[#dceeff] text-[13px] leading-relaxed whitespace-pre-wrap font-sans">{texto}</pre>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <input className={campo} placeholder="Nombre de quien acepta *" value={d.firmante_nombre} onChange={set('firmante_nombre')} />
        <input className={campo} placeholder="RUT de quien acepta" value={d.firmante_rut} onChange={set('firmante_rut')} />
      </div>

      <label className="flex items-start gap-3 p-4 rounded-xl bg-white/10 border border-white/15 cursor-pointer">
        <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0" />
        <span className="text-[#dceeff] text-sm">
          He leído y acepto el acuerdo en nombre de la empresa. Declaro tener facultades para hacerlo.
        </span>
      </label>

      <p className="text-[#7aafd4] text-xs mt-3">
        Al aceptar se guarda la fecha, tu dirección IP y el texto exacto que leíste, como respaldo de la
        aceptación (Ley 19.799 sobre documentos electrónicos).
      </p>

      {error && <p className="text-red-300 text-sm mt-4" role="alert">{error}</p>}

      <button onClick={enviar} disabled={enviando}
        className="w-full mt-5 py-4 rounded-xl bg-[#ffd700] text-[#0d2b5c] font-extrabold disabled:opacity-50">
        {enviando ? 'Enviando…' : 'Aceptar y enviar'}
      </button>
    </Marco>
  )
}
