import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Input de contraseña con el ojito para espiar lo que uno escribió.
//
// Arranca siempre tapado y el estado no se guarda en ningún lado: el ojo
// sirve para chequear que no se coló un dedo, no para dejar la clave a la
// vista de quien pase por atrás.
export default function CampoPassword({
  value,
  onChange,
  autoComplete = 'current-password',
  required = true,
  placeholder,
  minLength,
  autoFocus = false
}) {
  const [ver, setVer] = useState(false)

  return (
    <div className="relative">
      <input
        type={ver ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full rounded-md border border-line py-2.5 pl-3 pr-11 text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-faint hover:text-ink-soft focus:outline-none"
      >
        {ver ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
