import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Root from './Root.jsx';
import AlumnosRoot from './AlumnosRoot.jsx';
import { despertarApi } from './lib/api';
import { ES_PORTAL_ALUMNOS } from './lib/portal';

// Lo antes posible: la API de Render puede estar dormida (ver lib/api.js).
despertarApi();

createRoot(document.getElementById('root')).render(
  <StrictMode>{ES_PORTAL_ALUMNOS ? <AlumnosRoot /> : <Root />}</StrictMode>,
);
