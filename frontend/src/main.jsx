import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Root from './Root.jsx';
import { despertarApi } from './lib/api';

// Lo antes posible: la API de Render puede estar dormida (ver lib/api.js).
despertarApi();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
