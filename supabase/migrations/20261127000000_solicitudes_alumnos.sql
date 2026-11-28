-- =====================================================================
-- Solicitudes de constancia hechas por los alumnos (panel de alumnos).
--
-- El alumno entra con su correo institucional (código al correo, sin
-- contraseña), llena nombre, matrícula, programa y tipo de constancia, y
-- sube su voucher de pago. La solicitud cae en la bandeja de Secretaría,
-- que la revisa, genera la constancia (queda ligada en constancia_id) o la
-- rechaza con un motivo. El alumno ve el estado desde su panel.
--
-- El voucher va en el bucket privado "vouchers". Como el resto, solo la
-- API lo lee y lo escribe con la llave service_role.
-- =====================================================================

create table if not exists public.solicitudes (
  id              uuid primary key default gen_random_uuid(),
  -- Correo con el que el alumno inició sesión (lo pone la API, no el alumno).
  alumno_email    text not null check (alumno_email = lower(alumno_email)),
  nombre          text not null check (length(nombre) between 1 and 200),
  matricula       text not null check (length(matricula) between 1 and 20),
  programa        text not null check (length(programa) between 1 and 200),
  tipo            text not null
                  check (tipo in ('normal', 'promedio', 'buena-conducta', 'terminacion')),
  -- Ruta del voucher dentro del bucket "vouchers".
  voucher_ruta    text not null,
  voucher_nombre  text not null,
  voucher_tipo    text not null
                  check (voucher_tipo in ('application/pdf', 'image/jpeg', 'image/png')),
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'lista', 'rechazada')),
  motivo_rechazo  text,
  -- Constancia que Secretaría generó para atender la solicitud.
  constancia_id   uuid references public.constancias (id) on delete set null,
  -- Correo de quien de Secretaría la atendió.
  atendida_por    text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create index if not exists solicitudes_alumno_idx on public.solicitudes (alumno_email, creado_en desc);
create index if not exists solicitudes_estado_idx on public.solicitudes (estado, creado_en desc);

-- Igual que el resto: RLS sin políticas, cerrada al navegador.
alter table public.solicitudes enable row level security;

grant select, insert, update, delete on public.solicitudes to service_role;

-- Bucket privado para los vouchers: PDF o foto, máximo 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vouchers', 'vouchers', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
