/**
 * Portal de alumnos: inicio de sesión y solicitudes de constancia.
 *
 * Cualquier correo institucional (ALUMNOS_DOMINIO, por defecto
 * delfin.unacar.mx) puede entrar, sin que nadie lo dé de alta: el alumno
 * escribe su correo, le llega un código y con él queda dentro. No hay
 * contraseña. Esta sesión NO abre el panel de Secretaría: ese sigue
 * pidiendo estar en usuarios_autorizados (ver requireAuth en auth.js).
 *
 * Con la sesión, el alumno manda solicitudes (nombre, matrícula,
 * programa, tipo y voucher de pago) y ve el estado de las suyas. Solo ve
 * las que hizo con su correo. Secretaría las atiende desde solicitudes.js.
 *
 * Se monta en /alumno (ver server.js).
 */
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { config, supabaseConfigurado } from './config.js';
import { getSupabase } from './supabase.js';
import {
  clienteDeSesion,
  respuestaDeSesion,
  sinSupabase,
  falloDeServicio,
  servicioCaido,
  normalizarEmail,
} from './auth.js';
import { TIPOS, tipoDeArchivo } from './validacion.js';

export const BUCKET_VOUCHERS = 'vouchers';
/** Igual que el límite del bucket "vouchers". */
const MAX_VOUCHER = 5 * 1024 * 1024;
/** Frena que un alumno llene la bandeja de Secretaría. */
const MAX_PENDIENTES = 5;
const EXTENSION = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** true si el correo es del dominio institucional. */
function esCorreoInstitucional(email) {
  return email.endsWith(`@${config.alumnosDominio}`) && email.length > config.alumnosDominio.length + 1;
}

/**
 * Middleware de las rutas del alumno: sesión válida de un correo
 * institucional. Deja req.alumno = { id, email }.
 */
export async function requireAlumno(req, res, next) {
  if (!supabaseConfigurado()) return sinSupabase(res);

  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta iniciar sesión.' });
  }

  const { data, error } = await getSupabase().auth.getUser(token);
  if (falloDeServicio(error)) return servicioCaido(res, error);
  if (error || !data.user) {
    return res.status(401).json({ error: 'La sesión expiró o no es válida.' });
  }
  const email = normalizarEmail(data.user.email);
  if (!esCorreoInstitucional(email)) {
    return res.status(403).json({ error: `Usa tu correo institucional (@${config.alumnosDominio}).` });
  }
  req.alumno = { id: data.user.id, email };
  return next();
}

function falloDeBase(res, error, contexto) {
  console.error(`${contexto}:`, error.code ?? error.statusCode ?? '', error.message);
  return res.status(503).json({ error: 'El servidor de datos no respondió. Intenta de nuevo.' });
}

/** Fila de la tabla → lo que ve el alumno (sin rutas internas ni quién atendió). */
function aAlumno(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    matricula: fila.matricula,
    programa: fila.programa,
    tipo: fila.tipo,
    voucherNombre: fila.voucher_nombre,
    estado: fila.estado,
    motivoRechazo: fila.motivo_rechazo,
    folio: fila.constancias?.folio ?? null,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

/** Texto obligatorio, sin espacios de sobra y con largo máximo. */
function texto(valor, max) {
  if (typeof valor !== 'string') return '';
  const limpio = valor.trim().replace(/\s+/g, ' ');
  return limpio.length <= max ? limpio : '';
}

export const alumnosRouter = Router();

// ---------------------------------------------------------------------
// Inicio de sesión con código al correo
// ---------------------------------------------------------------------

// 5 códigos por IP cada 15 minutos. Supabase además deja pasar como máximo
// un correo por minuto a la misma dirección.
const limiteCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.' },
});

// Frena intentos de adivinar el código: 10 intentos fallidos por IP cada 15 minutos.
const limiteVerificar = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

alumnosRouter.post('/auth/codigo', limiteCodigo, async (req, res) => {
  if (!supabaseConfigurado()) return sinSupabase(res);

  const email = normalizarEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Escribe tu correo institucional.' });
  if (!esCorreoInstitucional(email)) {
    return res.status(400).json({ error: `Usa tu correo institucional (@${config.alumnosDominio}).` });
  }

  // El registro público de Supabase está apagado: la cuenta se crea aquí,
  // con la llave service_role, la primera vez que el alumno pide su código.
  const { error: errorAlta } = await getSupabase().auth.admin.createUser({ email, email_confirm: true });
  if (errorAlta && errorAlta.code !== 'email_exists' && errorAlta.code !== 'user_already_exists') {
    if (falloDeServicio(errorAlta)) return servicioCaido(res, errorAlta);
    console.error('No se pudo crear la cuenta del alumno:', errorAlta.code, errorAlta.message);
    return res.status(500).json({ error: 'No se pudo enviar el código. Intenta de nuevo más tarde.' });
  }

  const { error } = await clienteDeSesion().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    if (falloDeServicio(error)) return servicioCaido(res, error);
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Ya se envió un código hace poco. Espera un minuto antes de pedir otro.',
      });
    }
    console.error('No se pudo enviar el código al alumno:', error.code, error.message);
    return res.status(500).json({ error: 'No se pudo enviar el código. Intenta de nuevo más tarde.' });
  }
  return res.json({
    mensaje: `Te enviamos un código a ${email}. Puede tardar unos minutos; revisa también la carpeta de correo no deseado.`,
  });
});

alumnosRouter.post('/auth/verificar', limiteVerificar, async (req, res) => {
  if (!supabaseConfigurado()) return sinSupabase(res);

  const email = normalizarEmail(req.body?.email);
  const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.replace(/\s/g, '') : '';
  if (!email || !codigo) return res.status(400).json({ error: 'Escribe el código que te llegó.' });
  if (!esCorreoInstitucional(email)) {
    return res.status(400).json({ error: `Usa tu correo institucional (@${config.alumnosDominio}).` });
  }

  const { data, error } = await clienteDeSesion().auth.verifyOtp({ email, token: codigo, type: 'email' });
  if (falloDeServicio(error)) return servicioCaido(res, error);
  if (error || !data.session) {
    return res.status(401).json({ error: 'El código no es válido o ya expiró. Pide uno nuevo.' });
  }
  return res.json(respuestaDeSesion(data.session));
});

alumnosRouter.get('/auth/me', requireAlumno, (req, res) => {
  res.json({ user: req.alumno });
});

alumnosRouter.post('/auth/logout', requireAlumno, async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  await getSupabase().auth.admin.signOut(token);
  res.status(204).end();
});

// ---------------------------------------------------------------------
// Datos para el formulario y solicitudes del alumno
// ---------------------------------------------------------------------

alumnosRouter.get('/programas', requireAlumno, async (_req, res) => {
  const { data, error } = await getSupabase().from('programas').select('nombre').order('creado_en');
  if (error) return falloDeBase(res, error, 'No se pudieron leer los programas');
  return res.json({ programas: data.map((p) => p.nombre) });
});

alumnosRouter.get('/solicitudes', requireAlumno, async (req, res) => {
  const { data, error } = await getSupabase()
    .from('solicitudes')
    .select('*, constancias(folio)')
    .eq('alumno_email', req.alumno.email)
    .order('creado_en', { ascending: false });
  if (error) return falloDeBase(res, error, 'No se pudieron leer las solicitudes del alumno');
  return res.json({ solicitudes: data.map(aAlumno) });
});

/**
 * Nueva solicitud. El cuerpo es el voucher tal cual (PDF, JPG o PNG) y los
 * datos del formulario viajan en el encabezado X-Solicitud, como JSON
 * codificado con encodeURIComponent: { nombre, matricula, programa, tipo,
 * archivo }. Así no hace falta una librería de multipart.
 */
alumnosRouter.post(
  '/solicitudes',
  requireAlumno,
  express.raw({ type: ['application/pdf', 'image/jpeg', 'image/png'], limit: MAX_VOUCHER }),
  async (req, res) => {
    let campos;
    try {
      campos = JSON.parse(decodeURIComponent(req.get('X-Solicitud') ?? ''));
    } catch {
      return res.status(400).json({ error: 'Faltan los datos de la solicitud.' });
    }

    const nombre = texto(campos?.nombre, 200);
    const matricula = texto(campos?.matricula, 20);
    const programa = texto(campos?.programa, 200);
    const tipo = campos?.tipo;
    if (!nombre || !matricula || !programa) {
      return res.status(400).json({ error: 'Escribe tu nombre, tu matrícula y elige tu programa educativo.' });
    }
    if (!/^[A-Za-z0-9]+$/.test(matricula)) {
      return res.status(400).json({ error: 'La matrícula solo puede tener letras y números.' });
    }
    if (!TIPOS.has(tipo)) return res.status(400).json({ error: 'Elige el tipo de constancia.' });

    const voucherTipo = tipoDeArchivo(req.body);
    if (!voucherTipo) {
      return res.status(400).json({ error: 'El voucher debe ser un PDF o una foto (JPG o PNG) de hasta 5 MB.' });
    }
    const voucherNombre = texto(campos?.archivo, 200) || `voucher.${EXTENSION[voucherTipo]}`;

    const supabase = getSupabase();

    // El programa tiene que ser uno del catálogo: es el texto que irá en la constancia.
    const { data: prog, error: errorProg } = await supabase
      .from('programas')
      .select('nombre')
      .eq('nombre', programa)
      .maybeSingle();
    if (errorProg) return falloDeBase(res, errorProg, 'No se pudo validar el programa');
    if (!prog) return res.status(400).json({ error: 'Elige un programa educativo de la lista.' });

    const { count, error: errorConteo } = await supabase
      .from('solicitudes')
      .select('id', { count: 'exact', head: true })
      .eq('alumno_email', req.alumno.email)
      .eq('estado', 'pendiente');
    if (errorConteo) return falloDeBase(res, errorConteo, 'No se pudieron contar las solicitudes pendientes');
    if (count >= MAX_PENDIENTES) {
      return res.status(429).json({
        error: `Ya tienes ${count} solicitudes pendientes. Espera a que Secretaría las atienda antes de mandar otra.`,
      });
    }

    const id = randomUUID();
    const ruta = `${id}.${EXTENSION[voucherTipo]}`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_VOUCHERS)
      .upload(ruta, req.body, { contentType: voucherTipo });
    if (errorSubida) return falloDeBase(res, errorSubida, 'No se pudo subir el voucher');

    const { data, error } = await supabase
      .from('solicitudes')
      .insert({
        id,
        alumno_email: req.alumno.email,
        nombre,
        matricula,
        programa,
        tipo,
        voucher_ruta: ruta,
        voucher_nombre: voucherNombre,
        voucher_tipo: voucherTipo,
      })
      .select('*, constancias(folio)')
      .single();
    if (error) {
      // Sin fila que lo use, el voucher se queda huérfano: se borra.
      await supabase.storage.from(BUCKET_VOUCHERS).remove([ruta]);
      return falloDeBase(res, error, 'No se pudo registrar la solicitud');
    }
    return res.status(201).json({ solicitud: aAlumno(data) });
  },
);
