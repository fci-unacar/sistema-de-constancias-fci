import { useState } from 'react';
import Field from '../components/form/Field';
import Icon from '../components/atoms/Icon';
import PreviewDocument from '../components/document/PreviewDocument';
import { TextInput, SelectInput } from '../components/form/inputs';
import { TIPO_CONSTANCIA, TIPO_LABEL } from '../constants/tipos';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mismo criterio que la API (api/src/plantillas.js): nombre y cargo obligatorios, correo opcional pero válido. */
function firmanteValido(f) {
  const email = (f.email ?? '').trim();
  return (f.nombre ?? '').trim() !== '' && (f.cargo ?? '').trim() !== '' && (!email || EMAIL_RE.test(email));
}

function FirmanteFields({ titulo, descripcion, firmante, onChange, conArticulo }) {
  const set = (campo) => (valor) => onChange({ ...firmante, [campo]: valor });
  const email = (firmante.email ?? '').trim();
  const emailInvalido = email !== '' && !EMAIL_RE.test(email);

  return (
    <div className="flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
      <div className="flex flex-col">
        <h3 className="font-semibold text-on-surface text-label-md">{titulo}</h3>
        <p className="text-on-surface-variant text-label-sm">{descripcion}</p>
      </div>
      <Field
        label="Nombre con grado"
        hint="Tal como debe aparecer en la firma. Ej. Mtra. Nombre Apellido Apellido"
      >
        <TextInput value={firmante.nombre} onChange={set('nombre')} />
      </Field>
      <Field label="Cargo">
        <TextInput value={firmante.cargo} onChange={set('cargo')} />
      </Field>
      {conArticulo && (
        <Field label="Texto de apertura" hint='Para "El que suscribe…" o "La que suscribe…".'>
          <SelectInput value={firmante.articulo} options={['El', 'La']} onChange={set('articulo')} />
        </Field>
      )}
      <Field
        label="Correo (opcional)"
        hint={emailInvalido ? 'Ese correo no parece válido.' : 'Aparece debajo de la firma si se llena.'}
      >
        <TextInput value={firmante.email} onChange={set('email')} />
      </Field>
    </div>
  );
}

/**
 * "Configuración de Plantillas": quiénes firman las constancias. Se cambia
 * aquí cuando cambia la Secretaria Administrativa o el Director, sin tocar
 * el código. Las constancias ya emitidas conservan la firma con que se
 * generaron (ver utils/constanciaText.js).
 */
export default function PlantillasView({ firmantes, onGuardar, showToast }) {
  const [draft, setDraft] = useState(firmantes);
  const [guardando, setGuardando] = useState(false);
  const [vista, setVista] = useState(TIPO_CONSTANCIA.NORMAL);

  const campos = (f) => ({ ...f, actualizado: undefined });
  const cambios = JSON.stringify(campos(draft)) !== JSON.stringify(campos(firmantes));
  const completo =
    firmanteValido(draft.secretaria) && firmanteValido(draft.director) && !!draft.director.articulo;

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    const error = await onGuardar({
      secretaria: draft.secretaria,
      director: draft.director,
      ccpIniciales: draft.ccpIniciales,
    });
    setGuardando(false);
    showToast(
      error ? `No se pudo guardar: ${error}` : 'Firmantes actualizados. Se usarán en las constancias nuevas.',
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
      <form
        onSubmit={handleGuardar}
        className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm lg:col-span-5"
      >
        <div className="flex flex-col gap-space-2xs">
          <h2 className="font-semibold text-primary text-title-md">Quién firma las constancias</h2>
          <p className="text-on-surface-variant text-label-sm">
            Cámbialo cuando cambie la Secretaria Administrativa o el Director. Solo afecta a las constancias
            nuevas: las ya emitidas conservan la firma con que se generaron, también al volver a descargarlas.
          </p>
        </div>

        <FirmanteFields
          titulo="Secretaría Administrativa"
          descripcion="Firma la constancia de reinscripción, la de promedio y la de terminación de estudios."
          firmante={draft.secretaria}
          onChange={(secretaria) => setDraft({ ...draft, secretaria })}
        />
        <FirmanteFields
          titulo="Dirección"
          descripcion="Firma la carta de buena conducta; su nombre y cargo también abren el texto de la carta."
          firmante={draft.director}
          onChange={(director) => setDraft({ ...draft, director })}
          conArticulo
        />
        <Field
          label="Iniciales del C.c.p. (carta de buena conducta)"
          hint="Línea al pie con las iniciales de quien elabora. Ej. FCI/sddm."
        >
          <TextInput
            value={draft.ccpIniciales}
            onChange={(ccpIniciales) => setDraft({ ...draft, ccpIniciales })}
          />
        </Field>

        <button
          type="submit"
          disabled={!cambios || !completo || guardando}
          className="flex h-11 items-center justify-center gap-space-xs rounded-lg bg-primary font-bold text-on-primary shadow-md transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="save" className="text-[18px]" />
          {guardando ? 'Guardando…' : 'Guardar firmantes'}
        </button>
        {!completo && (
          <p className="text-center text-error text-label-sm">
            Nombre y cargo son obligatorios en los dos firmantes, y el correo debe ser válido si se llena.
          </p>
        )}
        {firmantes.actualizado && (
          <p className="text-center text-outline text-label-sm">
            Última actualización: {new Date(firmantes.actualizado).toLocaleString('es-MX')}
          </p>
        )}
      </form>

      <section className="sticky top-20 flex flex-col gap-space-sm lg:col-span-7">
        <div className="flex flex-wrap items-center gap-space-xs rounded-xl bg-surface-container-lowest px-space-md py-space-xs shadow-sm">
          <Icon name="visibility" className="text-[20px] text-secondary" />
          <span className="font-semibold text-on-surface text-label-md">Así se verá:</span>
          {Object.values(TIPO_CONSTANCIA).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setVista(tipo)}
              className={`rounded px-space-xs py-space-2xs text-label-sm ${
                vista === tipo
                  ? 'bg-secondary font-semibold text-on-secondary'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {TIPO_LABEL[tipo]}
            </button>
          ))}
        </div>
        <div className="flex justify-center rounded-xl bg-surface-container-low p-space-md shadow-inner">
          <PreviewDocument tipo={vista} data={{}} folio="AAAA-000" firmantes={draft} />
        </div>
      </section>
    </div>
  );
}
