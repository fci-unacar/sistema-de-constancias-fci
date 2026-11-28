import Icon from './components/atoms/Icon';
import AlumnoLoginView from './views/alumnos/AlumnoLoginView';
import AlumnoPanelView from './views/alumnos/AlumnoPanelView';
import { useAlumnoAuth } from './hooks/useAlumnoAuth';
import { AUTH } from './hooks/useAuth';

/** Portal de alumnos (/alumnos): la entrada con código hasta que haya sesión; después, su panel. */
export default function AlumnosRoot() {
  const { status, user, error, disponible, pedirCodigo, verificarCodigo, logout } = useAlumnoAuth();

  if (status === AUTH.CHECKING) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-space-xs bg-background font-sans text-on-surface-variant">
        <Icon name="progress_activity" className="animate-spin text-[20px]" />
        Verificando sesión…
      </div>
    );
  }

  if (status === AUTH.ANON) {
    return (
      <AlumnoLoginView
        onPedirCodigo={pedirCodigo}
        onVerificarCodigo={verificarCodigo}
        error={error}
        disponible={disponible}
      />
    );
  }

  return <AlumnoPanelView user={user} onLogout={logout} />;
}
