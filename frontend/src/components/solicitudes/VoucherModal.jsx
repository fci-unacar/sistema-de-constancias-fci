import { useEffect, useState } from 'react';
import Icon from '../atoms/Icon';

/**
 * Muestra el voucher de pago de una solicitud (PDF o imagen). El archivo
 * se pide a la API con la sesión, porque el bucket es privado.
 */
export default function VoucherModal({ solicitud, onDescargar, onClose }) {
  const [archivo, setArchivo] = useState({ url: null, tipo: null, error: null });

  useEffect(() => {
    if (!solicitud) return undefined;
    let url = null;
    let vigente = true;
    setArchivo({ url: null, tipo: null, error: null });
    onDescargar(solicitud.id)
      .then((blob) => {
        if (!vigente) return;
        if (!blob) return setArchivo({ url: null, tipo: null, error: 'No se encontró el voucher.' });
        url = URL.createObjectURL(blob);
        return setArchivo({ url, tipo: blob.type || solicitud.voucherTipo, error: null });
      })
      .catch((error) => vigente && setArchivo({ url: null, tipo: null, error: error.message }));
    return () => {
      vigente = false;
      if (url) URL.revokeObjectURL(url);
    };
    // onDescargar es estable en la práctica; solo se recarga al cambiar de solicitud.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitud?.id]);

  if (!solicitud) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-space-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Voucher de pago"
      >
        <div className="flex items-center justify-between gap-space-sm border-b border-outline-variant/40 px-space-md py-space-sm">
          <div className="min-w-0">
            <div className="font-semibold text-on-surface text-body-md">Voucher de {solicitud.nombre}</div>
            <div className="truncate text-outline text-label-sm">{solicitud.voucherNombre}</div>
          </div>
          <div className="flex items-center gap-space-xs">
            {archivo.url && (
              <a
                href={archivo.url}
                download={solicitud.voucherNombre}
                className="flex items-center gap-space-2xs rounded border border-outline-variant px-space-sm py-space-2xs text-on-surface-variant text-label-md hover:border-secondary hover:text-secondary"
              >
                <Icon name="download" className="text-[16px]" />
                Descargar
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-outline hover:bg-surface-container-high"
            >
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-container-low">
          {archivo.error && <p className="text-error text-body-sm">{archivo.error}</p>}
          {!archivo.error && !archivo.url && (
            <span className="flex items-center gap-space-xs text-on-surface-variant text-label-md">
              <Icon name="progress_activity" className="animate-spin text-[16px]" />
              Cargando voucher…
            </span>
          )}
          {archivo.url &&
            (archivo.tipo === 'application/pdf' ? (
              <iframe src={archivo.url} title="Voucher de pago" className="h-full w-full" />
            ) : (
              <img src={archivo.url} alt="Voucher de pago" className="max-h-full max-w-full object-contain" />
            ))}
        </div>
      </div>
    </div>
  );
}
