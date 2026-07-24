# Cati — Presupuestos

App de presupuestos: cargá ítems, clientes y condiciones, generá un PDF con tu marca y compartilo por WhatsApp o email. Cada usuario tiene su propio panel con historial completo de lo que fue trabajando.

## Stack

- **React 18 + Vite**
- **React Router v6** (rutas)
- **Tailwind CSS** (diseño)
- **Supabase** (auth + Postgres + storage de logos)
- **@react-pdf/renderer** (generación de PDF 100% en el cliente)

## 1. Crear el proyecto en Supabase

1. Andá a [supabase.com](https://supabase.com) → **New project**.
2. En **SQL Editor**, pegá y ejecutá el contenido de `supabase/schema.sql`. Esto crea:
   - `profiles` (datos del negocio)
   - `clients` (clientes)
   - `budgets` (presupuestos)
   - `budget_items` (ítems de cada presupuesto)
   - políticas de **Row Level Security** para que cada usuario solo vea sus propios datos
   - el bucket público `logos` para los logos de negocio
3. En **Authentication → Providers**, dejá habilitado **Email**. Si no querés confirmación de email obligatoria (para probar más rápido), desactivá "Confirm email" en **Authentication → Settings**.
4. En **Project Settings → API**, copiá `Project URL` y `anon public key`.

## 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Completá `.env` con los valores del paso anterior:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## 3. Instalar y correr en local

```bash
npm install
npm run dev
```

La app queda en `http://localhost:5173`.

## 4. Deploy (recomendado: Vercel)

```bash
npm run build
```

Subí el repo a GitHub y conectalo en Vercel, o usá `vercel --prod`. Configurá las mismas variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en el proyecto de Vercel.

## Estructura del proyecto

```
src/
  components/     → UI reutilizable (Layout, ItemsTable, StatusBadge, etc.)
  context/         → AuthContext (sesión + perfil de negocio)
  lib/             → supabaseClient, cálculo de totales, generador de PDF
  pages/           → Home, Login, Register, Dashboard, Presupuestos, Clientes, Perfil
supabase/
  schema.sql       → esquema completo de base de datos + RLS + storage
```

## Funcionalidades incluidas

- **Registro / login** con Supabase Auth (email + contraseña).
- **Panel (cpanel)**: estadísticas de presupuestos (total, enviados, aprobados, montos) y actividad reciente.
- **Presupuestos**: creación y edición completa — ítems con cantidad/precio/descuento por línea, descuento global (% o monto fijo), impuesto, moneda, fechas de emisión/vencimiento, notas y condiciones. Numeración automática `CATI-0001`, `CATI-0002`, etc.
- **Estados**: borrador, enviado, aprobado, rechazado, vencido — cambiables con un clic desde el detalle.
- **PDF**: se genera 100% en el navegador (sin backend adicional) con el logo y datos del negocio, ítems, totales y condiciones. Botón de **descarga** y botón de **compartir** (usa la Web Share API en celulares para mandar el PDF directo por WhatsApp; si el navegador no soporta compartir archivos, descarga el PDF).
- **Clientes**: alta, edición y borrado. Se pueden crear al vuelo desde el formulario de presupuesto.
- **Mi negocio**: nombre, logo (con subida a Supabase Storage), datos fiscales, moneda por defecto y condiciones por defecto.
- **Responsive**: sidebar fija en desktop, barra de navegación inferior + menú lateral en mobile. Formularios y tablas se adaptan a pantalla chica.
- **Seguridad**: Row Level Security en todas las tablas — cada usuario solo puede leer y modificar sus propios datos.

## Notas de diseño

Paleta minimalista sobre fondo piedra cálido (`#F7F6F2`), acento verde tinta (`#1F6F5C`) y detalles en bronce (`#B08D45`). Tipografía `Fraunces` (display) + `Manrope` (UI) + `IBM Plex Mono` para todos los números y montos, dándole a los presupuestos un aire de recibo/ledger prolijo. El componente de estado (`StatusBadge`) simula un sello, y los ítems del PDF usan líneas de guía tipo menú/recibo.

## Próximos pasos sugeridos

- Envío de presupuestos por email directo desde la app (vía Edge Function + proveedor SMTP).
- Firma digital del cliente para aprobar el presupuesto desde un link público.
- Plantillas de ítems reutilizables por rubro.
- Exportar reportes (CSV) desde el panel.
