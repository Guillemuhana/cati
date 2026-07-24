import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    // No publicar el código legible (sin source maps en producción).
    sourcemap: false
  },
  // Solo en el build de producción: quita console.* y debugger.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {}
}))
