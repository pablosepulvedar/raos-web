'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import {
  COMO_CONOCIO, FICHA_CHECK, PREVISION, SALUD_ITEMS,
  fichaTexto, type Idioma, type Salud, type SaludKey,
} from '@/lib/ficha-texto'
import { faltantesFicha } from '@/lib/ficha-obligatorios'

type Ficha = {
  empresa: string; registro_sernatur: string | null
  fecha: string; horario: number | null; aceptada_at: string | null
  nombre: string | null; edad: number | null
}

const T = {
  es: {
    titulo: 'Ficha de inscripción y aceptación del riesgo', vuelo: 'Vuelo',
    datos: '1. Datos personales', nombre: 'Nombre y apellido', documento: 'RUT o pasaporte',
    edad: 'Edad', peso: 'Peso (kg)', nacionalidad: 'Nacionalidad', giftCard: 'N° Gift Card (si tienes)',
    urgencia: '2. Contacto en caso de urgencia', eNombre: 'Nombre y apellido',
    eTelefono: 'Teléfono', eParentesco: 'Parentesco',
    experiencia: '3. Declaración de experiencia',
    experienciaP: '¿Has volado en parapente antes?',
    saludT: '4. Declaración de salud', prevision: 'Previsión',
    detalle: 'Especificar', si: 'Sí', no: 'No',
    imagen: '¿Autorizas usar tus fotos, video y audio en redes sociales?',
    instagram: 'Tu Instagram para etiquetarte (sin @)',
    tutor: 'Tus datos (padre, madre o tutor)',
    tNombre: 'Tu nombre y apellido', tDocumento: 'Tu RUT o pasaporte',
    quien: '¿Quién completa esta ficha?',
    quienAdulto: 'Soy el pasajero (18 años o más)',
    quienTutor: 'Soy padre, madre o tutor de un menor',
    datosMenor: '1. Datos del menor', nombreMenor: 'Nombre y apellido del menor',
    avisoMenor: 'Los menores de 18 no pueden firmar: la ficha la completa y acepta su padre, madre o tutor.',
    noEsMenor: 'Marcaste que es menor de edad, pero la edad es de 18 o más.',
    comoT: '¿Cómo nos conociste?',
    declaracion: '5. Seguros, fotos y aceptación del riesgo',
    enviar: 'Confirmar', enviando: 'Enviando...',
    listoTitulo: '¡Listo!', listoTexto: 'Tu ficha quedó registrada. Nos vemos en el despegue.',
    faltan: 'Faltan datos obligatorios: están marcados en rojo.',
    obligatorio: 'Obligatorio', telefonoCorto: 'Obligatorio: teléfono con al menos 8 dígitos',
    pesoMal: 'Obligatorio: tu peso en kilos, sin decimales',
  },
  en: {
    titulo: 'Registration and risk acceptance form', vuelo: 'Flight',
    datos: '1. Personal details', nombre: 'Full name', documento: 'ID or passport',
    edad: 'Age', peso: 'Weight (kg)', nacionalidad: 'Nationality', giftCard: 'Gift card no. (if you have one)',
    urgencia: '2. Emergency contact', eNombre: 'Full name',
    eTelefono: 'Phone', eParentesco: 'Relationship',
    experiencia: '3. Experience declaration',
    experienciaP: 'Have you flown a paraglider before?',
    saludT: '4. Health declaration', prevision: 'Health insurance',
    detalle: 'Details', si: 'Yes', no: 'No',
    imagen: 'Do you allow us to use your photos, video and audio on social media?',
    instagram: 'Your Instagram so we can tag you (no @)',
    tutor: 'Your details (parent or guardian)',
    tNombre: 'Your full name', tDocumento: 'Your ID or passport',
    quien: 'Who is filling in this form?',
    quienAdulto: 'I am the passenger (18 or older)',
    quienTutor: 'I am the parent or guardian of a minor',
    datosMenor: "1. Minor's details", nombreMenor: "Minor's full name",
    avisoMenor: 'Minors under 18 cannot sign: their parent or guardian fills in and accepts the form.',
    noEsMenor: 'You marked a minor, but the age is 18 or over.',
    comoT: 'How did you hear about us?',
    declaracion: '5. Insurance, photos and risk acceptance',
    enviar: 'Confirm', enviando: 'Sending...',
    listoTitulo: 'All set!', listoTexto: 'Your form has been recorded. See you at take-off.',
    faltan: 'Some required fields are missing: they are marked in red.',
    obligatorio: 'Required', telefonoCorto: 'Required: phone with at least 8 digits',
    pesoMal: 'Required: your weight in kg, no decimals',
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
  // /ficha/<token> y tambien /ficha/<token>/<nombre>: el nombre va solo para que
  // se lea de quien es el link cuando se comparte por WhatsApp.
  const ruta = useParams().ruta
  const token = String(Array.isArray(ruta) ? ruta[0] : ruta ?? '')
  const [idioma, setIdioma] = useState<Idioma>('es')
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [noExiste, setNoExiste] = useState(false)
  const [listo, setListo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acepta, setAcepta] = useState(false)

  const [f, setF] = useState({
    nombre: '', documento: '', edad: '', peso: '', nacionalidad: '', gift_card: '',
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
  // Lo elige quien llena la ficha; una edad menor a 18 lo fuerza igual
  const [paraMenor, setParaMenor] = useState(false)
  const edadDeMenor = Number.isFinite(edad) && edad < 18
  const esMenor = paraMenor || edadDeMenor
  // Se marcan en rojo recién después del primer intento de enviar
  const [intento, setIntento] = useState(false)
  const faltan = faltantesFicha({ ...f, salud, acepta, esMenor })
  const falta = (k: string) => intento && faltan.includes(k)
  const campo = (k: keyof typeof f, placeholder: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="flex-1 min-w-0">
      <input id={`campo-${k}`} {...extra} placeholder={placeholder} value={f[k]} onChange={set(k)}
        aria-invalid={falta(k)}
        className={`${input} ${falta(k) ? '!border-red-400 ring-1 ring-red-400' : ''}`} />
      {falta(k) && <p className="text-red-300 text-xs mt-1">{k === 'emergencia_telefono' ? t.telefonoCorto : k === 'peso' ? t.pesoMal : t.obligatorio}</p>}
    </div>
  )

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
    if (faltan.length) {
      setIntento(true)
      setError(t.faltan)
      // Lleva al primero que falta
      const el = document.getElementById(`campo-${faltan[0]}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el instanceof HTMLInputElement) el.focus({ preventScroll: true })
      return
    }
    if (esMenor && !edadDeMenor) {
      setError(t.noEsMenor)
      return
    }

    setEnviando(true)
    const res = await fetch('/api/ficha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...f, edad, peso: parseInt(f.peso, 10), token, idioma, acepta,
        // un adulto que firma por sí mismo no lleva tutor, aunque haya alcanzado a escribirlo
        tutor_nombre: esMenor ? f.tutor_nombre : '', tutor_documento: esMenor ? f.tutor_documento : '',
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
      <p className="text-[#a8c4e0] text-sm mt-1">
        {ficha.empresa} · {t.vuelo} {ficha.fecha} {fmtH(ficha.horario)}
      </p>
      {ficha.registro_sernatur && (
        <p className="text-[#a8c4e0]/60 text-xs mt-0.5 mb-6">
          N° Registro Sernatur {ficha.registro_sernatur}
        </p>
      )}
      {!ficha.registro_sernatur && <div className="mb-6" />}

      <h2 className={label}>{t.quien}</h2>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {([[false, t.quienAdulto], [true, t.quienTutor]] as const).map(([v, txt]) => (
          <button key={String(v)} type="button" onClick={() => setParaMenor(v)}
            disabled={!v && edadDeMenor}
            className={`px-3 py-3 rounded-xl text-sm font-semibold leading-snug text-left transition-colors disabled:opacity-40 ${
              esMenor === v ? 'bg-[#ffd700] text-[#0d2b5c]' : 'bg-white/10 text-[#dceeff]'}`}>
            {txt}
          </button>
        ))}
      </div>
      {esMenor
        ? <p className="text-[#ffd700] text-xs mb-6">{t.avisoMenor}</p>
        : <div className="mb-6" />}

      {/* 1 */}
      <h2 className={label}>{esMenor ? t.datosMenor : t.datos}</h2>
      <div className="space-y-3 mb-6">
        {campo('nombre', esMenor ? t.nombreMenor : t.nombre)}
        {campo('documento', t.documento)}
        <div className="flex gap-3">
          {campo('edad', t.edad, { inputMode: 'numeric' })}
          {campo('peso', t.peso, { inputMode: 'numeric' })}
        </div>
        {campo('nacionalidad', t.nacionalidad)}
        <input className={input} placeholder={t.giftCard} value={f.gift_card} onChange={set('gift_card')} />
      </div>

      {esMenor && (
        <>
          <h2 className={label}>{t.tutor}</h2>
          <div className="flex gap-3 mb-6">
            {campo('tutor_nombre', t.tNombre)}
            {campo('tutor_documento', t.tDocumento)}
          </div>
        </>
      )}

      {/* 2 */}
      <h2 className={label}>{t.urgencia}</h2>
      <div className="space-y-3 mb-6">
        {campo('emergencia_nombre', t.eNombre)}
        <div className="flex gap-3">
          {campo('emergencia_telefono', t.eTelefono, { inputMode: 'tel' })}
          {campo('emergencia_parentesco', t.eParentesco)}
        </div>
      </div>


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
              <>
                <input id={`campo-salud_${item.key}`} placeholder={t.detalle}
                  className={`${input} mt-2 ${falta(`salud_${item.key}`) ? '!border-red-400 ring-1 ring-red-400' : ''}`}
                  value={salud[item.key].detalle}
                  onChange={e => setSaludItem(item.key, { detalle: e.target.value })} />
                {falta(`salud_${item.key}`) && <p className="text-red-300 text-xs mt-1">{t.obligatorio}</p>}
              </>
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

      <label id="campo-acepta" className={`flex items-start gap-3 mb-6 cursor-pointer rounded-xl ${falta('acepta') ? 'ring-2 ring-red-400 p-2' : ''}`}>
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
