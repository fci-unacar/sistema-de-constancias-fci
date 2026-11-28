import { inputClass } from '../../components/auth/PasswordInput';

/**
 * Campo de texto del portal de alumnos. Igual que el del panel, pero con
 * letra de 16 px: con menos, Safari en iPhone hace zoom al tocar el campo y
 * la pantalla queda descuadrada. Los alumnos entran casi siempre desde el
 * celular.
 */
export const inputAlumno = inputClass.replace('text-body-md', 'text-[16px]');
