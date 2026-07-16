


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."deuda" (
    "id" bigint NOT NULL,
    "reserva_id" bigint,
    "monto" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "perfil_id" "uuid",
    "cancelado" boolean DEFAULT false NOT NULL,
    "metodo_pago_id" bigint
);


ALTER TABLE "public"."deuda" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deuda_detalles" (
    "id" bigint NOT NULL,
    "deuda_id" bigint NOT NULL,
    "valor_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deuda_detalles" OWNER TO "postgres";


ALTER TABLE "public"."deuda_detalles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."deuda_detalles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."deuda" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."deuda_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."gastos_diarios" (
    "id" integer NOT NULL,
    "fecha" "date" NOT NULL,
    "descripcion" "text" NOT NULL,
    "monto" integer NOT NULL,
    "tipo" "text" DEFAULT 'gasto'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metodo_pago_id" integer
);


ALTER TABLE "public"."gastos_diarios" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."gastos_diarios_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."gastos_diarios_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."gastos_diarios_id_seq" OWNED BY "public"."gastos_diarios"."id";



CREATE TABLE IF NOT EXISTS "public"."horarios" (
    "id" bigint NOT NULL,
    "horario" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."horarios" OWNER TO "postgres";


ALTER TABLE "public"."horarios" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."horarios_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."metodos_pago" (
    "id" bigint NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."metodos_pago" OWNER TO "postgres";


ALTER TABLE "public"."metodos_pago" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."metodos_pago_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pagos" (
    "id" bigint NOT NULL,
    "reserva_id" bigint,
    "piloto_id" bigint,
    "monto" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pagos" OWNER TO "postgres";


ALTER TABLE "public"."pagos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."pagos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."perfil_roles" (
    "id" bigint NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "rol_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."perfil_roles" OWNER TO "postgres";


ALTER TABLE "public"."perfil_roles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."perfil_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."perfil_valores" (
    "id" bigint NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "valor_id" bigint NOT NULL,
    "cantidad" integer DEFAULT 1 NOT NULL,
    "reserva_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."perfil_valores" OWNER TO "postgres";


ALTER TABLE "public"."perfil_valores" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."perfil_valores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."piloto_pagos" (
    "id" integer NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "fecha" "date" NOT NULL,
    "metodo_pago_id" integer NOT NULL,
    "monto" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."piloto_pagos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."piloto_pagos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."piloto_pagos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."piloto_pagos_id_seq" OWNED BY "public"."piloto_pagos"."id";



CREATE TABLE IF NOT EXISTS "public"."pilotos" (
    "id" bigint NOT NULL,
    "perfil_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pilotos" OWNER TO "postgres";


ALTER TABLE "public"."pilotos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."pilotos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."reserva_pagos" (
    "id" integer NOT NULL,
    "reserva_id" integer NOT NULL,
    "metodo_pago_id" integer NOT NULL,
    "monto" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reserva_pagos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."reserva_pagos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reserva_pagos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reserva_pagos_id_seq" OWNED BY "public"."reserva_pagos"."id";



CREATE TABLE IF NOT EXISTS "public"."reserva_servicios" (
    "id" bigint NOT NULL,
    "reserva_id" bigint NOT NULL,
    "valor_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reserva_servicios" OWNER TO "postgres";


ALTER TABLE "public"."reserva_servicios" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."reserva_servicios_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."reservas" (
    "id" bigint NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "cantidad" integer NOT NULL,
    "fecha" "date" NOT NULL,
    "horario_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "telefono" bigint,
    "abono" integer,
    "volo" boolean DEFAULT false,
    "google_event_id" "text"
);


ALTER TABLE "public"."reservas" OWNER TO "postgres";


ALTER TABLE "public"."reservas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."reservas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."reservas_personas" (
    "id" bigint NOT NULL,
    "reserva_id" bigint,
    "nombre" character varying(255) NOT NULL,
    "edad" integer,
    "peso" integer,
    "sin_camara" boolean DEFAULT false,
    "camara_normal" boolean DEFAULT false,
    "camara_360" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "perfil_id" "uuid",
    "cumpleanero" boolean DEFAULT false
);


ALTER TABLE "public"."reservas_personas" OWNER TO "postgres";


ALTER TABLE "public"."reservas_personas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."reservas_personas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" bigint NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


ALTER TABLE "public"."roles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."valores" (
    "id" bigint NOT NULL,
    "servicio" character varying(255) NOT NULL,
    "monto" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "piloto" boolean DEFAULT false NOT NULL,
    "pasajero" boolean DEFAULT false NOT NULL,
    "descuento" boolean DEFAULT false
);


ALTER TABLE "public"."valores" OWNER TO "postgres";


ALTER TABLE "public"."valores" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."valores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."gastos_diarios" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."gastos_diarios_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."piloto_pagos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."piloto_pagos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reserva_pagos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reserva_pagos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."deuda_detalles"
    ADD CONSTRAINT "deuda_detalles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deuda"
    ADD CONSTRAINT "deuda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gastos_diarios"
    ADD CONSTRAINT "gastos_diarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."horarios"
    ADD CONSTRAINT "horarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metodos_pago"
    ADD CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfil_roles"
    ADD CONSTRAINT "perfil_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfil_valores"
    ADD CONSTRAINT "perfil_valores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."piloto_pagos"
    ADD CONSTRAINT "piloto_pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pilotos"
    ADD CONSTRAINT "pilotos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reserva_pagos"
    ADD CONSTRAINT "reserva_pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reserva_servicios"
    ADD CONSTRAINT "reserva_servicios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas_personas"
    ADD CONSTRAINT "reservas_personas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."valores"
    ADD CONSTRAINT "valores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deuda_detalles"
    ADD CONSTRAINT "deuda_detalles_deuda_id_fkey" FOREIGN KEY ("deuda_id") REFERENCES "public"."deuda"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deuda_detalles"
    ADD CONSTRAINT "deuda_detalles_valor_id_fkey" FOREIGN KEY ("valor_id") REFERENCES "public"."valores"("id");



ALTER TABLE ONLY "public"."deuda"
    ADD CONSTRAINT "deuda_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "public"."metodos_pago"("id");



ALTER TABLE ONLY "public"."deuda"
    ADD CONSTRAINT "deuda_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."deuda"
    ADD CONSTRAINT "deuda_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gastos_diarios"
    ADD CONSTRAINT "gastos_diarios_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "public"."metodos_pago"("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_piloto_id_fkey" FOREIGN KEY ("piloto_id") REFERENCES "public"."pilotos"("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id");



ALTER TABLE ONLY "public"."perfil_roles"
    ADD CONSTRAINT "perfil_roles_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfil_roles"
    ADD CONSTRAINT "perfil_roles_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfil_valores"
    ADD CONSTRAINT "perfil_valores_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."perfil_valores"
    ADD CONSTRAINT "perfil_valores_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id");



ALTER TABLE ONLY "public"."perfil_valores"
    ADD CONSTRAINT "perfil_valores_valor_id_fkey" FOREIGN KEY ("valor_id") REFERENCES "public"."valores"("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."piloto_pagos"
    ADD CONSTRAINT "piloto_pagos_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "public"."metodos_pago"("id");



ALTER TABLE ONLY "public"."piloto_pagos"
    ADD CONSTRAINT "piloto_pagos_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."pilotos"
    ADD CONSTRAINT "pilotos_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."reserva_pagos"
    ADD CONSTRAINT "reserva_pagos_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "public"."metodos_pago"("id");



ALTER TABLE ONLY "public"."reserva_pagos"
    ADD CONSTRAINT "reserva_pagos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reserva_servicios"
    ADD CONSTRAINT "reserva_servicios_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reserva_servicios"
    ADD CONSTRAINT "reserva_servicios_valor_id_fkey" FOREIGN KEY ("valor_id") REFERENCES "public"."valores"("id");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "public"."horarios"("id");



ALTER TABLE ONLY "public"."reservas_personas"
    ADD CONSTRAINT "reservas_personas_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."reservas_personas"
    ADD CONSTRAINT "reservas_personas_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE CASCADE;



CREATE POLICY "Acceso total para autenticados" ON "public"."perfil_valores" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Autenticados pueden actualizar perfil_valores" ON "public"."perfil_valores" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Autenticados pueden eliminar perfil_valores" ON "public"."perfil_valores" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Autenticados pueden insertar perfil_valores" ON "public"."perfil_valores" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Autenticados pueden leer perfil_valores" ON "public"."perfil_valores" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "allow all" ON "public"."gastos_diarios" USING (true) WITH CHECK (true);



CREATE POLICY "allow all" ON "public"."piloto_pagos" USING (true) WITH CHECK (true);



CREATE POLICY "allow all" ON "public"."reserva_pagos" USING (true) WITH CHECK (true);



ALTER TABLE "public"."deuda" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deuda_detalles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "full access deuda" ON "public"."deuda" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full access horarios" ON "public"."horarios" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full access pagos" ON "public"."pagos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full access pilotos" ON "public"."pilotos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full access reserva_servicios" ON "public"."reserva_servicios" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full access reservas" ON "public"."reservas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full access reservas_personas" ON "public"."reservas_personas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full access valores" ON "public"."valores" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full deuda" ON "public"."deuda" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full deuda_detalles" ON "public"."deuda_detalles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full horarios" ON "public"."horarios" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full metodos_pago" ON "public"."metodos_pago" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full perfil_roles" ON "public"."perfil_roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full reserva_servicios" ON "public"."reserva_servicios" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full reservas" ON "public"."reservas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full reservas_personas" ON "public"."reservas_personas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full roles" ON "public"."roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "full valores" ON "public"."valores" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."gastos_diarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."horarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metodos_pago" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfil_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfil_valores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles_update_authenticated" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "permitir delete perfiles" ON "public"."perfiles" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "permitir insert perfiles" ON "public"."perfiles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "permitir select perfiles" ON "public"."perfiles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."piloto_pagos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pilotos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reserva_pagos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reserva_servicios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservas_personas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."valores" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."deuda" TO "anon";
GRANT ALL ON TABLE "public"."deuda" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."deuda" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."deuda_detalles" TO "anon";
GRANT ALL ON TABLE "public"."deuda_detalles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."deuda_detalles" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."deuda_detalles_id_seq" TO "authenticated";



GRANT SELECT,USAGE ON SEQUENCE "public"."deuda_id_seq" TO "authenticated";



GRANT ALL ON TABLE "public"."gastos_diarios" TO "anon";
GRANT ALL ON TABLE "public"."gastos_diarios" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."gastos_diarios" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."gastos_diarios_id_seq" TO "anon";
GRANT SELECT,USAGE ON SEQUENCE "public"."gastos_diarios_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."horarios" TO "anon";
GRANT ALL ON TABLE "public"."horarios" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."horarios" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."horarios_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."metodos_pago" TO "anon";
GRANT ALL ON TABLE "public"."metodos_pago" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."metodos_pago" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."metodos_pago_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pagos" TO "anon";
GRANT ALL ON TABLE "public"."pagos" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pagos" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."pagos_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."perfil_roles" TO "anon";
GRANT ALL ON TABLE "public"."perfil_roles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."perfil_roles" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."perfil_roles_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."perfil_valores" TO "anon";
GRANT ALL ON TABLE "public"."perfil_valores" TO "authenticated";
GRANT ALL ON TABLE "public"."perfil_valores" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."perfil_valores_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."piloto_pagos" TO "anon";
GRANT ALL ON TABLE "public"."piloto_pagos" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."piloto_pagos" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."piloto_pagos_id_seq" TO "anon";
GRANT SELECT,USAGE ON SEQUENCE "public"."piloto_pagos_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pilotos" TO "anon";
GRANT ALL ON TABLE "public"."pilotos" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pilotos" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."pilotos_id_seq" TO "authenticated";



GRANT ALL ON TABLE "public"."reserva_pagos" TO "anon";
GRANT ALL ON TABLE "public"."reserva_pagos" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reserva_pagos" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."reserva_pagos_id_seq" TO "anon";
GRANT SELECT,USAGE ON SEQUENCE "public"."reserva_pagos_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reserva_servicios" TO "anon";
GRANT ALL ON TABLE "public"."reserva_servicios" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reserva_servicios" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."reserva_servicios_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reservas" TO "anon";
GRANT ALL ON TABLE "public"."reservas" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reservas" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."reservas_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reservas_personas" TO "anon";
GRANT ALL ON TABLE "public"."reservas_personas" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reservas_personas" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."reservas_personas_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."roles_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."valores" TO "anon";
GRANT ALL ON TABLE "public"."valores" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."valores" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."valores_id_seq" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";



































drop extension if exists "pg_net";


