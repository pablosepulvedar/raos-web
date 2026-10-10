-- Usuarios de prueba del sitio demo. Las credenciales se muestran en el login de demo.
-- Contraseña: 123456 para los tres. Idempotente: no toca los que ya existan.
do $$
declare
  demo_id uuid := (select id from public.empresas where slug = 'demo');
  u record;
  uid uuid;
begin
  for u in select * from (values
    ('demo1@demo.cl', 'Demo Admin', 'Admin'),
    ('demo2@demo.cl', 'Demo Coordinador', 'Coordinador'),
    ('demo3@demo.cl', 'Demo Piloto', 'Piloto')
  ) as t(email, nombre, rol)
  loop
    continue when exists (select 1 from auth.users where email = u.email);

    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      u.email, extensions.crypt('123456', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nombre', u.nombre), now(), now()
    );
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
      values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', u.email), 'email', now(), now());

    insert into public.perfiles (id, nombre, activo, empresa_id) values (uid, u.nombre, true, demo_id);
    insert into public.perfil_roles (perfil_id, rol_id, empresa_id)
      select uid, r.id, demo_id from public.roles r where r.empresa_id = demo_id and r.nombre = u.rol;
  end loop;
end $$;
