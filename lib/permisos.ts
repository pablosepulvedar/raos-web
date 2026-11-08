'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export type Permisos = {
  cargando: boolean
  esAdmin: boolean            // ningún rol restringido: lo ve todo
  permisos: Set<string>       // las casillas de Varios > Roles
  perfilId: string | null
  veTodo: boolean             // el permiso 'reservas' es el que deja ver más allá de lo propio
}

// Lo mismo que calcula el menú principal, en un solo lugar para que las pantallas
// que dependen del rol no lo repitan cada una a su manera.
export function usePermisos(): Permisos {
  const [p, setP] = useState<Permisos>({ cargando: true, esAdmin: false, permisos: new Set(), perfilId: null, veTodo: false })

  useEffect(() => {
    ;(async () => {
      try {
        const sb = createClient()
        const { data } = await sb.auth.getUser()
        if (!data.user) return setP(x => ({ ...x, cargando: false }))
        const { data: perfil } = await sb
          .from('perfiles')
          .select('perfil_roles(roles(restringido, permisos))')
          .eq('id', data.user.id)
          .single()
        const roles = (perfil?.perfil_roles ?? []) as { roles?: { restringido?: boolean; permisos?: string[] } }[]
        const restringidos = roles.map(r => r.roles?.restringido === true)
        const esAdmin = !(restringidos.length > 0 && restringidos.every(Boolean))
        const permisos = new Set(roles.flatMap(r => r.roles?.permisos ?? []))
        setP({ cargando: false, esAdmin, permisos, perfilId: data.user.id, veTodo: esAdmin || permisos.has('reservas') })
      } catch {
        setP(x => ({ ...x, cargando: false }))
      }
    })()
  }, [])

  return p
}
