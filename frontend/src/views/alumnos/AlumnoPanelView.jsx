import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/atoms/Icon';
import { inputAlumno } from './estilos';
import logoUnacar from '../../assets/logo-unacar.png';
import logoFci from '../../assets/logo-fci.png';
import { useMisSolicitudes } from '../../hooks/useMisSolicitudes';
import { TIPO_CONSTANCIA, TIPO_NOMBRE_COMPLETO } from '../../constants/tipos';
import {
  ESTADO_SOLICITUD,
  ESTADO_SOLICITUD_CLASS,
  ESTADO_SOLICITUD_LABEL,
  MAX_VOUCHER_BYTES,
  TIPO_VOUCHER_POR_EXTENSION,
  fechaHoraCorta,
} from '../../constants/solicitudes';

const FORM_VACIO = { nombre: '', matricula: '', programa: '', tipo: '' };

/** Tipo MIME del voucher por su extensión, o null si no es PDF/JPG/PNG. */
function tipoDeVoucher(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TIPO_VOUCHER_POR_EXTENSION[extension] ?? null;
}

/** Qué le toca hacer al alumno según el estado de su solicitud. */
function textoDeEstado(s) {
  if (s.estado === ESTADO_SOLICITUD.LISTA) {
    return `Tu constancia está lista${s.folio ? ` (folio ${s.folio})` : ''}. Pasa a recogerla a la Secretaría Académica.`;
  }
  if (s.estado === ESTADO_SOLICITUD.RECHAZADA) {
    return `Motivo: ${s.motivoRechazo ?? 'sin especificar'}. Corrige lo necesario y manda una solicitud nueva.`;
  }
  return 'La Secretaría Académica revisará tu solicitud y tu voucher. La respuesta tarda hasta 2 días hábiles.';
}

function Campo({ label, children, ayuda }) {
  return (
    <label className="flex flex-col gap-space-2xs">
      <span className="font-bold text-body-md">{label}</span>
      {children}
      {ayuda && <span className="text-outline text-label-md">{ayuda}</span>}
    </label>
  );
}

/**
 * Panel del alumno: formulario para solicitar una constancia (nombre,
 * matrícula, programa, tipo y voucher de pago) y la lista de sus
 * solicitudes con su estado.
 */
export default function AlumnoPanelView({ user, onLogout }) {
  const { solicitudes, programas, cargando, errorCarga, recargar, enviarSolicitud } = useMisSolicitudes();
  const [form, setForm] = useState(FORM_VACIO);
  const [voucher, setVoucher] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const inputArchivo = useRef(null);
  const listaRef = useRef(null);
  const precargado = useRef(false);

  // Solo una pendiente por tipo (la API y la base también lo validan): esos
  // tipos salen deshabilitados hasta que Secretaría los apruebe o rechace.
  const tiposPendientes = new Set(
    solicitudes.filter((s) => s.estado === ESTADO_SOLICITUD.PENDIENTE).map((s) => s.tipo),
  );
  const todosPendientes = Object.values(TIPO_CONSTANCIA).every((t) => tiposPendientes.has(t));

  // Precarga nombre, matrícula y programa de la última solicitud, para no
  // volver a escribirlos cada vez.
  useEffect(() => {
    if (precargado.current || solicitudes.length === 0) return;
    precargado.current = true;
    const { nombre, matricula, programa } = solicitudes[0];
    setForm((prev) => (prev.nombre || prev.matricula ? prev : { ...prev, nombre, matricula, programa }));
  }, [solicitudes]);

  function cambiar(campo) {
    return (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }));
  }

  function elegirArchivo(e) {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) return setVoucher(null);
    if (!tipoDeVoucher(file)) {
      e.target.value = '';
      setVoucher(null);
      return setError('El voucher debe ser un PDF o una foto JPG o PNG.');
    }
    if (file.size > MAX_VOUCHER_BYTES) {
      e.target.value = '';
      setVoucher(null);
      return setError('El voucher pesa más de 5 MB. Toma la foto con menor resolución o súbelo en PDF.');
    }
    return setVoucher(file);
  }

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setExito(null);
    if (!voucher) return setError('Adjunta tu voucher de pago.');
    setEnviando(true);
    try {
      await enviarSolicitud({ ...form, voucher, voucherTipo: tipoDeVoucher(voucher) });
      setExito('Tu solicitud se envió. Puedes ver su estado en "Mis solicitudes".');
      setForm((prev) => ({ ...prev, tipo: '' }));
      setVoucher(null);
      if (inputArchivo.current) inputArchivo.current.value = '';
      // En el celular la lista queda arriba del formulario: llevar al alumno a ver su solicitud nueva.
      listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans text-on-surface antialiased">
      <header className="bg-primary text-on-primary shadow-md">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-space-sm px-space-md py-space-sm">
          <div className="flex min-w-0 items-center gap-space-sm">
            <div className="flex shrink-0 items-center gap-space-2xs rounded-lg bg-surface-container-lowest p-space-2xs sm:gap-space-xs">
              <img src={logoUnacar} alt="UNACAR" className="h-7 w-auto sm:h-8" />
              <img src={logoFci} alt="FCI" className="h-7 w-auto sm:h-8" />
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-semibold text-body-md">Solicitud de Constancias</span>
              <span className="truncate text-on-primary-container text-label-sm" title={user?.email}>
                {user?.email}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={onLogout}
              className="flex h-10 items-center gap-space-2xs rounded px-space-sm text-on-primary-container text-label-md transition-colors hover:bg-white/10 hover:text-on-primary"
            >
              <Icon name="logout" className="text-[18px]" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1100px] grid-cols-1 items-start gap-space-lg px-space-md py-space-md sm:py-space-lg lg:grid-cols-12">
        <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg lg:col-span-5">
          <div className="flex flex-col gap-space-2xs">
            <h2 className="font-semibold text-primary text-title-md">Nueva solicitud</h2>
            <p className="text-on-surface-variant text-body-sm">
              Llena tus datos tal como deben aparecer en la constancia y adjunta tu voucher de pago.
            </p>
          </div>

          <form className="flex flex-col gap-space-md" onSubmit={enviar}>
            <Campo label="Nombre completo">
              <input
                required
                maxLength={200}
                autoComplete="name"
                className={inputAlumno}
                placeholder="Ej. Juan Pérez López"
                value={form.nombre}
                onChange={cambiar('nombre')}
              />
            </Campo>

            <Campo label="Matrícula">
              <input
                required
                maxLength={20}
                inputMode="numeric"
                pattern="[A-Za-z0-9]+"
                title="Solo letras y números"
                className={inputAlumno}
                placeholder="Ej. 000000"
                value={form.matricula}
                onChange={cambiar('matricula')}
              />
            </Campo>

            <Campo label="Programa educativo">
              <select required className={inputAlumno} value={form.programa} onChange={cambiar('programa')}>
                <option value="" disabled>
                  Elige tu programa
                </option>
                {programas.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              label="Tipo de constancia"
              ayuda={
                tiposPendientes.size > 0
                  ? 'Solo puedes tener una solicitud pendiente de cada tipo. Podrás pedir otra cuando Secretaría la apruebe o la rechace.'
                  : null
              }
            >
              <select
                required
                disabled={todosPendientes}
                className={`${inputAlumno} disabled:opacity-60`}
                value={form.tipo}
                onChange={cambiar('tipo')}
              >
                <option value="" disabled>
                  {todosPendientes
                    ? 'Ya tienes pendiente un tipo de cada uno'
                    : 'Elige el tipo de constancia'}
                </option>
                {Object.values(TIPO_CONSTANCIA).map((t) => (
                  <option key={t} value={t} disabled={tiposPendientes.has(t)}>
                    {TIPO_NOMBRE_COMPLETO[t]}
                    {tiposPendientes.has(t) ? ' (pendiente)' : ''}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="flex flex-col gap-space-2xs">
              <span className="font-bold text-body-md">Voucher de pago</span>
              <label
                className={`flex min-h-[56px] cursor-pointer items-center gap-space-sm rounded-lg border-2 border-dashed px-space-sm py-space-xs transition-colors focus-within:ring-2 focus-within:ring-secondary ${
                  voucher
                    ? 'border-secondary bg-secondary-fixed/40 text-on-surface'
                    : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-secondary'
                }`}
              >
                {/* Sin "required": el navegador no puede mostrar su aviso en un campo oculto; enviar() lo valida. */}
                <input
                  ref={inputArchivo}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={elegirArchivo}
                  className="sr-only"
                />
                <Icon
                  name={voucher ? 'check_circle' : 'add_a_photo'}
                  className={`shrink-0 text-[24px] ${voucher ? 'text-secondary' : 'text-primary'}`}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold text-body-md">
                    {voucher ? voucher.name : 'Tomar foto o elegir archivo'}
                  </span>
                  <span className="text-outline text-label-md">
                    {voucher
                      ? `${(voucher.size / 1024 / 1024).toFixed(1)} MB · toca para cambiarlo`
                      : 'PDF o foto (JPG o PNG), máximo 5 MB.'}
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-space-2xs text-error text-body-sm">
                <Icon name="error" className="mt-0.5 text-[16px]" />
                {error}
              </p>
            )}
            {exito && (
              <p role="status" className="flex items-start gap-space-2xs text-secondary text-body-sm">
                <Icon name="check_circle" className="mt-0.5 text-[16px]" />
                {exito}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="flex h-12 items-center justify-center gap-space-xs rounded-lg bg-primary font-bold text-on-primary text-body-md shadow-md transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="send" className="text-[18px]" />
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>
        </section>

        <section
          ref={listaRef}
          className={`flex scroll-mt-space-md flex-col gap-space-md lg:order-none lg:col-span-7 ${solicitudes.length > 0 ? 'order-first' : ''}`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-primary text-title-md">Mis solicitudes</h2>
            <button
              type="button"
              onClick={recargar}
              disabled={cargando}
              className="flex h-10 items-center gap-space-2xs rounded border border-outline-variant px-space-sm text-on-surface-variant text-label-md hover:bg-surface-container-low disabled:opacity-40"
            >
              <Icon name="refresh" className={`text-[16px] ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {errorCarga && (
            <p className="rounded border border-error px-space-sm py-space-xs text-error text-label-md">
              No se pudieron cargar tus solicitudes: {errorCarga}
            </p>
          )}

          {!cargando && !errorCarga && solicitudes.length === 0 && (
            <div className="rounded-xl bg-surface-container-lowest py-space-2xl text-center text-outline text-body-sm shadow-sm">
              Todavía no has hecho ninguna solicitud.
            </div>
          )}

          {cargando && solicitudes.length === 0 && (
            <div className="flex items-center gap-space-xs text-on-surface-variant text-label-md">
              <Icon name="progress_activity" className="animate-spin text-[16px]" />
              Cargando… (si el servidor estaba dormido puede tardar hasta un minuto)
            </div>
          )}

          <ul className="flex flex-col gap-space-sm">
            {solicitudes.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-space-xs rounded-xl bg-surface-container-lowest p-space-md shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-space-xs">
                  <span className="font-semibold text-on-surface text-body-md">
                    {TIPO_NOMBRE_COMPLETO[s.tipo]}
                  </span>
                  <span
                    className={`rounded-full px-space-xs py-space-2xs font-bold uppercase tracking-wide text-label-sm ${ESTADO_SOLICITUD_CLASS[s.estado]}`}
                  >
                    {ESTADO_SOLICITUD_LABEL[s.estado]}
                  </span>
                </div>
                <div className="text-on-surface-variant text-body-sm">
                  {s.nombre} · {s.matricula} · {s.programa}
                </div>
                <div className="text-outline text-label-md [overflow-wrap:anywhere]">
                  Enviada el {fechaHoraCorta(s.creadoEn)} · Voucher: {s.voucherNombre}
                </div>
                <p
                  className={`text-body-sm ${s.estado === ESTADO_SOLICITUD.RECHAZADA ? 'text-error' : 'text-on-surface'}`}
                >
                  {textoDeEstado(s)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
