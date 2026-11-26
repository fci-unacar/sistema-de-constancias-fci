# Guía de despliegue y entrega — Sistema de Constancias FCI

Pasos para publicar el sistema en internet con servicios gratuitos (excepto
el dominio) y entregarlo a la Facultad sin vincular cuentas personales.

Cada fase deja algo funcionando antes de pasar a la siguiente. Los nombres
de menús de cada servicio pueden variar un poco con el tiempo.

| Pieza            | Servicio                    | Costo                |
| ---------------- | --------------------------- | -------------------- |
| Cuenta dueña     | Gmail                       | Gratis               |
| Credenciales     | Bitwarden                   | Gratis               |
| Código           | GitHub (organización)       | Gratis               |
| Base de datos    | Supabase                    | Gratis               |
| API              | Render                      | Gratis               |
| Página (frontend)| Vercel                      | Gratis               |
| Correos (códigos)| SMTP de Gmail               | Gratis               |
| Respaldos        | GitHub Actions              | Gratis               |
| Dominio          | Subdominio de TI o compra   | Gratis o ~10–12 USD/año |

---

## Fase 0 — Preparación (en tu equipo)

- [ ] Terminar las pruebas e integrar las ramas:
      `prueba-nuevas-constancias` → `reorganizacion-despliegue` → `main`.
      Render y Vercel publican desde `main`.
- [ ] Tener a la mano el README del proyecto (secciones "Inicio de sesión"
      y "Alta de usuarios").

## Fase 1 — Cuenta dueña

Una sola cuenta, que no es de ninguna persona, es dueña de todo.

- [ ] Crear un Gmail nuevo, por ejemplo `sistema.constancias.fci@gmail.com`.
- [ ] Teléfono y correo de recuperación **de la Facultad**, no personales.
- [ ] Activar la verificación en dos pasos.
- [ ] Guardar los códigos de respaldo de la verificación en dos pasos.
- [ ] Generar una **contraseña de aplicación**
      (Cuenta de Google → Seguridad → Contraseñas de aplicaciones).
      Se usa para enviar los códigos de acceso (Fase 3).
- [ ] Crear una cuenta gratuita de **Bitwarden** con ese Gmail y guardar
      ahí todo lo anterior. A partir de aquí, cada contraseña o llave nueva
      va a Bitwarden.

## Fase 2 — GitHub

- [ ] Crear una cuenta de GitHub con el Gmail dueño.
- [ ] Desde esa cuenta, crear una **organización gratuita** (ej. `fci-unacar`).
- [ ] Invitar a tu cuenta personal a la organización como miembro.
- [ ] En el repositorio actual: Settings → General → Transfer ownership →
      transferir a la organización (conserva historial y ramas).
- [ ] Actualizar el remoto en tu equipo:

  ```bash
  git remote set-url origin https://github.com/fci-unacar/sistema-de-constancias-fci.git
  ```

## Fase 3 — Supabase (base de datos y login)

- [ ] Entrar a supabase.com con la cuenta de GitHub de la organización.
- [ ] Crear un proyecto en plan **Free** (región de EE. UU. más cercana).
- [ ] Guardar en Bitwarden la **contraseña de la base de datos**.
- [ ] En **SQL Editor**, ejecutar las migraciones en este orden:
  1. `supabase/migrations/20260923000000_esquema_inicial.sql`
  2. `supabase/migrations/20260924000000_usuarios_autorizados.sql`
  3. `supabase/migrations/20261125000000_permisos_service_role.sql`
     (sin este, la API recibe "permission denied" en proyectos nuevos)
  4. `supabase/migrations/20261125010000_funciones_api.sql`
     (folio atómico, descargas e importación de respaldos)
  5. `supabase/migrations/20261125020000_tipos_constancia.sql`
     (permite buena conducta y terminación de estudios)
  6. `supabase/migrations/20261125030000_calendario.sql`
     (calendario escolar compartido y bucket privado para su PDF)
- [ ] Guardar en Bitwarden, desde **Project Settings → API**:
  - **Project URL**
  - **service_role key** (secreta: nunca va en el frontend ni en Git)
- [ ] **Authentication → Sign In / Providers**: apagar
      "Allow new users to sign up".
- [ ] **Authentication → Emails → SMTP Settings**:

  | Campo      | Valor                                  |
  | ---------- | -------------------------------------- |
  | Host       | `smtp.gmail.com`                       |
  | Puerto     | `465`                                  |
  | Usuario    | el Gmail dueño                         |
  | Contraseña | la contraseña de aplicación (Fase 1)   |
  | Remitente  | `Sistema de Constancias FCI`           |

- [ ] **Authentication → Emails → Templates → Magic Link**: pegar la
      plantilla (debe incluir `{{ .Token }}`, que es el código):

  ```html
  <h2>Sistema de Constancias FCI</h2>
  <p>Tu código para crear o cambiar tu contraseña es:</p>
  <p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
  <p>Vence en una hora. Si no lo pediste, ignora este correo.</p>
  ```

- [ ] Dar de alta tu correo institucional para probar:

  ```sql
  insert into public.usuarios_autorizados (email, nombre)
  values ('tu.correo@delfin.unacar.mx', 'Tu Nombre');
  ```

> **Límites del plan gratuito:** el proyecto se **pausa tras 7 días sin
> uso** (se reactiva con un clic en el panel) y no incluye respaldos
> automáticos. Ambos se cubren en la Fase 6.

## Fase 4 — Render (API)

- [ ] Entrar a render.com con la cuenta de GitHub de la organización.
- [ ] New → **Blueprint** → elegir el repositorio. Render lee
      `render.yaml` y crea el servicio en plan gratuito, en Virginia (la
      misma zona que Supabase `us-east-1`). Si se crea a mano como "Web
      Service", usar esos mismos valores (Docker, root `api`, health check
      `/health`) y **revisar que el plan sea Free**: Render preselecciona
      uno de pago.
- [ ] Capturar las variables de entorno:

  | Variable                    | Valor                          |
  | --------------------------- | ------------------------------ |
  | `SUPABASE_URL`              | Project URL de Supabase        |
  | `SUPABASE_SERVICE_ROLE_KEY` | service_role key de Supabase   |
  | `FRONTEND_URL`              | pendiente (se llena en Fase 5) |

- [ ] Abrir `https://<servicio>.onrender.com/health`: debe responder
      `"ok": true` y ya no decir "no configurado".

> En el plan gratuito la API se duerme tras 15 min sin uso; la primera
> petición del día tarda ~1 minuto en responder.

## Fase 5 — Vercel (página)

- [ ] Entrar a vercel.com con la cuenta de GitHub de la organización.
- [ ] Add New → Project → elegir el repositorio.
  - **Root Directory:** `frontend`
  - **Framework:** Vite
- [ ] Variables de entorno:

  | Variable            | Valor                                          |
  | ------------------- | ---------------------------------------------- |
  | `VITE_API_URL`      | `https://<servicio>.onrender.com` (sin `/` final) |
  | `VITE_AUTH_ENABLED` | `true`                                         |

- [ ] Publicar. Anotar la URL (ej. `constancias-fci.vercel.app`).
- [ ] En Render, poner esa URL en `FRONTEND_URL` (sin `/` final). Si no
      coincide exacto, el navegador bloquea las llamadas a la API (CORS).
- [ ] Probar el flujo completo:
  1. "Crear o cambiar mi contraseña" con tu correo institucional.
  2. Revisar que llegue el código (y que no caiga en "Correo no deseado").
  3. Crear la contraseña y entrar.

> Con `VITE_AUTH_ENABLED=true` el historial y los programas se guardan en
> la base de datos (ver Fase 8): es el mismo en todos los equipos.

## Fase 6 — Respaldos y mantener activo

- [ ] En GitHub: repositorio → Settings → Secrets and variables → Actions →
      crear dos secrets:
  - `SUPABASE_DB_URL`: en Supabase, botón **Connect** → **Session pooler**
    → copiar la URI y poner la contraseña de la base en lugar de
    `[YOUR-PASSWORD]`. Tiene que ser la del *pooler*: la conexión directa
    solo funciona por IPv6 y los servidores de GitHub no lo tienen.
  - `RESPALDO_PASSPHRASE`: una frase larga inventada (guardarla en
    Bitwarden). El repositorio es público y cualquiera con cuenta de
    GitHub podría descargar el respaldo, por eso se sube cifrado; sin esta
    frase no se puede abrir. Para restaurar:
    `gpg --decrypt constancias-fci-AAAA-MM-DD.sql.gpg > respaldo.sql`.
- [ ] En la pestaña **Actions**, ejecutar a mano "Respaldo de base de datos"
      y confirmar que termina bien.
- [ ] Desde ahí corre solo cada domingo, guarda los respaldos 30 días y la
      conexión semanal ayuda a que Supabase no se pause.

> GitHub desactiva las tareas programadas si el repositorio pasa 60 días
> sin cambios. Si pasa, se reactivan desde la pestaña Actions.

## Fase 7 — Dominio (único costo)

- [ ] **Primero:** pedir a TI de la UNACAR un subdominio
      (ej. `constancias.fci.unacar.mx`). Es gratis y oficial; solo
      agregan un registro CNAME hacia Vercel.
- [ ] **Si no es posible:** comprar el dominio **con la cuenta dueña**
      (`.com` en Cloudflare o Namecheap ~10–12 USD/año).
  - [ ] Activar la renovación automática.
  - [ ] Anotar la fecha de vencimiento.
- [ ] Vercel → Project → Settings → Domains → agregar el dominio y
      configurar los registros DNS que indique.
- [ ] Render: cambiar `FRONTEND_URL` al dominio nuevo.
- [ ] Supabase → Authentication → URL Configuration → **Site URL**: poner el
      dominio nuevo.

## Fase 8 — Desarrollo pendiente antes de usar datos reales

- [x] Endpoints de la API para constancias y programas (protegidos con
      `requireAuth`, ver `api/src/constancias.js`).
- [x] `useHistorial` y `useProgramas` usan la API cuando el login real está
      activado. El historial es compartido y el folio sale de la secuencia
      de la base de datos (no se repite entre equipos).
- [ ] Migrar lo ya generado: "Exportar respaldo" en el equipo que se usaba
      antes → "Importar respaldo" en el sistema nuevo. La importación salta
      los folios que ya existan y las constancias de ejemplo, y adelanta el
      folio para que el siguiente no choque.
- [x] El calendario escolar (fechas y PDF oficial) también vive en la base
      de datos: tabla `configuracion` y bucket privado `archivos` de
      Storage (ver `api/src/calendario.js`).

## Fase 9 — Entrega a la Facultad

- [ ] Dar de alta los correos de la Secretaría en `usuarios_autorizados`.
- [ ] Compartir la bóveda de Bitwarden con la persona responsable. Debe
      contener:
  - [ ] Gmail dueño + códigos de respaldo de la verificación en dos pasos
  - [ ] Contraseña de aplicación de Gmail
  - [ ] Contraseña de la base de datos de Supabase
  - [ ] service_role key de Supabase
  - [ ] Acceso a la cuenta del dominio (si se compró)
- [ ] Cambiar la contraseña del Gmail dueño frente a la persona responsable
      (o que ella la cambie).
- [ ] Salir de la organización de GitHub. Como Supabase, Render y Vercel se
      abren con esa cuenta de GitHub, al salir se pierde el acceso a todo.
- [ ] Firmar un acta de entrega con:
  - servicios usados y su plan,
  - fecha de vencimiento del dominio,
  - constancia de que ya no tienes acceso.

---

## Referencia rápida para la Facultad

| Tarea                    | Dónde                                                          |
| ------------------------ | -------------------------------------------------------------- |
| Dar de alta un usuario   | Supabase → SQL Editor → `insert into public.usuarios_autorizados ...` |
| Quitar acceso            | `update public.usuarios_autorizados set activo = false where email = '...';` |
| Supabase pausado         | Panel de Supabase → proyecto → "Restore"                       |
| Descargar un respaldo    | GitHub → Actions → "Respaldo de base de datos" → artifact      |
| Reactivar respaldos      | GitHub → Actions → habilitar el workflow                       |
| Renovar dominio          | Cuenta del registrador (si se compró)                          |
