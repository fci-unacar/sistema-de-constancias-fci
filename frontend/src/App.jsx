import { useRef, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Toast from './components/Toast';
import Icon from './components/atoms/Icon';
import InicioView from './views/InicioView';
import NuevaConstanciaView from './views/NuevaConstanciaView';
import HistorialView from './views/HistorialView';
import CalendarioView from './views/CalendarioView';
import { useHistorial } from './hooks/useHistorial';
import { useProgramas } from './hooks/useProgramas';
import { useCalendario } from './hooks/useCalendario';
import { usePlantillas } from './hooks/usePlantillas';
import PlantillasView from './views/PlantillasView';
import { useToast } from './hooks/useToast';
import { VISTA, TIPO_POR_VISTA } from './constants/tipos';
import { todayStr } from './utils/spanishText';

export default function App({ user, onLogout }) {
  const [view, setView] = useState(VISTA.INICIO);
  const [prefill, setPrefill] = useState(null); // { tipo, data } al "duplicar para nueva emisión"
  const [historialQuery, setHistorialQuery] = useState('');
  const {
    historial,
    nextFolio,
    cargando,
    errorCarga,
    recargar,
    registrarConstancia,
    anularConstancia,
    reactivarConstancia,
    registrarDescarga,
    importarHistorial,
  } = useHistorial();
  // Evita registrar dos constancias si se da doble clic en "Generar"
  // mientras la API todavía no responde.
  const generando = useRef(false);
  const { programas } = useProgramas();
  const { calendario, guardarCalendario, pdfUrl: calendarioPdfUrl, subirPdf } = useCalendario();
  const { firmantes, guardarFirmantes } = usePlantillas();
  const { message, showToast } = useToast();

  function changeView(nextView) {
    setPrefill(null);
    setView(nextView);
  }

  function handleSearchSubmit(query) {
    setHistorialQuery(query);
    setView(VISTA.HISTORIAL);
  }

  /** Ejecuta una operación del historial y, si la API falla, lo avisa en vez de fallar en silencio. */
  async function conAviso(operacion, mensaje) {
    try {
      await operacion();
    } catch (error) {
      console.error(mensaje, error);
      showToast(`${mensaje} ${error.message}`);
    }
  }

  async function handleGenerate({ tipo, data: datosFormulario }) {
    if (generando.current) return;
    generando.current = true;
    // Copia de quién firma hoy: si mañana cambia el Director o la
    // Secretaria, esta constancia se sigue reimprimiendo con su firma original.
    const { secretaria, director, ccpIniciales } = firmantes;
    const data = { ...datosFormulario, firmantes: { secretaria, director, ccpIniciales } };
    let entry;
    try {
      entry = await registrarConstancia({ tipo, data });
    } catch (error) {
      console.error('No se pudo registrar la constancia:', error);
      showToast(`No se generó la constancia: ${error.message}`);
      return;
    } finally {
      generando.current = false;
    }
    const folioSuffix = entry.folio.replace('FCI-', '');
    setPrefill(null);
    setView(VISTA.HISTORIAL);
    try {
      const { downloadConstanciaPdf } = await import('./pdf/downloadConstanciaPdf');
      await downloadConstanciaPdf({ tipo, data, folio: folioSuffix });
      showToast(`Constancia ${entry.folio} generada y descargada.`);
    } catch (error) {
      console.error('No se pudo generar el PDF:', error);
      showToast(
        `Constancia ${entry.folio} generada, pero el PDF falló. Descárgalo de nuevo desde el historial.`,
      );
    }
  }

  /**
   * "Duplicar para nueva emisión": precarga el formulario con los mismos
   * datos, con la fecha de expedición/consulta puesta en hoy (es una
   * emisión nueva) y el folio nuevo se asigna al generar.
   */
  function handleDuplicate(item) {
    // Sin la firma guardada de la original: la nueva emisión lleva a los firmantes vigentes.
    const { firmantes: _firmaOriginal, ...data } = item.data;
    if (data.fechaExpedicion) data.fechaExpedicion = todayStr();
    if (data.fechaConsulta) data.fechaConsulta = todayStr();
    setPrefill({ tipo: item.tipo, data });
    setView(TIPO_POR_VISTA[item.tipo] ?? VISTA.NUEVA_NORMAL);
  }

  async function handleImportar(entradas) {
    if (entradas.length === 0) {
      showToast('No se encontraron constancias válidas en ese archivo.');
      return;
    }
    let agregadas;
    try {
      agregadas = await importarHistorial(entradas);
    } catch (error) {
      console.error('No se pudo importar el respaldo:', error);
      showToast(`No se pudo importar el respaldo: ${error.message}`);
      return;
    }
    showToast(
      agregadas > 0
        ? `Se importaron ${agregadas} constancia(s) nueva(s).`
        : 'Ese respaldo no tenía constancias nuevas (ya estaban todas en el historial).',
    );
  }

  const tipoActual = TIPO_POR_VISTA[view];

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans antialiased">
      <Sidebar view={view} onChangeView={changeView} user={user} onLogout={onLogout} />
      <div className="pl-gutter-sidebar">
        <TopBar
          view={view}
          historialCount={historial.length}
          onSearch={handleSearchSubmit}
          user={user}
          onLogout={onLogout}
        />
        <main className="pt-16 min-h-screen">
          <div className="p-space-lg max-w-[1600px] mx-auto w-full">
            {cargando && (
              <div className="mb-space-md flex items-center gap-space-xs text-on-surface-variant text-label-md">
                <Icon name="progress_activity" className="animate-spin text-[16px]" />
                Cargando historial… (si el servidor estaba dormido puede tardar hasta un minuto)
              </div>
            )}
            {errorCarga && (
              <div className="mb-space-md flex items-center justify-between gap-space-sm rounded border border-error px-space-sm py-space-xs text-error text-label-md">
                <span>No se pudo cargar el historial: {errorCarga}</span>
                <button type="button" onClick={recargar} className="underline">
                  Reintentar
                </button>
              </div>
            )}
            {view === VISTA.INICIO && (
              <InicioView historial={historial} onVerHistorial={() => setView(VISTA.HISTORIAL)} />
            )}
            {view === VISTA.HISTORIAL && (
              <HistorialView
                historial={historial}
                query={historialQuery}
                onQueryChange={setHistorialQuery}
                onDuplicate={handleDuplicate}
                onAnular={(id) => conAviso(() => anularConstancia(id), 'No se pudo anular la constancia.')}
                onReactivar={(id) =>
                  conAviso(() => reactivarConstancia(id), 'No se pudo reactivar la constancia.')
                }
                onRegistrarDescarga={(id) =>
                  conAviso(() => registrarDescarga(id), 'No se pudo registrar la descarga.')
                }
                onImportar={handleImportar}
              />
            )}
            {tipoActual && (
              <NuevaConstanciaView
                key={view}
                tipo={tipoActual}
                nextFolio={nextFolio}
                initialData={prefill?.tipo === tipoActual ? prefill.data : null}
                onGenerate={handleGenerate}
                programas={programas}
                calendario={calendario}
                firmantes={firmantes}
              />
            )}
            {view === VISTA.PLANTILLAS && (
              <PlantillasView
                // Igual que el calendario: se vuelve a montar cuando llegan
                // firmantes nuevos de la base.
                key={firmantes.actualizado ?? 'inicial'}
                firmantes={firmantes}
                onGuardar={guardarFirmantes}
                showToast={showToast}
              />
            )}
            {view === VISTA.CALENDARIO && (
              <CalendarioView
                // El formulario copia el calendario al montarse; si llegan
                // fechas nuevas de la base (al cargar o tras guardar), se
                // vuelve a montar con ellas.
                key={calendario.actualizado ?? 'inicial'}
                calendario={calendario}
                onGuardar={guardarCalendario}
                pdfUrl={calendarioPdfUrl}
                onSubirPdf={subirPdf}
                showToast={showToast}
              />
            )}
          </div>
        </main>
      </div>
      <Toast message={message} />
    </div>
  );
}
