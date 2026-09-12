import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { clearAllStores } from './services/db'

// Global helper for resetting data to start completely fresh
(window as unknown as { resetPersonalOS: () => Promise<void> }).resetPersonalOS = async () => {
  await clearAllStores();
  localStorage.clear();
  window.location.reload();
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
