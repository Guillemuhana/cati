import { useMemo, useState } from 'react'

export default function ClientPicker({ clients, value, onChange, onCreateClient }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' })

  const selected = clients.find((c) => c.id === value)

  const filtered = useMemo(() => {
    if (!query) return clients
    const q = query.toLowerCase()
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
  }, [clients, query])

  const handleCreate = async () => {
    if (!newClient.name.trim()) return
    const created = await onCreateClient(newClient)
    if (created) {
      onChange(created.id)
      setCreating(false)
      setOpen(false)
      setNewClient({ name: '', email: '', phone: '' })
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-line bg-white px-3 py-2.5 text-left text-sm"
      >
        <span className={selected ? 'text-ink' : 'text-ink-faint'}>{selected ? selected.name : 'Seleccionar cliente'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16" className="text-ink-faint">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-surface shadow-soft">
          {!creating ? (
            <>
              <div className="p-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar cliente..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filtered.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      onChange(c.id)
                      setOpen(false)
                    }}
                    className="block w-full min-w-0 px-3 py-2 text-left text-sm text-ink hover:bg-brand-500/[0.06]"
                  >
                    <span className="block truncate">{c.name}</span>
                    {c.email && (
                      <span className="block truncate text-xs text-ink-faint">{c.email}</span>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && <p className="px-3 py-2 text-sm text-ink-faint">Sin resultados.</p>}
              </div>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-500/[0.05]"
              >
                + Nuevo cliente
              </button>
            </>
          ) : (
            <div className="space-y-2 p-3">
              <input
                autoFocus
                type="text"
                placeholder="Nombre *"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="flex-1 rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Crear y usar
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft"
                >
                  Volver
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
