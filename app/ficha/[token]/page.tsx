'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FICHA_CHECK, FICHA_TEXTO, type Idioma } from '@/lib/ficha-texto'

type Ficha = {
  empresa: string; fecha: string; horario: number | null; aceptada_at: string | null
  nombre: string | null; documento: string | null; edad: number | null; nacionalidad: string | null
}

const T = {
  es: {
    titulo: 'Ficha de aceptación de riesgo', vuelo: 'Vuelo', datos: 'Tus datos',
    nombre: 'Nombre completo', documento: 'RUT o pasaporte', edad: 'Edad', nacionalidad: 'Nacionalidad',
    salud: 'Alergias, medicamentos, enfermedades crónicas, embarazo u otra condición relevante',
    saludPh: 'Escribe "ninguna" si no tienes ninguna',
    emergencia: 'Contacto de emergencia', eNombre: 'Nombre', eTelefono: 'Teléfono',
    tutor: 'Adulto responsable (eres menor de edad)',
    tNombre: 'Nombre del padre, madre o tutor', tDocumento: 'RUT o pasaporte',
    declaracion: 'Declaración', enviar: 'Confirmar', enviando: 'Enviando...',
    listoTitulo: '¡Listo!', listoTexto: 'Tu ficha quedó registrada. Nos vemos en el despegue.',
    faltan: 'Completa todos los campos y acepta la declaración.',
  },
  en: {
    titulo: 'Risk acceptance form', vuelo: 'Flight', datos: 'Your details',
    nombre: 'Full name', documento: 'ID or passport', edad: 'Age', nacionalidad: 'Nationality',
    salud: 'Allergies, medication, chronic illness, pregnancy or any other relevant condition',
    saludPh: 'Write "none" if you have none',
    emergencia: 'Emergency contact', eNombre: 'Name', eTelefono: 'Phone',
    tutor: 'Responsible adult (you are a minor)',
    tNombre: 'Parent or guardian name', tDocumento: 'ID or passport',
    declaracion: 'Declaration', enviar: 'Confirm', enviando: 'Sending...',
    listoTitulo: 'All set!', listoTexto: 'Your form has been recorded. See you at take-off.',
    faltan: 'Please fill in every field and accept the declaration.',
  },
}

const fmtH = (v: number | null) => {
  if (v == null) return ''
  const s = String(v).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

const input = 'w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/30 outline-none focus:border-[#ffd700]/60 transition-colors'
const label = 'block text-[#a8c4e0] text-xs font-bold mb-1.5 tracking-wider uppercase'

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-[#0d2b5c] px-5 py-8">
      <div className="w-full max-w-lg mx-auto">{children}</div>
    </div>
  )
}

export default function FichaPublica() {
  const token = String(useParams().token ?? '')
  const [idioma, setIdioma] = useState<Idioma>('es')
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [noExiste, setNoExiste] = useState(false)
  const [listo, setListo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acepta, setAcepta] = useState(false)

  const [f, setF] = useState({
    nombre: '', documento: '', edad: '', nacionalidad: '', salud: '',
    emergencia_nombre: '', emergencia_telefono: '', tutor_nombre: '', tutor_documento: '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }))

  const t = T[idioma]
  const edad = parseInt(f.edad, 10)
  const esMenor = Number.isFinite(edad) && edad < 18

  useEffect(() => {
    createClient().rpc('ficha_por_token', { p_token: token }).then(({ data }) => {
      const row = data?.[0]
      if (!row) return setNoExiste(true)
      setFicha(row)
      if (row.aceptada_at) setListo(true)
      setF(prev => ({ ...prev, nombre: row.nombre ?? '', edad: row.edad ? String(row.edad) : '' }))
    })
  }, [token])

  const enviar = async () => {
    setError(null)
    const faltan =
      !f.nombre.trim() || !f.documento.trim() || !f.nacionalidad.trim() || !f.salud.trim() ||
      !f.emergencia_nombre.trim() || !f.emergencia_telefono.trim() || !Number.isFinite(edad) ||
      !acepta || (esMenor && !f.tutor_nombre.trim())
    if (faltan) {
      setError(t.faltan)
      return
    }

    setEnviando(true)
    const res = await fetch('/api/ficha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, edad, token, idioma, acepta }),
    })
    const body = await res.json()
    setEnviando(false)
    if (!res.ok) {
      setError(body.error ?? 'Error')
      return
    }
    setListo(true)
  }

  if (noExiste) {
    return <Marco><p className="text-white/70 text-center">Este enlace no es válido. / This link is not valid.</p></Marco>
  }
  if (!ficha) return <Marco><p className="text-white/50 text-center">…</p></Marco>

  if (listo) {
    return (
      <Marco>
        <div className="text-center py-10">
          <div className="text-6xl mb-4">🪂</div>
          <h1 className="text-[#ffd700] text-2xl font-extrabold mb-2">{t.listoTitulo}</h1>
          <p className="text-[#a8c4e0]">{t.listoTexto}</p>
        </div>
      </Marco>
    )
  }

  return (
    <Marco>
      <div className="flex justify-end gap-1 mb-4">
        {(['es', 'en'] as Idioma[]).map(i => (
          <button key={i} onClick={() => setIdioma(i)}
            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${idioma === i ? 'bg-[#ffd700] text-[#0d2b5c]' : 'bg-white/10 text-[#a8c4e0]'}`}>
            {i}
          </button>
        ))}
      </div>

      <h1 className="text-[#ffd700] text-xl font-extrabold">{t.titulo}</h1>
      <p className="text-[#a8c4e0] text-sm mt-1 mb-6">
        {ficha.empresa} · {t.vuelo} {ficha.fecha} {fmtH(ficha.horario)}
      </p>

      <h2 className={label}>{t.datos}</h2>
      <div className="space-y-3 mb-6">
        <input className={input} placeholder={t.nombre} value={f.nombre} onChange={set('nombre')} />
        <input className={input} placeholder={t.documento} value={f.documento} onChange={set('documento')} />
        <div className="flex gap-3">
          <input className={input} inputMode="numeric" placeholder={t.edad} value={f.edad} onChange={set('edad')} />
          <input className={input} placeholder={t.nacionalidad} value={f.nacionalidad} onChange={set('nacionalidad')} />
        </div>
        <textarea className={input} rows={3} placeholder={t.saludPh} value={f.salud} onChange={set('salud')} />
        <p className="text-[#a8c4e0]/60 text-xs -mt-2">{t.salud}</p>
      </div>

      <h2 className={label}>{t.emergencia}</h2>
      <div className="flex gap-3 mb-6">
        <input className={input} placeholder={t.eNombre} value={f.emergencia_nombre} onChange={set('emergencia_nombre')} />
        <input className={input} inputMode="tel" placeholder={t.eTelefono} value={f.emergencia_telefono} onChange={set('emergencia_telefono')} />
      </div>

      {esMenor && (
        <>
          <h2 className={label}>{t.tutor}</h2>
          <div className="flex gap-3 mb-6">
            <input className={input} placeholder={t.tNombre} value={f.tutor_nombre} onChange={set('tutor_nombre')} />
            <input className={input} placeholder={t.tDocumento} value={f.tutor_documento} onChange={set('tutor_documento')} />
          </div>
        </>
      )}

      <h2 className={label}>{t.declaracion}</h2>
      <div className="max-h-64 overflow-y-auto rounded-xl bg-black/20 border border-white/10 p-4 mb-4">
        <p className="text-[#dceeff] text-sm whitespace-pre-line leading-relaxed">{FICHA_TEXTO[idioma]}</p>
      </div>

      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)}
          className="mt-0.5 w-5 h-5 shrink-0 accent-[#ffd700]" />
        <span className="text-white text-sm">{FICHA_CHECK[idioma]}</span>
      </label>

      {error && <p className="mb-4 p-3 bg-red-500/20 border border-red-400/40 text-red-200 rounded-lg text-sm">{error}</p>}

      <button onClick={enviar} disabled={enviando}
        className="w-full bg-[#ffd700] text-[#0d2b5c] font-extrabold py-4 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-70">
        {enviando ? t.enviando : t.enviar}
      </button>
    </Marco>
  )
}
