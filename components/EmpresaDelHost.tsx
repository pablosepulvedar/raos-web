'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

// La dirección manda.
//
// La empresa en la que trabajas vive en `perfil_sesion`, y hasta ahora el
// subdominio solo la fijaba al iniciar sesión. Si después entrabas a otra empresa
// y volvías a la primera por su dirección, la URL decía una cosa y la pantalla
// mostraba otra: la de Parapente RAOS con los datos de Alma Outdoor. Crear una
// reserva ahí la mandaba a la empresa equivocada.
//
// Esto compara el subdominio con la empresa activa en cada carga y, si no
// coinciden, se cambia a la del subdominio. Solo pregunta a la base cuando hay
// que corregir.
export default function EmpresaDelHost() {
  const router = useRouter()

  useEffect(() => {
    const host = window.location.hostname
    const sub = host.split('.')[0]
    // admin no es una empresa, y fuera del dominio propio (localhost, previsualizaciones)
    // no hay subdominio que valga
    if (sub === 'admin' || sub === 'auth' || !host.includes('.')) return

    const supabase = createClient()

    const revisar = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return

      const { data: empresa } = await supabase.from('empresas').select('slug').maybeSingle()
      if (!empresa || empresa.slug === sub) return

      const { error } = await supabase.rpc('cambiar_empresa', { p_slug: sub })
      if (error) {
        // No pertenece a la empresa de esta dirección: no se le deja mirar
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      // Seguro contra el bucle: si tras recargar siguiera sin coincidir, no se
      // recarga de nuevo. Mejor una pantalla rara que una pestaña recargando sola.
      const marca = 'empresa-ajustada'
      try {
        if (sessionStorage.getItem(marca) === sub) return
        sessionStorage.setItem(marca, sub)
      } catch { /* modo privado: sin seguro, pero tampoco sin pagina */ }
      window.location.reload()
    }

    revisar()
    // Y al volver a la pestaña: si mientras tanto se entró a otra empresa en otra
    // pestaña, esta se corrige sola en vez de seguir con la empresa equivocada
    const alVolver = () => { if (document.visibilityState === 'visible') revisar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [router])

  return null
}
