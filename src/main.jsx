import React from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles/main.css'
import App from './App.jsx'
import './styles/operational.css'

async function bootstrap() {
  try {
    const response = await fetch('/runtime-config', { cache: 'no-store' })
    if (response.ok) window.__BOVISAFE_CONFIG__ = await response.json()
  } catch { /* Build-time VITE_API_URL remains the offline/development fallback. */ }
  createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
}
bootstrap()
