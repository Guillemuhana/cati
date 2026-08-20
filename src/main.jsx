import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { supabaseConfigured } from './lib/supabaseClient.js'
import { captureReferralFromUrl } from './lib/referral.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
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
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  )
}

// Red de seguridad para lo que el ErrorBoundary NO puede ver: un módulo
// que falla al cargar (una dependencia que no está, un import roto). Ahí
// React ni siquiera llega a dibujar, y sin esto la pantalla queda en
// blanco y muda. El CSP no deja poner un script suelto en el HTML, así
// que el cartel se arma acá, a mano.
window.addEventListener('error', (e) => {
  const raiz = document.getElementById('root')
  if (!raiz || raiz.childElementCount > 0) return // la app ya dibujó: no molestar
  raiz.textContent = ''
  const caja = document.createElement('div')
  caja.style.cssText =
    'min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#F7F6F2;color:#14181C;text-align:center'
  const texto = document.createElement('div')
  texto.style.maxWidth = '460px'
  const titulo = document.createElement('h1')
  titulo.style.cssText = 'font-size:18px;font-weight:600;margin-bottom:8px'
  titulo.textContent = 'La app no pudo arrancar'
  const detalle = document.createElement('pre')
  detalle.style.cssText =
    'white-space:pre-wrap;text-align:left;font-size:12px;color:#B4441F;background:rgba(0,0,0,.04);padding:12px;border-radius:8px;overflow:auto;max-height:200px'
  detalle.textContent = `${e?.message || e}`
  const ayuda = document.createElement('p')
  ayuda.style.cssText = 'font-size:13px;color:#5B6570;margin-top:12px;line-height:1.5'
  ayuda.textContent = 'Probá recargar con Ctrl+Shift+R. Si sigue, mandanos ese texto en rojo.'
  texto.append(titulo, detalle, ayuda)
  caja.append(texto)
  raiz.append(caja)
})
