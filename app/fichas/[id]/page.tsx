'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { SALUD_ITEMS, fichaTexto, type Idioma, type Salud } from '@/lib/ficha-texto'

type Ficha = {
  id: number; token: string; aceptada_at: string | null
  nombre: string | null; documento: string | null; edad: number | null; nacionalidad: string | null
  gift_card: string | null
  emergencia_nombre: string | null; emergencia_telefono: string | null; emergencia_parentesco: string | null
  experiencia_previa: boolean; prevision: string | null; salud: Salud | null
  autoriza_imagen: boolean; instagram: string | null; como_conocio: string | null
  tutor_nombre: string | null; tutor_documento: string | null
  texto_version: string | null; texto_hash: string | null; idioma: string | null
  ip: string | null; user_agent: string | null
  reservas: { nombre: string; fecha: string; horarios: { horario: number } | null } | null
  empresas: { nombre: string; registro_sernatur: string | null } | null
  // el piloto asignado al pasajero de esta ficha
  reservas_personas: { perfiles: { nombre: string } | null } | null
}

const fmtH = (v?: number | null) => {
  if (v == null) return ''
  const s = String(v).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}
const fmtFecha = (iso: string) => new Date(iso).toLocaleString('es-CL')
const siNo = (v: boolean) => (v ? 'Sí' : 'No')

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-300 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm text-black">{children || '—'}</p>
    </div>
  )
}

function Seccion({ n, titulo }: { n: number | string; titulo: string }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-wide text-black mt-4 mb-1">
      {n}. {titulo}
    </h2>
  )
}

export default function FichaFirmada() {
  const id = String(useParams().id ?? '')
  const router = useRouter()
  const sb = useRef(createClient()).current
  const [f, setF] = useState<Ficha | null>(null)
  const [noHay, setNoHay] = useState(false)

  useEffect(() => {
    sb.from('fichas_riesgo')
      .select('*, reservas(nombre, fecha, horarios(horario)), empresas(nombre, registro_sernatur), reservas_personas(perfiles(nombre))')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => (data ? setF(data as unknown as Ficha) : setNoHay(true)))
  }, [sb, id])

  if (noHay) return <p className="p-10 text-center text-gray-500">Ficha no encontrada.</p>
  if (!f) return <p className="p-10 text-center text-gray-400">Cargando...</p>

  const idioma: Idioma = f.idioma === 'en' ? 'en' : 'es'
  const empresa = f.empresas?.nombre ?? ''
  const esMenor = f.edad != null && f.edad < 18

  return (
    <div className="flex-1 bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Barra de acciones: no sale impresa */}
      <div className="max-w-[21cm] mx-auto mb-4 flex gap-2 px-4 print:hidden">
        <button onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-white text-[#2e6db4] font-bold text-sm shadow-sm">
          ← Volver
        </button>
        <button onClick={() => window.print()}
          className="px-4 py-2 rounded-xl bg-[#2e6db4] text-white font-bold text-sm shadow-sm">
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
      <div className="max-w-[21cm] min-w-[40rem] mx-auto bg-white p-5 sm:p-8 shadow-sm print:shadow-none print:p-0">
        <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-3">
          <div>
            <h1 className="text-base font-bold uppercase">Ficha de inscripción y aceptación del riesgo</h1>
            <p className="text-[11px] text-gray-600">Antecedentes personales del participante</p>
          </div>
          <div className="text-right text-[11px]">
            <p className="font-bold">{empresa}</p>
            {f.empresas?.registro_sernatur && <p>N° Registro {f.empresas.registro_sernatur}</p>}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-px">
          <Campo label="Fecha del vuelo">{f.reservas?.fecha}</Campo>
          <Campo label="Hora">{fmtH(f.reservas?.horarios?.horario)}</Campo>
          <Campo label="Guía a cargo">{f.reservas_personas?.perfiles?.nombre}</Campo>
          <Campo label="N° Gift Card">{f.gift_card}</Campo>
        </div>

        <Seccion n={1} titulo={esMenor ? 'Datos personales — participante menor de edad' : 'Datos personales'} />
        <div className="grid grid-cols-4 gap-px">
          <Campo label="Nombre y apellido">{f.nombre}</Campo>
          <Campo label="RUT o pasaporte">{f.documento}</Campo>
          <Campo label="Edad">{f.edad}</Campo>
          <Campo label="Nacionalidad">{f.nacionalidad}</Campo>
        </div>

        {f.tutor_nombre && (
          <>
            <Seccion n="1.1" titulo="Padre, madre o tutor (completa y acepta por el menor)" />
            <div className="grid grid-cols-2 gap-px">
              <Campo label="Nombre">{f.tutor_nombre}</Campo>
              <Campo label="RUT o pasaporte">{f.tutor_documento}</Campo>
            </div>
          </>
        )}

        <Seccion n={2} titulo="Contacto en caso de urgencia" />
        <div className="grid grid-cols-3 gap-px">
          <Campo label="Nombre y apellido">{f.emergencia_nombre}</Campo>
          <Campo label="Teléfono">{f.emergencia_telefono}</Campo>
          <Campo label="Parentesco">{f.emergencia_parentesco}</Campo>
        </div>


        <Seccion n={3} titulo="Declaración de experiencia" />
        <div className="grid grid-cols-1 gap-px">
          <Campo label="Declara experiencia anterior en la misma actividad">
            {siNo(f.experiencia_previa)}
          </Campo>
        </div>

        <Seccion n={4} titulo="Declaración de salud" />
        <div className="grid grid-cols-1 gap-px">
          <Campo label="Previsión">{f.prevision}</Campo>
        </div>
        <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[30rem] border-collapse text-sm mt-px">
          <tbody>
            {SALUD_ITEMS.map(item => {
              const v = f.salud?.[item.key]
              return (
                <tr key={item.key}>
                  <td className="border border-gray-300 px-3 py-1.5">{item.es}</td>
                  <td className="border border-gray-300 px-3 py-1.5 w-16 text-center font-bold">
                    {v ? siNo(v.si) : '—'}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 w-1/3 text-gray-700">
                    {v?.detalle || ''}
                  </td>
                </tr>
              )
            })}
            <tr>
              <td className="border border-gray-300 px-3 py-1.5">
                Autoriza el uso de fotos, video y audio en redes sociales
              </td>
              <td className="border border-gray-300 px-3 py-1.5 text-center font-bold">
                {siNo(f.autoriza_imagen)}
              </td>
              <td className="border border-gray-300 px-3 py-1.5 text-gray-700">
                {f.instagram ? `@${f.instagram}` : ''}
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <Seccion n={5} titulo="Seguros, fotos y aceptación del riesgo" />
        <p className="text-[10.5px] leading-snug whitespace-pre-line text-black border border-gray-300 p-3">
          {fichaTexto(idioma, empresa)}
        </p>

        {f.como_conocio && (
          <p className="text-[11px] mt-2">
            <span className="uppercase tracking-wide text-gray-500">¿Cómo nos conoció?</span>{' '}
            <b>{f.como_conocio}</b>
          </p>
        )}

        {/* Firma electrónica simple: la evidencia reemplaza a la firma y la huella */}
        <div className="mt-4 border-2 border-black p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide mb-1">
            {f.aceptada_at ? 'Aceptación registrada' : 'Ficha sin firmar'}
          </p>
          {f.aceptada_at ? (
            <div className="text-[11px] leading-relaxed text-black">
              <p>
                {f.tutor_nombre
                  ? <><b>{f.tutor_nombre}</b> ({f.tutor_documento || 'sin documento'}), como padre, madre o tutor de{' '}
                      <b>{f.nombre}</b>, marcó la declaración de aceptación de riesgo el </>
                  : <><b>{f.nombre}</b> marcó la declaración de aceptación de riesgo el </>}
                <b>{fmtFecha(f.aceptada_at)}</b>.
              </p>
              <p className="text-gray-600">
                IP {f.ip || '—'} · Texto {f.texto_version || '—'} · Idioma {f.idioma || '—'}
              </p>
              <p className="text-gray-600 break-all">SHA-256 del texto aceptado: {f.texto_hash || '—'}</p>
              <p className="text-gray-600 break-all">Navegador: {f.user_agent || '—'}</p>
              <p className="text-gray-500 mt-1 text-[10px]">
                Firma electrónica simple conforme a la Ley 19.799. Documento generado por el sistema
                de reservas; conservar por al menos 2 años.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">
              El participante todavía no completa ni acepta esta ficha.
            </p>
          )}
        </div>

        <p className="text-[10px] text-gray-400 mt-3">
          Reserva de {f.reservas?.nombre} · ficha {f.id}
        </p>
      </div>
    </div>
    </div>
  )
}
