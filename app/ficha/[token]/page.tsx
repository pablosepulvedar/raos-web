'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  COMO_CONOCIO, FICHA_CHECK, PREVISION, SALUD_ITEMS,
  fichaTexto, type Idioma, type Salud, type SaludKey,
} from '@/lib/ficha-texto'

type Ficha = {
  empresa: string; fecha: string; horario: number | null; aceptada_at: string | null
  nombre: string | null; edad: number | null
}

const T = {
  es: {
    titulo: 'Ficha de inscripción y aceptación del riesgo', vuelo: 'Vuelo',
    datos: '1. Datos personales', nombre: 'Nombre y apellido', documento: 'RUT o pasaporte',
    edad: 'Edad', nacionalidad: 'Nacionalidad', giftCard: 'N° Gift Card (si tienes)',
    urgencia: '2. Contacto en caso de urgencia', eNombre: 'Nombre y apellido',
    eTelefono: 'Teléfono', eParentesco: 'Parentesco',
    experiencia: '3. Declaración de experiencia',
    experienciaP: '¿Has volado en parapente antes?',
    saludT: '4. Declaración de salud', prevision: 'Previsión',
    detalle: 'Especificar', si: 'Sí', no: 'No',
    imagen: '¿Autorizas usar tus fotos, video y audio en redes sociales?',
    instagram: 'Tu Instagram para etiquetarte (sin @)',
    tutor: 'Adulto responsable (eres menor de edad)',
    tNombre: 'Nombre del padre, madre o tutor', tDocumento: 'RUT o pasaporte',
    comoT: '¿Cómo nos conociste?',
    declaracion: '5. Seguros, fotos y aceptación del riesgo',
    enviar: 'Confirmar', enviando: 'Enviando...',
    listoTitulo: '¡Listo!', listoTexto: 'Tu ficha quedó registrada. Nos vemos en el despegue.',
    faltan: 'Completa los campos obligatorios y acepta la declaración.',
  },
  en: {
    titulo: 'Registration and risk acceptance form', vuelo: 'Flight',
    datos: '1. Personal details', nombre: 'Full name', documento: 'ID or passport',
    edad: 'Age', nacionalidad: 'Nationality', giftCard: 'Gift card no. (if you have one)',
    urgencia: '2. Emergency contact', eNombre: 'Full name',
    eTelefono: 'Phone', eParentesco: 'Relationship',
    experiencia: '3. Experience declaration',
    experienciaP: 'Have you flown a paraglider before?',
    saludT: '4. Health declaration', prevision: 'Health insurance',
    detalle: 'Details', si: 'Yes', no: 'No',
    imagen: 'Do you allow us to use your photos, video and audio on social media?',
    instagram: 'Your Instagram so we can tag you (no @)',
    tutor: 'Responsible adult (you are a minor)',
    tNombre: 'Parent or guardian name', tDocumento: 'ID or passport',
    comoT: 'How did you hear about us?',
    declaracion: '5. Insurance, photos and risk acceptance',
    enviar: 'Confirm', enviando: 'Sending...',
    listoTitulo: 'All set!', listoTexto: 'Your form has been recorded. See you at take-off.',
    faltan: 'Please fill in the required fields and accept the declaration.',
  },
}

const fmtH = (v: number | null) => {
  if (v == null) return ''
  const s = String(v).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

const input = 'w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/30 outline-none focus:border-[#ffd700]/60 transition-colors'
const label = 'block text-[#ffd700] text-xs font-bold mb-2 tracking-wider uppercase'

const saludVacia = () =>
  Object.fromEntries(SALUD_ITEMS.map(i => [i.key, { si: false, detalle: '' }])) as Salud

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-[#0d2b5c] px-5 py-8">
      <div className="w-full max-w-lg mx-auto">{children}</div>
    </div>
  )
}

function SiNo({ value, onChange, si, no }: { value: boolean; onChange: (v: boolean) => void; si: string; no: string }) {
  return (
    <div className="flex gap-1 shrink-0">
      {[true, false].map(v => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
            value === v ? 'bg-[#ffd700] text-[#0d2b5c]' : 'bg-white/10 text-[#a8c4e0]'}`}>
          {v ? si : no}
        </button>
      ))}
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
    nombre: '', documento: '', edad: '', nacionalidad: '', gift_card: '',
    emergencia_nombre: '', emergencia_telefono: '', emergencia_parentesco: '',
    instagram: '', tutor_nombre: '', tutor_documento: '',
  })
  const [experiencia, setExperiencia] = useState(false)
  const [prevision, setPrevision] = useState('')
  const [salud, setSalud] = useState<Salud>(saludVacia)
  const [autorizaImagen, setAutorizaImagen] = useState(false)
  const [comoConocio, setComoConocio] = useState('')

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }))
  const setSaludItem = (k: SaludKey, patch: Partial<Salud[SaludKey]>) =>
    setSalud(prev => ({ ...prev, [k]: { ...prev[k], ...patch } }))

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
      !f.nombre.trim() || !f.documento.trim() || !f.nacionalidad.trim() ||
      !f.emergencia_nombre.trim() || !f.emergencia_telefono.trim() ||
      !Number.isFinite(edad) || !acepta || (esMenor && !f.tutor_nombre.trim())
    if (faltan) {
      setError(t.faltan)
      return
    }

    setEnviando(true)
    const res = await fetch('/api/ficha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...f, edad, token, idioma, acepta,
        experiencia_previa: experiencia, prevision, salud,
        autoriza_imagen: autorizaImagen, como_conocio: comoConocio,
      }),
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

      <h1 className="text-[#ffd700] text-xl font-extrabold leading-snug">{t.titulo}</h1>
      <p className="text-[#a8c4e0] text-sm mt-1 mb-6">
        {ficha.empresa} · {t.vuelo} {ficha.fecha} {fmtH(ficha.horario)}
      </p>

      {/* 1 */}
      <h2 className={label}>{t.datos}</h2>
      <div className="space-y-3 mb-6">
        <input className={input} placeholder={t.nombre} value={f.nombre} onChange={set('nombre')} />
        <input className={input} placeholder={t.documento} value={f.documento} onChange={set('documento')} />
        <div className="flex gap-3">
          <input className={input} inputMode="numeric" placeholder={t.edad} value={f.edad} onChange={set('edad')} />
          <input className={input} placeholder={t.nacionalidad} value={f.nacionalidad} onChange={set('nacionalidad')} />
        </div>
        <input className={input} placeholder={t.giftCard} value={f.gift_card} onChange={set('gift_card')} />
      </div>

      {/* 2 */}
      <h2 className={label}>{t.urgencia}</h2>
      <div className="space-y-3 mb-6">
        <input className={input} placeholder={t.eNombre} value={f.emergencia_nombre} onChange={set('emergencia_nombre')} />
        <div className="flex gap-3">
          <input className={input} inputMode="tel" placeholder={t.eTelefono} value={f.emergencia_telefono} onChange={set('emergencia_telefono')} />
          <input className={input} placeholder={t.eParentesco} value={f.emergencia_parentesco} onChange={set('emergencia_parentesco')} />
        </div>
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

      {/* 3 */}
      <h2 className={label}>{t.experiencia}</h2>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[#dceeff] text-sm flex-1">{t.experienciaP}</span>
        <SiNo value={experiencia} onChange={setExperiencia} si={t.si} no={t.no} />
      </div>

      {/* 4 */}
      <h2 className={label}>{t.saludT}</h2>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className="text-[#a8c4e0] text-sm mr-1 self-center">{t.prevision}:</span>
        {PREVISION.map(p => (
          <button key={p} type="button" onClick={() => setPrevision(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              prevision === p ? 'bg-[#ffd700] text-[#0d2b5c]' : 'bg-white/10 text-[#a8c4e0]'}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="space-y-3 mb-6">
        {SALUD_ITEMS.map(item => (
          <div key={item.key}>
            <div className="flex items-start gap-3">
              <span className="text-[#dceeff] text-sm flex-1">{item[idioma]}</span>
              <SiNo value={salud[item.key].si} onChange={v => setSaludItem(item.key, { si: v })} si={t.si} no={t.no} />
            </div>
            {salud[item.key].si && (
              <input className={`${input} mt-2`} placeholder={t.detalle}
                value={salud[item.key].detalle}
                onChange={e => setSaludItem(item.key, { detalle: e.target.value })} />
            )}
          </div>
        ))}

        <div className="flex items-start gap-3 pt-1">
          <span className="text-[#dceeff] text-sm flex-1">{t.imagen}</span>
          <SiNo value={autorizaImagen} onChange={setAutorizaImagen} si={t.si} no={t.no} />
        </div>
        {autorizaImagen && (
          <input className={input} placeholder={t.instagram} value={f.instagram} onChange={set('instagram')} />
        )}
      </div>

      {/* Cómo nos conociste */}
      <h2 className={label}>{t.comoT}</h2>
      <div className="flex flex-wrap gap-1.5 mb-6">
        {COMO_CONOCIO.map(c => (
          <button key={c} type="button" onClick={() => setComoConocio(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              comoConocio === c ? 'bg-[#ffd700] text-[#0d2b5c]' : 'bg-white/10 text-[#a8c4e0]'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* 5 */}
      <h2 className={label}>{t.declaracion}</h2>
      <div className="max-h-64 overflow-y-auto rounded-xl bg-black/20 border border-white/10 p-4 mb-4">
        <p className="text-[#dceeff] text-sm whitespace-pre-line leading-relaxed">
          {fichaTexto(idioma, ficha.empresa)}
        </p>
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
