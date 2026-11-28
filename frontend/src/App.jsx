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
import SolicitudesView from './views/SolicitudesView';
import { useSolicitudes } from './hooks/useSolicitudes';
import { useToast } from './hooks/useToast';
import { VISTA, TIPO_POR_VISTA, VISTA_POR_TIPO } from './constants/tipos';
import { todayStr } from './utils/spanishText';
import { textoAvisoCorreo } from './constants/solicitudes';

export default function App({ user, onLogout }) {
  const [view, setView] = useState(VISTA.INICIO);
  const [prefill, setPrefill] = useState(null); // { tipo, data } al "duplicar para nueva emisión"
  // Solicitud de alumno que se está atendiendo: al generar su constancia queda como "lista".
  const [solicitudEnCurso, setSolicitudEnCurso] = useState(null);
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
  const solicitudesAlumnos = useSolicitudes();
  const { message, showToast } = useToast();

  /** Deja libre la solicitud que se estaba atendiendo, para que otra persona pueda tomarla. */
  function soltarSolicitudEnCurso() {
    if (!solicitudEnCurso) return;
    solicitudesAlumnos
      .soltar(solicitudEnCurso.id)
      // Si falla, la toma vence sola a la hora.
      .catch((error) => console.warn('No se pudo soltar la solicitud:', error.message));
    setSolicitudEnCurso(null);
  }

  function changeView(nextView) {
    setPrefill(null);
    soltarSolicitudEnCurso();
    setView(nextView);
    if (nextView === VISTA.SOLICITUDES) solicitudesAlumnos.recargar();
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
    // Antes de gastar un folio, confirmar que la solicitud sigue siendo de
    // quien la atiende (la toma renueva su hora). Si otra persona la tomó o
    // ya la atendieron, no se genera nada.
    if (solicitudEnCurso) {
      try {
        await solicitudesAlumnos.tomar(solicitudEnCurso.id);
      } catch (error) {
        generando.current = false;
        setPrefill(null);
        setSolicitudEnCurso(null);
        setView(VISTA.SOLICITUDES);
        showToast(`No se generó la constancia: ${error.message}`);
        return;
      }
    }
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
    const solicitud = solicitudEnCurso;
    setPrefill(null);
    setSolicitudEnCurso(null);
    setView(solicitud ? VISTA.SOLICITUDES : VISTA.HISTORIAL);
    let avisoSolicitud = '';
    if (solicitud) {
      try {
        const { notificacion } = await solicitudesAlumnos.marcarLista(solicitud.id, entry.id);
        avisoSolicitud = ` La solicitud del alumno quedó como lista.${textoAvisoCorreo(notificacion)}`;
      } catch (error) {
        console.error('No se pudo marcar la solicitud como lista:', error);
        avisoSolicitud = ` No se pudo marcar la solicitud como lista: ${error.message}`;
      }
    }
    try {
      const { downloadConstanciaPdf } = await import('./pdf/downloadConstanciaPdf');
      await downloadConstanciaPdf({ tipo, data, folio: folioSuffix });
      showToast(`Constancia ${entry.folio} generada y descargada.${avisoSolicitud}`);
    } catch (error) {
      console.error('No se pudo generar el PDF:', error);
      showToast(
        `Constancia ${entry.folio} generada, pero el PDF falló. Descárgalo de nuevo desde el historial.${avisoSolicitud}`,
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
    soltarSolicitudEnCurso();
    setView(VISTA_POR_TIPO[item.tipo] ?? VISTA.NUEVA_NORMAL);
  }

  /**
   * "Generar" desde la bandeja de solicitudes: la toma a nombre de quien la
   * atiende (si otra persona ya la tiene, avisa y no abre nada) y abre el
   * formulario del tipo pedido con los datos que capturó el alumno. Las
   * fechas del semestre y la de expedición se llenan igual que en una
   * constancia nueva.
   */
  async function handleAtenderSolicitud(solicitud) {
    try {
      await solicitudesAlumnos.tomar(solicitud.id);
    } catch (error) {
      showToast(error.message);
      return;
    }
    const { tipo, nombre, matricula, programa } = solicitud;
    setPrefill({ tipo, data: { alumno: nombre, matricula, programa } });
    setSolicitudEnCurso(solicitud);
    setView(VISTA_POR_TIPO[tipo] ?? VISTA.NUEVA_NORMAL);
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
      <Sidebar
        view={view}
        onChangeView={changeView}
        user={user}
        onLogout={onLogout}
        solicitudesPendientes={solicitudesAlumnos.pendientes}
      />
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
              <InicioView
                historial={historial}
                onVerHistorial={() => setView(VISTA.HISTORIAL)}
                solicitudesPendientes={solicitudesAlumnos.pendientes}
                solicitudesAtrasadas={solicitudesAlumnos.atrasadas}
                onVerSolicitudes={() => changeView(VISTA.SOLICITUDES)}
              />
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
            {tipoActual && solicitudEnCurso && (
              <div className="mb-space-md flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-secondary-fixed px-space-md py-space-sm text-on-secondary-fixed text-label-md">
                <span className="flex items-center gap-space-xs">
                  <Icon name="inbox" className="text-[18px]" />
                  <span>
                    Atendiendo la solicitud de <strong>{solicitudEnCurso.nombre}</strong> (
                    {solicitudEnCurso.matricula}). Está apartada a tu nombre: nadie más puede atenderla
                    mientras tanto. Al generar, quedará como lista.
                  </span>
                </span>
                <button type="button" onClick={() => changeView(VISTA.SOLICITUDES)} className="underline">
                  Volver a solicitudes
                </button>
              </div>
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
            {view === VISTA.SOLICITUDES && (
              <SolicitudesView
                solicitudes={solicitudesAlumnos.solicitudes}
                cargando={solicitudesAlumnos.cargando}
                errorCarga={solicitudesAlumnos.errorCarga}
                disponible={solicitudesAlumnos.disponible}
                onRecargar={solicitudesAlumnos.recargar}
                usuarioEmail={user?.email}
                onAtender={handleAtenderSolicitud}
                onSoltar={(id) =>
                  conAviso(() => solicitudesAlumnos.soltar(id), 'No se pudo soltar la solicitud.')
                }
                onRechazar={async (id, motivo) => {
                  // Si falla, RechazoModal muestra el error y se queda abierto.
                  const { notificacion } = await solicitudesAlumnos.rechazar(id, motivo);
                  showToast(`Solicitud rechazada.${textoAvisoCorreo(notificacion)}`);
                }}
                onRegresarAPendiente={(id) =>
                  conAviso(
                    () => solicitudesAlumnos.regresarAPendiente(id),
                    'No se pudo regresar la solicitud.',
                  )
                }
                onDescargarVoucher={solicitudesAlumnos.descargarVoucher}
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
