import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SiteDataProvider } from './context/SiteDataContext';
import './glass.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteDataProvider>
      <App />
    </SiteDataProvider>
  </StrictMode>
);
