// Texto de la ficha de aceptacion de riesgo. Al firmar se guarda la version y el
// hash del texto aceptado, asi que cualquier cambio obliga a subir FICHA_VERSION.
export const FICHA_VERSION = '2026-10-v1'

export type Idioma = 'es' | 'en'

export const FICHA_TEXTO: Record<Idioma, string> = {
  es: `Declaro que participo voluntariamente en un vuelo biplaza de parapente, actividad de turismo aventura regulada en Chile.

Entiendo que el vuelo en parapente conlleva riesgos que no pueden eliminarse por completo, aun cuando el prestador cumpla los estándares de seguridad exigidos. Entre otros: turbulencia y cambios bruscos de las condiciones meteorológicas, aterrizajes forzosos, colisiones, caídas, fallas de equipo, y lesiones que pueden ser graves o incluso fatales.

Declaro que la información de salud que entrego en esta ficha es verídica y completa, y que no padezco ninguna condición que desaconseje la actividad. Me comprometo a informar al piloto de cualquier condición relevante antes del despegue.

Me obligo a seguir en todo momento las instrucciones del piloto y del personal a cargo, y a usar el equipo de seguridad que se me entregue. Entiendo que el piloto puede suspender o cancelar el vuelo por condiciones meteorológicas o de seguridad.

Conozco y acepto libremente los riesgos descritos, y libero al prestador y a su personal de responsabilidad por los daños derivados del riesgo propio de la actividad, sin que ello alcance a los daños causados por dolo o culpa del prestador, ni afecte los derechos que la ley me reconoce como consumidor.

Autorizo la atención médica de urgencia que resulte necesaria, y el tratamiento de mis datos personales para fines de seguridad, trazabilidad y cumplimiento de la normativa de turismo aventura, que obliga a conservar esta ficha por al menos dos años.`,

  en: `I declare that I voluntarily take part in a tandem paragliding flight, an adventure tourism activity regulated in Chile.

I understand that paragliding involves risks that cannot be entirely eliminated, even when the operator complies with the required safety standards. These include, among others: turbulence and sudden changes in weather conditions, forced landings, collisions, falls, equipment failure, and injuries that may be serious or even fatal.

I declare that the health information I provide in this form is truthful and complete, and that I have no condition that makes this activity inadvisable. I undertake to inform the pilot of any relevant condition before take-off.

I undertake to follow the instructions of the pilot and staff at all times, and to use the safety equipment provided to me. I understand that the pilot may suspend or cancel the flight for weather or safety reasons.

I know and freely accept the risks described, and I release the operator and its staff from liability for harm arising from the inherent risk of the activity. This does not cover harm caused by the operator's willful misconduct or negligence, nor does it affect the rights granted to me by consumer protection law.

I authorise any emergency medical care that may be necessary, and the processing of my personal data for safety, traceability and compliance with adventure tourism regulations, which require this form to be kept for at least two years.`,
}

export const FICHA_CHECK: Record<Idioma, string> = {
  es: 'Declaro haber leído y acepto los riesgos de la actividad',
  en: 'I declare that I have read and accept the risks of the activity',
}
