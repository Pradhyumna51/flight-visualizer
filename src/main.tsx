import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './index.css';
import './App.css';
import App from './App.tsx';

// Configure Cesium asset base URL
declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}
window.CESIUM_BASE_URL = '/cesium/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
