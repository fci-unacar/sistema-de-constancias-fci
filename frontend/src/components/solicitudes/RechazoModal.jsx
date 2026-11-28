import { useState } from 'react';
import Icon from '../atoms/Icon';

/** Pide el motivo del rechazo, que el alumno verá en su panel. */
export default function RechazoModal({ solicitud, onRechazar, onClose }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  if (!solicitud) return null;

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onRechazar(solicitud.id, motivo.trim());
      onClose();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-space-md"
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Rechazar solicitud"
        className="flex w-full max-w-[480px] flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-xl"
      >
        <div className="flex flex-col gap-space-2xs">
          <h2 className="font-semibold text-on-surface text-body-md">Rechazar solicitud</h2>
          <p className="text-on-surface-variant text-label-md">
            {solicitud.nombre} ({solicitud.matricula}). El alumno verá este motivo en su panel.
          </p>
        </div>

        <textarea
          required
          autoFocus
          maxLength={500}
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. El voucher no es legible o el monto no corresponde."
          className="w-full rounded-lg bg-surface-container-low p-space-sm text-on-surface text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary"
        />

        {error && (
          <p role="alert" className="flex items-start gap-space-2xs text-error text-label-md">
            <Icon name="error" className="mt-0.5 text-[16px]" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-space-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-outline-variant px-space-sm py-space-xs text-on-surface-variant text-label-md hover:bg-surface-container-low"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !motivo.trim()}
            className="flex items-center gap-space-2xs rounded bg-error px-space-sm py-space-xs font-bold text-on-error text-label-md disabled:opacity-40"
          >
            <Icon name="block" className="text-[16px]" />
            {enviando ? 'Rechazando…' : 'Rechazar'}
          </button>
        </div>
      </form>
    </div>
  );
}
