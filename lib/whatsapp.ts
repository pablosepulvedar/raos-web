// Abrir WhatsApp con un mensaje listo.
//
// En un teléfono con las dos apps (WhatsApp y WhatsApp Business), wa.me abre la
// normal aunque no esté configurada: le pasó a RAOS. La preferencia es por
// dispositivo (un teléfono puede tener las dos y otro no), por eso vive en el
// navegador y no en la empresa. Solo sirve en Android: iOS no deja elegir la app,
// ahí la solución es borrar la WhatsApp normal.

const CLAVE = 'whatsapp-business'

export const usaBusiness = () => {
  try { return localStorage.getItem(CLAVE) === '1' } catch { return false }
}

export const fijarBusiness = (si: boolean) => {
  try { if (si) localStorage.setItem(CLAVE, '1'); else localStorage.removeItem(CLAVE) } catch {}
}

export const esAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

// tel: solo dígitos con código de país (569...). Sin tel, WhatsApp pregunta a quién.
export function linkWhatsApp(texto: string, tel = '', business = false, android = false) {
  const t = encodeURIComponent(texto)
  if (business && android) {
    return `intent://send/?${tel ? `phone=${tel}&` : ''}text=${t}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`
  }
  return `https://wa.me/${tel}?text=${t}`
}

export function abrirWhatsApp(texto: string, tel = '') {
  const url = linkWhatsApp(texto, tel, usaBusiness(), esAndroid())
  // Un intent:// no abre en pestaña nueva: se navega a él y Android lanza la app
  if (url.startsWith('intent:')) window.location.href = url
  else window.open(url, '_blank')
}
