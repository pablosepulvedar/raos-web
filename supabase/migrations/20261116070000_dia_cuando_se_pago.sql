-- Si ese día se pagó el sitio o quedó para fin de mes.
--
-- El sitio trae lo habitual (Las Vizcachas a fin de mes, Colina en el día), pero
-- un día cualquiera puede salirse de lo habitual: se pagó en la caseta, o se
-- quedó debiendo. Vacío = lo que diga el sitio.

alter table public.dias_de_vuelo
  add column cuando text check (cuando in ('fin_de_mes', 'al_momento'));
