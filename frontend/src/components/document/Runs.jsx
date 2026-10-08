import VarField from '../atoms/VarField';

/** Renderiza una lista de "runs" (texto fijo / dato variable) de utils/constanciaText.js. */
export default function Runs({ runs }) {
  return runs.map((run, i) => {
    const content = 'value' in run ? <VarField value={run.value} placeholder={run.placeholder} /> : run.text;
    return run.bold ? <strong key={i}>{content}</strong> : <span key={i}>{content}</span>;
  });
}
