// Texto de la ficha de aceptación de riesgo, tomado literal de la ficha de papel
// de Parapente RAOS (registro Sernatur 79723). {empresa} se reemplaza por el
// nombre de la empresa dueña de la reserva.
// Al firmar se guarda la versión y el hash del texto aceptado, así que cualquier
// cambio aquí obliga a subir FICHA_VERSION.
export const FICHA_VERSION = '2026-10-v2'

export type Idioma = 'es' | 'en'

const PLANTILLA: Record<Idioma, string> = {
  es: `SEGUROS: Esta actividad NO cuenta con seguros comprometidos.

Las fotos y videos NO son parte de la actividad principal. En caso de daños y/o pérdida, sólo se hará la devolución si fue pagado este ítem (una vez entregado el link o memoria micro SD, está bajo la responsabilidad del pasajero).

DE CONOCIMIENTO Y DE LA ACEPTACIÓN DEL RIESGO QUE INVOLUCRA LA ACTIVIDAD O PROGRAMA

Declaro conocer, aceptar y entender los riesgos que envuelve la participación en este tipo de actividades, el cual no puede ser completamente eliminado, aun cuando exista el cumplimiento de estándares de seguridad acreditados por el prestador, los cuales tienen por finalidad disminuir los riesgos que el parapente involucra. Será deber del prestador informar de las condiciones y requisitos para el desarrollo de la actividad, como asimismo, es deber de los participantes, informarse adecuadamente de las condiciones en que se presta el servicio, de las condiciones mínimas que el participante debe poseer antes de efectuar la actividad y acatar las instrucciones que los instructores a cargo de la actividad indiquen. Eximo a {empresa}, como organizador de la actividad, o a cualquier persona física o Jurídica vinculada con la organización, de cualquier daño físico o material, así como de las responsabilidades derivadas de cualquier accidente que ocurra durante mi participación en ésta.

NOTA: Los tiempos de espera son inherentes al vuelo, debe haber un proceso previo de carácter informativo, administrativo y operacional. Luego subiremos a la cima de un cerro en un vehículo 4x4 desde donde despegaremos. El vuelo debería durar entre 15 min aprox. Pero podría durar menos. En caso de lluvia o mal tiempo los vuelos se suspenden. Como en toda actividad deportiva, en todo este proceso podría haber imponderables que podrían ocasionar lesiones a los participantes.`,

  en: `INSURANCE: This activity does NOT include any committed insurance.

Photos and videos are NOT part of the main activity. In the event of damage and/or loss, a refund will only be made if this item was paid for (once the link or micro SD card has been handed over, it is the passenger's responsibility).

KNOWLEDGE AND ACCEPTANCE OF THE RISK INVOLVED IN THE ACTIVITY OR PROGRAMME

I declare that I know, accept and understand the risks involved in taking part in this type of activity, which cannot be entirely eliminated even when the operator complies with accredited safety standards, whose purpose is to reduce the risks that paragliding involves. It is the operator's duty to inform me of the conditions and requirements of the activity, and it is likewise the participant's duty to become properly informed about the conditions under which the service is provided and about the minimum conditions the participant must meet before carrying out the activity, and to follow the instructions given by the instructors in charge. I release {empresa}, as organiser of the activity, and any natural or legal person connected with the organisation, from any physical or material harm, as well as from liability arising from any accident occurring during my participation in it.

NOTE: Waiting times are inherent to the flight; there is a prior informative, administrative and operational process. We then drive to the top of a hill in a 4x4 vehicle, from where we take off. The flight should last around 15 minutes, but it may be shorter. Flights are suspended in case of rain or bad weather. As in any sporting activity, throughout this process there may be unforeseen events that could cause injury to participants.`,
}

export const fichaTexto = (idioma: Idioma, empresa: string) =>
  PLANTILLA[idioma].replaceAll('{empresa}', empresa.toUpperCase())

export const FICHA_CHECK: Record<Idioma, string> = {
  es: 'Declaro haber leído y acepto los riesgos de la actividad',
  en: 'I declare that I have read and accept the risks of the activity',
}

// Filas de la declaración de salud, en el mismo orden que la ficha de papel.
export const SALUD_ITEMS = [
  { key: 'alergias', es: 'Declara alergias', en: 'Declares allergies' },
  { key: 'medicamentos', es: 'Declara medicamentos contraindicados', en: 'Declares contraindicated medication' },
  { key: 'enfermedades', es: 'Enfermedades o dolencias', en: 'Illnesses or ailments' },
  { key: 'operaciones', es: 'Operaciones o lesiones recientes', en: 'Recent surgery or injuries' },
  { key: 'embarazo', es: 'Embarazo', en: 'Pregnancy' },
  { key: 'drogas_alcohol', es: '¿Ha consumido algún tipo de droga o alcohol previo a la actividad?', en: 'Have you consumed any drugs or alcohol before the activity?' },
] as const

export type SaludKey = (typeof SALUD_ITEMS)[number]['key']
export type SaludItem = { si: boolean; detalle: string }
export type Salud = Record<SaludKey, SaludItem>

export const PREVISION = ['Fonasa', 'Isapre', 'Otro'] as const
export const COMO_CONOCIO = ['Google', 'Instagram', 'Facebook', 'Tik Tok', 'Otros'] as const
