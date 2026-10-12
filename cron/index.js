// Supabase free pausa el proyecto tras 7 dias sin actividad. Este worker lo
// consulta a diario para que nunca llegue a esos 7 dias.
// empresa_publica es la unica funcion que anon puede ejecutar (la usa el login).
const consultar = async (env) => {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/empresa_publica`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: 'raos' }),
  })
  return `${res.status} ${(await res.text()).slice(0, 200)}`
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(consultar(env).then((r) => console.log('ping supabase:', r)))
  },
  // Para probarlo a mano: abrir la URL del worker
  async fetch(request, env) {
    return new Response(await consultar(env))
  },
}
