import { useState } from 'react';
import Icon from '../../components/atoms/Icon';
import { inputClass } from '../../components/auth/PasswordInput';
import logoUnacar from '../../assets/logo-unacar.png';
import logoFci from '../../assets/logo-fci.png';

const botonPrimario =
  'flex h-11 items-center justify-center gap-space-xs rounded-lg bg-primary font-bold text-on-primary shadow-md transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40';
const enlace = 'font-bold text-secondary hover:underline disabled:opacity-40';

/**
 * Entrada al portal de alumnos, sin contraseña. Dos pasos:
 * 1) correo institucional → la API manda un código a ese correo;
 * 2) código → la API lo verifica y el alumno queda dentro.
 */
export default function AlumnoLoginView({
  onPedirCodigo,
  onVerificarCodigo,
  error: errorInicial,
  disponible,
}) {
  const [paso, setPaso] = useState('correo');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(errorInicial);

  async function ejecutar(accion) {
    setEnviando(true);
    setError(null);
    try {
      await accion();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function pedirCodigo(e) {
    e?.preventDefault();
    ejecutar(async () => {
      const { mensaje } = await onPedirCodigo(email.trim());
      setAviso(mensaje);
      setCodigo('');
      setPaso('codigo');
    });
  }

  function verificar(e) {
    e.preventDefault();
    // Si sale bien, AlumnosRoot cambia al panel y este formulario desaparece.
    ejecutar(() => onVerificarCodigo(email.trim(), codigo));
  }

  const mensajeError = error && (
    <p role="alert" className="flex items-start gap-space-2xs text-error text-label-md">
      <Icon name="error" className="mt-0.5 text-[16px]" />
      {error}
    </p>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-space-md py-space-lg font-sans text-on-surface antialiased">
      <div className="flex w-full max-w-[420px] flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-md">
        <div className="flex flex-col items-center gap-space-sm text-center">
          <div className="flex items-center gap-space-md">
            <img src={logoUnacar} alt="UNACAR" className="h-14 w-auto" />
            <img src={logoFci} alt="Facultad de Ciencias de la Información" className="h-14 w-auto" />
          </div>
          <div className="flex flex-col gap-space-2xs">
            <h1 className="font-semibold text-primary text-title-md">Solicitud de Constancias</h1>
            <p className="text-on-surface-variant text-label-md">
              Portal de alumnos · Facultad de Ciencias de la Información
            </p>
          </div>
        </div>

        {!disponible && (
          <p className="flex items-start gap-space-2xs rounded-lg bg-warning-container p-space-sm text-warning text-label-sm">
            <Icon name="warning" className="mt-0.5 text-[16px]" />
            El portal de alumnos necesita el servidor (VITE_API_URL y VITE_AUTH_ENABLED=true), así que por
            ahora no se pueden mandar solicitudes. Avisa a la Secretaría Académica.
          </p>
        )}

        {paso === 'correo' ? (
          <form className="flex flex-col gap-space-md" onSubmit={pedirCodigo}>
            <p className="text-on-surface-variant text-label-md">
              Escribe tu correo institucional. Te enviaremos un código para entrar; no necesitas contraseña.
            </p>
            <label className="flex flex-col gap-space-2xs">
              <span className="font-bold text-label-md">Correo institucional</span>
              <input
                type="email"
                autoComplete="email"
                required
                autoFocus
                className={inputClass}
                placeholder="matricula@delfin.unacar.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {mensajeError}

            <button type="submit" disabled={enviando || !disponible} className={botonPrimario}>
              <Icon name="mail" className="text-[18px]" />
              {enviando ? 'Enviando…' : 'Enviarme un código'}
            </button>
          </form>
        ) : (
          <form className="flex flex-col gap-space-md" onSubmit={verificar}>
            {aviso && (
              <p className="flex items-start gap-space-2xs rounded-lg bg-surface-container p-space-sm text-on-surface-variant text-label-sm">
                <Icon name="info" className="mt-0.5 text-[16px] text-secondary" />
                {aviso}
              </p>
            )}

            <label className="flex flex-col gap-space-2xs">
              <span className="font-bold text-label-md">Código</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                maxLength={10}
                className={`${inputClass} tracking-[0.3em]`}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              />
            </label>

            {mensajeError}

            <button type="submit" disabled={enviando} className={botonPrimario}>
              <Icon name="login" className="text-[18px]" />
              {enviando ? 'Verificando…' : 'Entrar'}
            </button>

            <div className="flex justify-between text-label-sm">
              <button type="button" onClick={() => pedirCodigo()} disabled={enviando} className={enlace}>
                Reenviar código
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaso('correo');
                  setError(null);
                }}
                disabled={enviando}
                className={enlace}
              >
                Usar otro correo
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-outline text-label-sm">
          ¿Eres personal de la Secretaría?{' '}
          <a href="/" className="font-bold text-secondary hover:underline">
            Entra al panel administrativo
          </a>
        </p>
      </div>
    </div>
  );
}
