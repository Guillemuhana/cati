import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { supabaseConfigured } from './lib/supabaseClient.js'
import { captureReferralFromUrl } from './lib/referral.js'
import './index.css'

// Si la visita llegó por un link de invitación (?ref=), lo guardamos antes
// de que el router limpie la URL.
captureReferralFromUrl()

const root = ReactDOM.createRoot(document.getElementById('root'))

if (!supabaseConfigured) {
  root.render(
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#F7F6F2',
        color: '#14181C'
      }}
    >
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <img src="/numera-icon.svg" alt="Numera" width={56} height={56} style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Falta configurar Supabase</h1>
        <p style={{ fontSize: 14, color: '#5B6570', lineHeight: 1.5 }}>
          No se encontraron las variables <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>. En Vercel: <b>Settings → Environment Variables</b>,
          agregalas y volvé a desplegar (<b>Redeploy</b>).
        </p>
      </div>
    </div>
  )
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
}
