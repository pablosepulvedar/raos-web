-- Agenda la limpieza del demo. Va en su propia migración: si pg_cron no está
-- disponible, solo falla el agendamiento y limpiar_demo() queda igual para
-- llamarla a mano o desde otro scheduler.
create extension if not exists pg_cron;
select cron.schedule('limpiar-demo', '0 7 * * *', $$select public.limpiar_demo()$$);
