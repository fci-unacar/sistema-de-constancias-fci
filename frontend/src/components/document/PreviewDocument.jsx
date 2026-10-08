import DocumentShell from './DocumentShell';
import Runs from './Runs';
import { getConstanciaContent } from '../../utils/constanciaText';
import { TIPO_CONSTANCIA } from '../../constants/tipos';

const TITULOS = {
  [TIPO_CONSTANCIA.NORMAL]: 'Constancia de reinscripción',
  [TIPO_CONSTANCIA.PROMEDIO]: 'Constancia de promedio',
  [TIPO_CONSTANCIA.BUENA_CONDUCTA]: 'Carta de buena conducta',
  [TIPO_CONSTANCIA.TERMINACION]: 'Constancia de terminación de estudios',
};

/** Vista previa de cualquier tipo de constancia — el texto vive en utils/constanciaText.js. */
export default function PreviewDocument({ tipo, data, folio }) {
  const { addressLines, paragraphs, cierre, firma, ccp } = getConstanciaContent(tipo, data);

  return (
    <DocumentShell
      folio={folio}
      titulo={TITULOS[tipo] ?? TITULOS[TIPO_CONSTANCIA.NORMAL]}
      cierre={cierre}
      firma={firma}
      ccp={ccp}
    >
      <p className="mb-4 text-left font-semibold tracking-wide">
        {addressLines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
      {paragraphs.map((runs, i) => (
        <p key={i} className="text-justify leading-[1.85]">
          <Runs runs={runs} />
        </p>
      ))}
    </DocumentShell>
  );
}
