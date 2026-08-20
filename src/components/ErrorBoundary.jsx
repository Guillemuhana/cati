import { Component } from 'react'

// Cuando algo explota mientras React dibuja, React desmonta TODO el árbol
// y la pantalla queda en blanco. En blanco no se puede arreglar nada: ni
// el usuario sabe qué pasó, ni nosotros. Esto lo agarra y muestra el
// error, con un botón para volver.
//
// Solo atrapa errores de dibujado. Los de carga de módulos se atrapan en
// main.jsx, que es lo único que corre antes que esto.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Queda en la consola con el árbol de componentes, que es lo que
    // sirve para encontrarlo.
    console.error('[Numera] Error de dibujado:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <PantallaDeError
        error={this.state.error}
        onReintentar={() => this.setState({ error: null })}
      />
    )
  }
}

export function PantallaDeError({ error, onReintentar }) {
  const detalle = `${error?.message || error}`
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper p-6">
      <div className="w-full max-w-md rounded-xl2 border border-line bg-surface p-6 text-center shadow-soft">
        <p className="text-4xl">😕</p>
        <h1 className="mt-3 font-display text-xl font-medium text-ink">Algo se rompió en esta pantalla</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Tus datos están a salvo: esto es un error de la app, no de tu información.
        </p>

        <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-ink/[0.04] p-3 text-left text-xs leading-relaxed text-rust-500">
          {detalle}
        </pre>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => window.location.reload()}
            className="btn-primary flex-1 rounded-md py-2.5 text-sm font-semibold"
          >
            Recargar
          </button>
          {onReintentar && (
            <button
              onClick={onReintentar}
              className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:text-ink"
            >
              Reintentar
            </button>
          )}
          <a
            href="/"
            className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:text-ink"
          >
            Ir al inicio
          </a>
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          Si vuelve a pasar, mandanos ese texto en rojo: dice exactamente qué falló.
        </p>
      </div>
    </div>
  )
}
