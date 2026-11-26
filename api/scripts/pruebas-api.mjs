/**
 * Pruebas de punta a punta de la API: autenticación, historial
 * y folios (incluida concurrencia), importación de respaldos, programas,
 * calendario y PDF, firmantes, y que la base no se pueda leer con la llave pública.
 *
 * ⚠️ USA LA BASE DE DATOS REAL (no hay una de pruebas). Por eso:
 *   - Pide confirmación explícita (PRUEBAS_CONFIRMAR=si).
 *   - Crea 2 usuarios temporales @example.com y los borra al final.
 *   - Guarda el calendario y el PDF actuales y los restaura al final.
 *   - Borra solo las constancias que ella misma creó.
 *   - El folio SÍ avanza (las secuencias de Postgres no se regresan solas):
 *     al terminar imprime el SQL para dejarlo donde estaba. Córrelas cuando
 *     nadie esté generando constancias.
 *
 * Uso, desde api/ y con la API corriendo en local (npm run dev):
 *   PRUEBAS_CONFIRMAR=si SUPABASE_PUBLISHABLE_KEY=sb_publishable_... npm run test:e2e
 *
 * SUPABASE_PUBLISHABLE_KEY es la llave pública del proyecto (Project
 * Settings → API Keys); se usa para comprobar que con ella NO se puede leer
 * nada. Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de api/.env. Opcional:
 * API_URL (por defecto http://localhost:3000).
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (process.env.PRUEBAS_CONFIRMAR !== 'si') {
  console.error('Estas pruebas usan la base de datos REAL. Lee el encabezado de este archivo y');
  console.error('vuelve a correrlas con PRUEBAS_CONFIRMAR=si.');
  process.exit(1);
}
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!PUBLISHABLE || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_PUBLISHABLE_KEY (variable de entorno) o SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (api/.env).');
  process.exit(1);
}

const API = process.env.API_URL ?? 'http://localhost:3000';
const SB_URL = process.env.SUPABASE_URL;
const admin = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const resultados = [];
function registrar(area, prueba, ok, detalle) {
  resultados.push({ area, prueba, ok: ok === true ? 'PASA' : ok === 'obs' ? 'OBS' : 'FALLA', detalle: String(detalle ?? '') });
}
/** Constancias que crea esta batería, para borrar solo esas al final. */
const creadasPorPrueba = new Set();
const FOLIOS_IMPORTADOS_PRUEBA = ['FCI-2026-5000', 'FCI-2026-5001', 'FCI-2026-6001', 'FCI-2026-6101'];

async function api(metodo, ruta, { token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
  const r = await fetch(API + ruta, { method: metodo, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const tipo = r.headers.get('content-type') ?? '';
  const datos = tipo.includes('json') ? await r.json().catch(() => null) : tipo.includes('pdf') ? Buffer.from(await r.arrayBuffer()) : await r.text();
  if (metodo === 'POST' && ruta === '/constancias' && r.status === 201) creadasPorPrueba.add(datos.constancia.id);
  return { status: r.status, datos, headers: r.headers };
}
const pass = () => randomBytes(18).toString('base64url');

// ---------------------------------------------------------------------
// Estado previo (para restaurar)
// ---------------------------------------------------------------------
const previas = (await admin.from('constancias').select('id')).data.map((x) => x.id);
const folioPrevio = Number((await admin.rpc('folio_siguiente_vista')).data?.split('-')[2]);
const calPrevio = (await admin.from('configuracion').select('*').eq('clave', 'calendario').maybeSingle()).data;
const plantPrevia = (await admin.from('configuracion').select('*').eq('clave', 'plantillas').maybeSingle()).data;
const pdfPrevioRes = await admin.storage.from('archivos').download('calendario/calendario.pdf');
const pdfPrevio = pdfPrevioRes.data ? Buffer.from(await pdfPrevioRes.data.arrayBuffer()) : null;
console.log(`Estado previo: ${previas.length} constancias, calendario ${calPrevio ? 'sí' : 'no'}, PDF ${pdfPrevio ? pdfPrevio.length + ' bytes' : 'no'}`);

const A = { email: 'prueba.api.autorizada@example.com', password: pass() };
const B = { email: 'prueba.api.noautorizada@example.com', password: pass() };
const idsUsuarios = [];

try {
  // Usuarios de prueba
  for (const u of [A, B]) {
    const r = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (r.error) throw new Error('No se pudo crear usuario de prueba: ' + r.error.message);
    idsUsuarios.push(r.data.user.id);
  }
  await admin.from('usuarios_autorizados').insert({ email: A.email, nombre: 'Prueba automática' });

  // -------------------------------------------------------------------
  // Salud y CORS
  // -------------------------------------------------------------------
  let r = await api('GET', '/health');
  registrar('Salud', 'GET /health responde y la base contesta', r.status === 200 && r.datos?.supabase === 'conectado', `${r.status} ${JSON.stringify(r.datos)}`);

  const cors = async (origen) =>
    (await fetch(API + '/constancias', { method: 'OPTIONS', headers: { Origin: origen, 'Access-Control-Request-Method': 'GET' } })).headers.get('access-control-allow-origin');
  registrar('CORS', 'Origen permitido (frontend) recibe permiso', (await cors('http://localhost:5173')) === 'http://localhost:5173', await cors('http://localhost:5173'));
  const ajeno = await cors('https://sitio-malicioso.example');
  registrar('CORS', 'Origen ajeno NO recibe permiso', ajeno !== 'https://sitio-malicioso.example', ajeno ?? '(sin cabecera)');

  // -------------------------------------------------------------------
  // Autenticación
  // -------------------------------------------------------------------
  const protegidas = [['GET', '/constancias'], ['POST', '/constancias'], ['PATCH', '/constancias/00000000-0000-0000-0000-000000000000'], ['POST', '/constancias/importar'], ['GET', '/programas'], ['GET', '/calendario'], ['PUT', '/calendario'], ['GET', '/calendario/pdf'], ['PUT', '/calendario/pdf'], ['GET', '/plantillas'], ['PUT', '/plantillas'], ['GET', '/auth/me']];
  const sinToken = [];
  for (const [m, p] of protegidas) sinToken.push((await api(m, p)).status);
  registrar('Auth', `Las ${protegidas.length} rutas protegidas rechazan sin sesión (401)`, sinToken.every((s) => s === 401), sinToken.join(','));
  r = await api('GET', '/constancias', { token: 'token.falso.123' });
  registrar('Auth', 'Token inválido → 401', r.status === 401, r.status);

  r = await api('POST', '/auth/login', { body: { email: A.email, password: 'incorrecta-123' } });
  registrar('Auth', 'Login con contraseña incorrecta → 401', r.status === 401, `${r.status} ${r.datos?.error}`);
  r = await api('POST', '/auth/login', { body: { email: 'no.existe@example.com', password: 'loquesea-123' } });
  registrar('Auth', 'Login de correo inexistente → mismo 401 (no revela si existe)', r.status === 401 && r.datos?.error === 'Correo o contraseña incorrectos.', `${r.status} ${r.datos?.error}`);
  r = await api('POST', '/auth/login', { body: {} });
  registrar('Auth', 'Login sin datos → 400', r.status === 400, r.status);
  r = await api('POST', '/auth/login', { body: { email: B.email, password: B.password } });
  registrar('Auth', 'Usuario con cuenta pero NO autorizado → 403', r.status === 403, `${r.status} ${r.datos?.error}`);

  r = await api('POST', '/auth/login', { body: { email: A.email, password: A.password } });
  const sesion = r.datos;
  registrar('Auth', 'Login correcto de usuario autorizado → 200 con tokens', r.status === 200 && !!sesion?.accessToken && !!sesion?.refreshToken, r.status);
  const T = sesion.accessToken;
  r = await api('GET', '/auth/me', { token: T });
  registrar('Auth', 'GET /auth/me devuelve el usuario', r.status === 200 && r.datos?.user?.email === A.email, `${r.status} ${r.datos?.user?.email}`);
  r = await api('POST', '/auth/refresh', { body: { refreshToken: sesion.refreshToken } });
  registrar('Auth', 'Refresh de sesión → 200 con token nuevo', r.status === 200 && !!r.datos?.accessToken, r.status);
  const T2 = r.datos?.accessToken ?? T;
  r = await api('POST', '/auth/refresh', { body: { refreshToken: 'falso' } });
  registrar('Auth', 'Refresh con token falso → 401', r.status === 401, r.status);

  r = await api('POST', '/auth/codigo', { body: { email: 'no.autorizado.nunca@example.com' } });
  registrar('Auth', 'Pedir código para correo no autorizado → respuesta genérica, no revela', r.status === 200 && /Si tu correo está registrado/.test(r.datos?.mensaje), r.status);
  r = await api('POST', '/auth/codigo', { body: {} });
  registrar('Auth', 'Pedir código sin correo → 400', r.status === 400, r.status);
  r = await api('POST', '/auth/crear-password', { body: { email: A.email, codigo: '000000', password: 'corta' } });
  registrar('Auth', 'Crear contraseña de menos de 8 caracteres → 400', r.status === 400, `${r.status} ${r.datos?.error}`);
  r = await api('POST', '/auth/crear-password', { body: { email: A.email, codigo: '000000', password: 'SuficientementeLarga-1' } });
  registrar('Auth', 'Crear contraseña con código inválido → 401', r.status === 401, `${r.status} ${r.datos?.error}`);

  // Baja inmediata
  await admin.from('usuarios_autorizados').update({ activo: false }).eq('email', A.email);
  r = await api('GET', '/constancias', { token: T2 });
  registrar('Auth', 'Desactivar un correo corta el acceso aunque tenga sesión abierta (403)', r.status === 403, r.status);
  await admin.from('usuarios_autorizados').update({ activo: true }).eq('email', A.email);
  r = await api('GET', '/constancias', { token: T2 });
  registrar('Auth', 'Reactivarlo devuelve el acceso', r.status === 200, r.status);

  // -------------------------------------------------------------------
  // Constancias
  // -------------------------------------------------------------------
  r = await api('GET', '/constancias', { token: T2 });
  registrar('Constancias', 'Listar historial → 200 con folio siguiente', r.status === 200 && Array.isArray(r.datos?.constancias) && /^FCI-\d{4}-\d+$/.test(r.datos?.siguienteFolio), `${r.status} siguiente=${r.datos?.siguienteFolio}`);
  const vista = r.datos.siguienteFolio;

  for (const [desc, body] of [['tipo inválido', { tipo: 'otro', data: { a: 1 } }], ['sin datos', { tipo: 'normal' }], ['datos como lista', { tipo: 'normal', data: [1] }], ['cuerpo vacío', undefined]]) {
    r = await api('POST', '/constancias', { token: T2, body });
    registrar('Constancias', `Generar con ${desc} → 400`, r.status === 400, r.status);
  }

  const creadas = [];
  for (const tipo of ['normal', 'promedio', 'buena-conducta', 'terminacion']) {
    r = await api('POST', '/constancias', { token: T2, body: { tipo, data: { prueba: true, tipo } } });
    if (r.status === 201) creadas.push(r.datos.constancia);
    registrar('Constancias', `Generar tipo "${tipo}" → 201`, r.status === 201 && r.datos?.constancia?.tipo === tipo, `${r.status} ${r.datos?.constancia?.folio ?? r.datos?.error}`);
  }
  registrar('Constancias', 'El primer folio generado coincide con el que mostraba el formulario', creadas[0]?.folio === vista, `vista=${vista} real=${creadas[0]?.folio}`);
  const nums = creadas.map((c) => Number(c.folio.split('-')[2]));
  registrar('Constancias', 'Folios consecutivos sin huecos', nums.every((n, i) => i === 0 || n === nums[i - 1] + 1), nums.join(','));
  const c0 = creadas[0];
  registrar('Constancias', 'Nueva constancia: vigente, 1 descarga, fecha de hoy, no es ejemplo', c0.estado === 'vigente' && c0.descargas === 1 && c0.isExample === false && /^\d{4}-\d{2}-\d{2}$/.test(c0.fechaGeneracion), JSON.stringify({ e: c0.estado, d: c0.descargas, f: c0.fechaGeneracion }));

  // Concurrencia: 10 generaciones simultáneas
  const simultaneas = await Promise.all(Array.from({ length: 10 }, (_, i) => api('POST', '/constancias', { token: T2, body: { tipo: 'normal', data: { paralela: i } } })));
  const foliosPar = simultaneas.filter((x) => x.status === 201).map((x) => x.datos.constancia.folio);
  registrar('Constancias', '10 generaciones al mismo tiempo → 10 folios distintos (no se repiten)', foliosPar.length === 10 && new Set(foliosPar).size === 10, `${foliosPar.length} creadas, ${new Set(foliosPar).size} distintas`);

  r = await api('PATCH', `/constancias/${c0.id}`, { token: T2, body: { estado: 'anulada' } });
  registrar('Constancias', 'Anular → 200, estado anulada', r.status === 200 && r.datos?.constancia?.estado === 'anulada', `${r.status} ${r.datos?.constancia?.estado}`);
  r = await api('PATCH', `/constancias/${c0.id}`, { token: T2, body: { estado: 'vigente' } });
  registrar('Constancias', 'Reactivar → 200, estado vigente', r.status === 200 && r.datos?.constancia?.estado === 'vigente', `${r.status} ${r.datos?.constancia?.estado}`);
  r = await api('PATCH', `/constancias/${c0.id}`, { token: T2, body: { estado: 'borrada' } });
  registrar('Constancias', 'Estado inválido → 400', r.status === 400, r.status);
  r = await api('PATCH', '/constancias/no-es-uuid', { token: T2, body: { estado: 'anulada' } });
  registrar('Constancias', 'Id con formato inválido → 404', r.status === 404, r.status);
  r = await api('PATCH', '/constancias/00000000-0000-0000-0000-000000000000', { token: T2, body: { estado: 'anulada' } });
  registrar('Constancias', 'Id que no existe → 404', r.status === 404, r.status);

  r = await api('POST', `/constancias/${c0.id}/descargas`, { token: T2 });
  registrar('Constancias', 'Registrar descarga → contador 2', r.status === 200 && r.datos?.constancia?.descargas === 2, `${r.status} ${r.datos?.constancia?.descargas}`);
  await Promise.all(Array.from({ length: 5 }, () => api('POST', `/constancias/${c0.id}/descargas`, { token: T2 })));
  const tras = (await admin.from('constancias').select('descargas').eq('id', c0.id).single()).data.descargas;
  registrar('Constancias', '5 descargas al mismo tiempo no se pierden (2 → 7)', tras === 7, `descargas=${tras}`);
  r = await api('POST', '/constancias/00000000-0000-0000-0000-000000000000/descargas', { token: T2 });
  registrar('Constancias', 'Descarga de id inexistente → 404', r.status === 404, r.status);

  // Importar respaldo
  r = await api('POST', '/constancias/importar', { token: T2, body: { constancias: 'no' } });
  registrar('Importar', 'Respaldo que no es lista → 400', r.status === 400, r.status);
  r = await api('POST', '/constancias/importar', {
    token: T2,
    body: {
      constancias: [
        { folio: 'FCI-2026-5000', tipo: 'normal', fechaGeneracion: '2026-09-01', descargas: 3, estado: 'anulada', data: { a: 1 } },
        { folio: 'FCI-2026-5001', tipo: 'terminacion', data: { b: 1 } },
        { folio: 'FCI-2026-5000', tipo: 'normal', data: { duplicada: true } },
        { folio: 'FCI-2026-5002', tipo: 'normal', isExample: true, data: {} },
        { folio: 'MAL-123', tipo: 'normal', data: {} },
        { folio: 'FCI-2026-5003', tipo: 'otro', data: {} },
        { folio: c0.folio, tipo: 'normal', data: { ya: 'existe' } },
      ],
    },
  });
  registrar('Importar', 'Agrega solo las válidas y nuevas (2 de 7: salta duplicadas, ejemplos, folio/tipo inválidos y existentes)', r.status === 200 && r.datos?.agregadas === 2, `${r.status} agregadas=${r.datos?.agregadas ?? r.datos?.error}`);
  const imp = (await admin.from('constancias').select('estado,descargas,fecha_generacion').eq('folio', 'FCI-2026-5000').single()).data;
  registrar('Importar', 'Conserva estado, descargas y fecha del respaldo', imp?.estado === 'anulada' && imp?.descargas === 3 && imp?.fecha_generacion === '2026-09-01', JSON.stringify(imp));
  r = await api('GET', '/constancias', { token: T2 });
  registrar('Importar', 'Después de importar, el folio siguiente salta por encima (5002)', Number(r.datos?.siguienteFolio?.split('-')[2]) === 5002, r.datos?.siguienteFolio);
  r = await api('POST', '/constancias/importar', { token: T2, body: { constancias: [{ folio: 'FCI-2026-6000', tipo: 'normal', estado: 'borrada', data: {} }, { folio: 'FCI-2026-6001', tipo: 'normal', data: {} }] } });
  registrar('Importar', 'Respaldo con un registro de estado inválido: importa los demás', r.status === 200 && r.datos?.agregadas === 1, `${r.status} ${JSON.stringify(r.datos)}`);
  r = await api('POST', '/constancias/importar', { token: T2, body: { constancias: [{ folio: 'FCI-2026-6100', tipo: 'normal', fechaGeneracion: 'ayer', data: {} }, { folio: 'FCI-2026-6101', tipo: 'normal', data: {} }] } });
  registrar('Importar', 'Respaldo con una fecha inválida: importa los demás', r.status === 200 && r.datos?.agregadas === 1, `${r.status} ${JSON.stringify(r.datos)}`);

  // -------------------------------------------------------------------
  // Programas
  // -------------------------------------------------------------------
  r = await api('GET', '/programas', { token: T2 });
  registrar('Programas', 'Listar programas → los 3 del catálogo', r.status === 200 && r.datos?.programas?.length === 3, `${r.status} ${r.datos?.programas?.join(' | ')}`);

  // -------------------------------------------------------------------
  // Calendario
  // -------------------------------------------------------------------
  r = await api('GET', '/calendario', { token: T2 });
  registrar('Calendario', 'Leer calendario → 200', r.status === 200, `${r.status} ciclo=${r.datos?.calendario?.ciclo}`);
  const base = r.datos?.calendario ?? { ciclo: '2026-2027', semestres: [{ id: 'A', nombre: 'A', periodoInicio: '2026-08-17', periodoFin: '2026-12-09', vacacionesInicio: '', vacacionesFin: '' }] };
  r = await api('PUT', '/calendario', { token: T2, body: { calendario: { ciclo: 'x' } } });
  registrar('Calendario', 'Guardar sin semestres → 400', r.status === 400, r.status);
  r = await api('PUT', '/calendario', { token: T2, body: { calendario: { ...base, semestres: [{ ...base.semestres[0], periodoInicio: '17/08/2026' }] } } });
  registrar('Calendario', 'Guardar fecha con formato incorrecto → 400', r.status === 400, r.status);
  r = await api('PUT', '/calendario', { token: T2, body: { calendario: { ...base, semestres: [{ ...base.semestres[0], periodoInicio: '2026-13-45' }] } } });
  registrar('Calendario', 'Guardar fecha imposible (mes 13, día 45) → 400', r.status === 400, r.status);
  const modificado = { ...base, semestres: base.semestres.map((s, i) => (i === 0 ? { ...s, periodoFin: '2026-12-10' } : s)) };
  r = await api('PUT', '/calendario', { token: T2, body: { calendario: { ...modificado, pdfNombre: 'intento-de-cambiar.pdf' } } });
  registrar('Calendario', 'Guardar fechas válidas → 200 y se leen de vuelta', r.status === 200 && r.datos?.calendario?.semestres?.[0]?.periodoFin === '2026-12-10', `${r.status} ${r.datos?.calendario?.semestres?.[0]?.periodoFin}`);
  registrar('Calendario', 'Guardar fechas no puede cambiar los datos del PDF', r.datos?.calendario?.pdfNombre === (calPrevio?.valor?.pdfNombre ?? undefined), `pdfNombre=${r.datos?.calendario?.pdfNombre}`);
  const quien = (await admin.from('configuracion').select('actualizado_por').eq('clave', 'calendario').single()).data?.actualizado_por;
  registrar('Calendario', 'Registra quién hizo el cambio', quien === A.email, quien);

  r = await api('PUT', '/calendario/pdf', { token: T2, raw: Buffer.from('esto no es un pdf'), headers: { 'Content-Type': 'application/pdf' } });
  registrar('Calendario', 'Subir archivo que no es PDF → 400', r.status === 400, `${r.status} ${r.datos?.error}`);
  r = await api('PUT', '/calendario/pdf', { token: T2, raw: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(21 * 1024 * 1024)]), headers: { 'Content-Type': 'application/pdf' } });
  registrar('Calendario', 'Subir PDF de más de 20 MB → 413', r.status === 413, r.status);
  const pdfPrueba = Buffer.from('%PDF-1.4\n% pdf de prueba ' + Date.now() + '\n%%EOF\n');
  r = await api('PUT', '/calendario/pdf', { token: T2, raw: pdfPrueba, headers: { 'Content-Type': 'application/pdf', 'X-Nombre-Archivo': encodeURIComponent('Calendario 2026 (prueba).pdf') } });
  registrar('Calendario', 'Subir PDF válido → 200 y guarda el nombre con acentos/espacios', r.status === 200 && r.datos?.calendario?.pdfNombre === 'Calendario 2026 (prueba).pdf', `${r.status} ${r.datos?.calendario?.pdfNombre}`);
  r = await api('GET', '/calendario/pdf', { token: T2 });
  registrar('Calendario', 'Descargar el PDF → mismo archivo que se subió', r.status === 200 && Buffer.isBuffer(r.datos) && r.datos.equals(pdfPrueba), `${r.status} ${r.datos?.length} bytes`);
  registrar('Calendario', 'El PDF no se guarda en caché del navegador', /no-store/.test(r.headers.get('cache-control') ?? ''), r.headers.get('cache-control'));

  // -------------------------------------------------------------------
  // Configuración de plantillas (quién firma)
  // -------------------------------------------------------------------
  const firmantesOk = {
    secretaria: { nombre: 'Lic. Prueba Secretaria', cargo: 'Secretaria Administrativa de Prueba', email: '' },
    director: { articulo: 'La', nombre: 'Dra. Prueba Directora', cargo: 'Directora de Prueba', email: 'directora@example.com' },
    ccpIniciales: 'FCI/pp.',
  };
  r = await api('GET', '/plantillas', { token: T2 });
  registrar('Plantillas', 'Leer firmantes → 200', r.status === 200 && 'plantillas' in (r.datos ?? {}), `${r.status} ${r.datos?.plantillas ? 'configurados' : 'sin configurar (usa los originales)'}`);
  for (const [desc, p] of [
    ['sin nombre de la Secretaria', { ...firmantesOk, secretaria: { ...firmantesOk.secretaria, nombre: '  ' } }],
    ['sin cargo del Director', { ...firmantesOk, director: { ...firmantesOk.director, cargo: '' } }],
    ['con correo inválido', { ...firmantesOk, secretaria: { ...firmantesOk.secretaria, email: 'no-es-correo' } }],
    ['con apertura distinta de El/La', { ...firmantesOk, director: { ...firmantesOk.director, articulo: 'Los' } }],
    ['con un nombre de más de 150 caracteres', { ...firmantesOk, secretaria: { ...firmantesOk.secretaria, nombre: 'x'.repeat(151) } }],
    ['vacío', null],
  ]) {
    r = await api('PUT', '/plantillas', { token: T2, body: { plantillas: p } });
    registrar('Plantillas', `Guardar ${desc} → 400`, r.status === 400, `${r.status} ${r.datos?.error ?? ''}`);
  }
  r = await api('PUT', '/plantillas', {
    token: T2,
    body: { plantillas: { ...firmantesOk, secretaria: { ...firmantesOk.secretaria, nombre: '  Lic. Prueba Secretaria  ' }, extra: 'ignorar' } },
  });
  registrar(
    'Plantillas',
    'Guardar firmantes válidos → 200, recorta espacios e ignora campos extra',
    r.status === 200 && r.datos?.plantillas?.secretaria?.nombre === 'Lic. Prueba Secretaria' && r.datos?.plantillas?.director?.articulo === 'La' && !('extra' in (r.datos?.plantillas ?? {})),
    `${r.status} ${r.datos?.plantillas?.secretaria?.nombre}`,
  );
  r = await api('GET', '/plantillas', { token: T2 });
  registrar('Plantillas', 'Se leen de vuelta los firmantes guardados', r.datos?.plantillas?.director?.nombre === 'Dra. Prueba Directora' && r.datos?.plantillas?.ccpIniciales === 'FCI/pp.', r.datos?.plantillas?.director?.nombre);
  const quienPl = (await admin.from('configuracion').select('actualizado_por').eq('clave', 'plantillas').single()).data?.actualizado_por;
  registrar('Plantillas', 'Registra quién cambió los firmantes', quienPl === A.email, quienPl);
  // Una constancia guarda la copia de sus firmantes y no cambia aunque cambien después.
  r = await api('POST', '/constancias', { token: T2, body: { tipo: 'buena-conducta', data: { alumno: 'Prueba', firmantes: firmantesOk } } });
  const conFirma = r.datos?.constancia;
  await api('PUT', '/plantillas', { token: T2, body: { plantillas: { ...firmantesOk, director: { ...firmantesOk.director, nombre: 'Dr. Otro Director' } } } });
  r = await api('GET', '/constancias', { token: T2 });
  const guardada = r.datos?.constancias?.find((c) => c.id === conFirma?.id);
  registrar('Plantillas', 'La constancia conserva los firmantes con que se emitió', guardada?.data?.firmantes?.director?.nombre === 'Dra. Prueba Directora', guardada?.data?.firmantes?.director?.nombre);

  // -------------------------------------------------------------------
  // Acceso directo a la base desde el navegador (lo que no debe pasar)
  // -------------------------------------------------------------------
  const anon = { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}` };
  for (const tabla of ['constancias', 'usuarios_autorizados', 'programas', 'configuracion']) {
    const x = await fetch(`${SB_URL}/rest/v1/${tabla}?select=*`, { headers: anon });
    const cuerpo = await x.json().catch(() => null);
    const filtrado = x.status !== 200 || (Array.isArray(cuerpo) && cuerpo.length === 0);
    registrar('Seguridad', `Con la llave pública NO se puede leer "${tabla}"`, filtrado, `${x.status} ${Array.isArray(cuerpo) ? cuerpo.length + ' filas' : cuerpo?.message ?? ''}`);
  }
  let x = await fetch(`${SB_URL}/rest/v1/constancias`, { method: 'POST', headers: { ...anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ folio: 'FCI-2026-9999', tipo: 'normal', data: {} }) });
  registrar('Seguridad', 'Con la llave pública NO se puede insertar una constancia', x.status >= 400, x.status);
  for (const fn of ['siguiente_folio', 'registrar_constancia', 'importar_constancias', 'folio_siguiente_vista']) {
    x = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { ...anon, 'Content-Type': 'application/json' }, body: JSON.stringify(fn === 'registrar_constancia' ? { p_tipo: 'normal', p_data: {} } : fn === 'importar_constancias' ? { p_entradas: [] } : {}) });
    registrar('Seguridad', `Con la llave pública NO se puede ejecutar ${fn}()`, x.status >= 400, x.status);
  }
  x = await fetch(`${SB_URL}/storage/v1/object/public/archivos/calendario/calendario.pdf`);
  registrar('Seguridad', 'El PDF del calendario NO tiene enlace público', x.status >= 400, x.status);
  x = await fetch(`${SB_URL}/storage/v1/object/archivos/calendario/calendario.pdf`, { headers: anon });
  registrar('Seguridad', 'Con la llave pública NO se puede descargar el PDF', x.status >= 400, x.status);

  // Cierre de sesión
  r = await api('POST', '/auth/logout', { token: T2 });
  registrar('Auth', 'Cerrar sesión → 204', r.status === 204, r.status);
  r = await api('POST', '/auth/refresh', { body: { refreshToken: sesion.refreshToken } });
  registrar('Auth', 'Tras cerrar sesión ya no se puede renovar', r.status === 401, r.status);
  r = await api('GET', '/constancias', { token: T2 });
  registrar('Auth', 'Tras cerrar sesión, el access token ya emitido deja de servir', r.status === 401 ? true : 'obs', r.status === 401 ? '401' : `${r.status} (sigue sirviendo hasta que expire, máx. 1 h)`);
} catch (error) {
  registrar('ERROR', 'La batería se detuvo', false, error.stack);
} finally {
  // -------------------------------------------------------------------
  // Limpieza
  // -------------------------------------------------------------------
  const limp = [];
  // Solo lo que creó esta batería: las que generó por la API (ids
  // registrados en api()) y las que importó (folios fijos de prueba). Así no
  // se borra una constancia real que alguien haya generado mientras corría.
  const { data: importadas } = await admin.from('constancias').select('id').in('folio', FOLIOS_IMPORTADOS_PRUEBA);
  const sobrantes = [...creadasPorPrueba, ...importadas.map((c) => c.id)];
  for (let i = 0; i < sobrantes.length; i += 100) await admin.from('constancias').delete().in('id', sobrantes.slice(i, i + 100));
  limp.push(`${sobrantes.length} constancias de prueba borradas`);
  if (plantPrevia) await admin.from('configuracion').upsert(plantPrevia);
  else await admin.from('configuracion').delete().eq('clave', 'plantillas');
  limp.push('firmantes restaurados');
  if (calPrevio) await admin.from('configuracion').upsert(calPrevio);
  else await admin.from('configuracion').delete().eq('clave', 'calendario');
  limp.push('calendario restaurado');
  if (pdfPrevio) await admin.storage.from('archivos').upload('calendario/calendario.pdf', pdfPrevio, { contentType: 'application/pdf', upsert: true });
  else await admin.storage.from('archivos').remove(['calendario/calendario.pdf']);
  limp.push('PDF restaurado');
  await admin.from('usuarios_autorizados').delete().in('email', [A.email]);
  for (const id of idsUsuarios) await admin.auth.admin.deleteUser(id);
  limp.push(`${idsUsuarios.length} usuarios de prueba borrados`);
  const quedan = (await admin.from('constancias').select('id')).data.length;
  const pdfAhora = await admin.storage.from('archivos').download('calendario/calendario.pdf');
  const pdfOk = pdfPrevio ? pdfAhora.data && Buffer.from(await pdfAhora.data.arrayBuffer()).equals(pdfPrevio) : !pdfAhora.data;
  limp.push(`quedan ${quedan} constancias (antes ${previas.length}); PDF idéntico al original: ${pdfOk}`);
  console.log('LIMPIEZA:', limp.join(' | '));
  if (Number.isFinite(folioPrevio)) {
    console.log('\nEl folio avanzó con las pruebas. Para regresarlo, corre en Supabase → SQL Editor');
    console.log('(solo si nadie generó constancias reales mientras corrían):');
    console.log(`  select setval('public.folio_consecutivo', ${folioPrevio}, false);\n`);
  }
}

writeFileSync(new URL('./resultados-pruebas.json', import.meta.url), JSON.stringify(resultados, null, 2));
const tot = { PASA: 0, FALLA: 0, OBS: 0 };
for (const x of resultados) tot[x.ok]++;
for (const x of resultados) console.log(`${x.ok.padEnd(5)} [${x.area}] ${x.prueba} — ${x.detalle.slice(0, 120)}`);
console.log('TOTAL', JSON.stringify(tot));
