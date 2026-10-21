// Trae produccion a la base local para probar antes de publicar.
//
//   npm run db:clone          -> vuelca prod a supabase/seed.sql y reinicia la local
//   npm run db:clone -- --solo-dump   -> solo el volcado, sin reiniciar
//
// El volcado incluye los usuarios: sin eso no hay con quien entrar en local. Las
// contrasenas son las mismas de produccion, porque viajan como hash.
//
// Ojo: deja una copia de los datos de produccion en tu disco (seed.sql esta en
// .gitignore). Borrala cuando no la necesites.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const correr = (args) =>
  execFileSync('npx', args, { stdio: ['ignore', 'inherit', 'inherit'], shell: true })

const tmp = mkdtempSync(join(tmpdir(), 'clon-'))
const volcado = join(tmp, 'prod.sql')

try {
  // --data-only ya trae auth junto con public: volcarlos aparte duplicaba los usuarios
  console.log('Volcando datos de produccion...')
  correr(['dotenv', '-e', '.env', '--', 'npx', 'supabase', 'db', 'dump', '-f', volcado, '--data-only'])

  const cabecera = `-- Clon de produccion del ${new Date().toISOString().slice(0, 16).replace('T', ' ')}
-- Generado por scripts/clonar-produccion.mjs. No editar a mano.
-- Contiene datos reales: esta en .gitignore y no debe commitearse.

-- Varias migraciones siembran datos (rubros, roles base, usuarios de la demo).
-- El clon manda, asi que primero se vacia lo que dejaron: si no, chocan las
-- claves al insertar.
set session_replication_role = replica;
do $vaciar$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('truncate table public.%I cascade', t.tablename);
  end loop;
end $vaciar$;
truncate auth.users cascade;
`
  writeFileSync('supabase/seed.sql', cabecera + readFileSync(volcado, 'utf8'))

  const filas = (s) => (s.match(/^INSERT INTO/gm) || []).length
  console.log(`seed.sql listo: ${filas(readFileSync('supabase/seed.sql', 'utf8'))} tablas con datos`)

  if (!process.argv.includes('--solo-dump')) {
    console.log('Reiniciando la base local (migraciones + seed)...')
    correr(['supabase', 'db', 'reset'])
    console.log('\nListo. Entra con los mismos correos y contrasenas de produccion:')
    console.log('  http://raos.localhost:3000   http://demo.localhost:3000   http://admin.localhost:3000')
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
