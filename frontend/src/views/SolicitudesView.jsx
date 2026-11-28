import { useMemo, useState } from 'react';
import Icon from '../components/atoms/Icon';
import VoucherModal from '../components/solicitudes/VoucherModal';
import RechazoModal from '../components/solicitudes/RechazoModal';
import { TIPO_BADGE_CLASS, TIPO_LABEL } from '../constants/tipos';
import {
  ESTADO_SOLICITUD,
  ESTADO_SOLICITUD_CLASS,
  ESTADO_SOLICITUD_LABEL,
  fechaHoraCorta,
} from '../constants/solicitudes';

const FILTROS = [
  { estado: ESTADO_SOLICITUD.PENDIENTE, label: 'Pendientes' },
  { estado: ESTADO_SOLICITUD.LISTA, label: 'Listas' },
  { estado: ESTADO_SOLICITUD.RECHAZADA, label: 'Rechazadas' },
  { estado: null, label: 'Todas' },
];

const th = 'px-space-md py-space-sm text-left font-bold uppercase text-outline text-label-sm';
const td = 'px-space-md py-space-sm align-top';
const botonFila =
  'flex items-center gap-space-2xs whitespace-nowrap rounded border border-outline-variant px-space-sm py-space-2xs text-on-surface-variant text-label-md hover:border-secondary hover:text-secondary';

/**
 * Bandeja de solicitudes de los alumnos. Desde aquí Secretaría ve el
 * voucher, genera la constancia (abre el formulario con los datos del
 * alumno; al generar, la solicitud queda como "lista") o la rechaza.
 */
export default function SolicitudesView({
  solicitudes,
  cargando,
  errorCarga,
  disponible,
  onRecargar,
  onAtender,
  onRechazar,
  onRegresarAPendiente,
  onDescargarVoucher,
}) {
  const [filtro, setFiltro] = useState(ESTADO_SOLICITUD.PENDIENTE);
  const [query, setQuery] = useState('');
  const [voucherDe, setVoucherDe] = useState(null);
  const [rechazando, setRechazando] = useState(null);

  const conteo = useMemo(() => {
    const c = { todas: solicitudes.length };
    for (const s of solicitudes) c[s.estado] = (c[s.estado] ?? 0) + 1;
    return c;
  }, [solicitudes]);

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      solicitudes
        .filter((s) => !filtro || s.estado === filtro)
        .filter(
          (s) =>
            !q ||
            s.nombre.toLowerCase().includes(q) ||
            s.matricula.toLowerCase().includes(q) ||
            s.alumnoEmail.toLowerCase().includes(q),
        )
        // Las pendientes se atienden en orden de llegada: la más vieja primero.
        .sort((a, b) =>
          filtro === ESTADO_SOLICITUD.PENDIENTE
            ? a.creadoEn.localeCompare(b.creadoEn)
            : b.creadoEn.localeCompare(a.creadoEn),
        )
    );
  }, [solicitudes, filtro, query]);

  if (!disponible) {
    return (
      <div className="max-w-[900px] rounded-xl bg-surface-container-lowest p-space-lg text-on-surface-variant text-body-sm shadow-sm">
        Las solicitudes de alumnos necesitan el servidor y la base de datos (login real activado). En modo de
        demostración no hay portal de alumnos que las mande.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex flex-wrap gap-space-2xs">
          {FILTROS.map((f) => {
            const activo = filtro === f.estado;
            const n = f.estado ? (conteo[f.estado] ?? 0) : conteo.todas;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFiltro(f.estado)}
                className={`rounded-full px-space-sm py-space-2xs text-label-md transition-colors ${
                  activo
                    ? 'bg-secondary font-semibold text-on-secondary'
                    : 'bg-surface-container-lowest text-on-surface-variant shadow-sm hover:bg-surface-container-low'
                }`}
              >
                {f.label} ({n})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-space-sm">
          <input
            className="h-[38px] w-72 rounded bg-surface-container-lowest px-space-sm text-on-surface text-body-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-secondary"
            placeholder="Buscar por nombre, matrícula o correo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" onClick={onRecargar} disabled={cargando} className={botonFila}>
            <Icon name="refresh" className={`text-[16px] ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {errorCarga && (
        <p className="rounded border border-error px-space-sm py-space-xs text-error text-label-md">
          No se pudieron cargar las solicitudes: {errorCarga}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
        {visibles.length === 0 ? (
          <div className="py-space-2xl text-center text-outline text-body-sm">
            {cargando ? 'Cargando solicitudes…' : 'No hay solicitudes en esta bandeja.'}
          </div>
        ) : (
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="bg-surface-container-low">
                <th className={th}>Recibida</th>
                <th className={th}>Alumno</th>
                <th className={th}>Programa</th>
                <th className={th}>Tipo</th>
                <th className={th}>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((s) => (
                <tr key={s.id} className="border-t border-outline-variant/40 hover:bg-surface-container-low">
                  <td className={`${td} whitespace-nowrap text-on-surface-variant`}>
                    {fechaHoraCorta(s.creadoEn)}
                  </td>
                  <td className={td}>
                    <div className="font-semibold text-on-surface">{s.nombre}</div>
                    <div className="font-mono text-on-surface-variant text-label-sm">{s.matricula}</div>
                    <div className="text-outline text-label-sm">{s.alumnoEmail}</div>
                  </td>
                  <td className={`${td} text-on-surface-variant`}>{s.programa}</td>
                  <td className={td}>
                    <span
                      className={`whitespace-nowrap rounded-full px-space-xs py-space-2xs font-bold uppercase tracking-wide text-label-sm ${TIPO_BADGE_CLASS[s.tipo]}`}
                    >
                      {TIPO_LABEL[s.tipo]}
                    </span>
                  </td>
                  <td className={td}>
                    <span
                      className={`rounded-full px-space-xs py-space-2xs font-bold uppercase tracking-wide text-label-sm ${ESTADO_SOLICITUD_CLASS[s.estado]}`}
                    >
                      {ESTADO_SOLICITUD_LABEL[s.estado]}
                    </span>
                    {s.estado === ESTADO_SOLICITUD.LISTA && s.folio && (
                      <div className="mt-space-2xs font-mono text-on-surface-variant text-label-sm">
                        {s.folio}
                      </div>
                    )}
                    {s.estado === ESTADO_SOLICITUD.RECHAZADA && s.motivoRechazo && (
                      <div className="mt-space-2xs max-w-[220px] text-error text-label-sm">
                        {s.motivoRechazo}
                      </div>
                    )}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap justify-end gap-space-2xs">
                      <button type="button" onClick={() => setVoucherDe(s)} className={botonFila}>
                        <Icon name="receipt_long" className="text-[16px]" />
                        Voucher
                      </button>
                      {s.estado === ESTADO_SOLICITUD.PENDIENTE && (
                        <>
                          <button
                            type="button"
                            onClick={() => onAtender(s)}
                            className="flex items-center gap-space-2xs whitespace-nowrap rounded bg-primary px-space-sm py-space-2xs font-bold text-on-primary text-label-md hover:bg-primary-container"
                          >
                            <Icon name="note_add" className="text-[16px]" />
                            Generar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRechazando(s)}
                            className={`${botonFila} hover:border-error hover:text-error`}
                          >
                            <Icon name="block" className="text-[16px]" />
                            Rechazar
                          </button>
                        </>
                      )}
                      {s.estado === ESTADO_SOLICITUD.RECHAZADA && (
                        <button
                          type="button"
                          onClick={() => onRegresarAPendiente(s.id)}
                          className={botonFila}
                        >
                          <Icon name="undo" className="text-[16px]" />
                          Regresar a pendientes
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <VoucherModal
        solicitud={voucherDe}
        onDescargar={onDescargarVoucher}
        onClose={() => setVoucherDe(null)}
      />
      <RechazoModal
        key={rechazando?.id ?? 'ninguna'}
        solicitud={rechazando}
        onRechazar={onRechazar}
        onClose={() => setRechazando(null)}
      />
    </div>
  );
}
