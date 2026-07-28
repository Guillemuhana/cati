# Seguridad de Numera

Auditoría del 27/07/2026. Este archivo es la checklist viva: cuando toques
cobros, permisos o la base de datos, volvé acá.

---

## 1. Aplicar la migración (URGENTE — hacelo primero)

Supabase Dashboard → SQL Editor → New query → pegá todo
`supabase/migration_07_seguridad.sql` → Run.

**Hasta que no la corras, cualquier usuario registrado puede darse premium
gratis desde la consola del navegador con esto:**

```js
// Esto FUNCIONABA antes de la migración 07:
await supabase.from('profiles')
  .update({ plan: 'premium', premium_until: '2099-01-01' })
  .eq('id', (await supabase.auth.getUser()).data.user.id)
```

Después de aplicarla, esa llamada devuelve `permission denied for table profiles`.

**Cómo verificar que quedó bien** (logueate en la app, abrí la consola del
navegador y pegá lo de arriba): tiene que fallar. Si devuelve datos, la
migración no se aplicó.

---

## 2. Qué se arregló en esta pasada

| # | Riesgo | Estado |
|---|--------|--------|
| 1 | **Auto-asignarse premium** editando la propia fila de `profiles` | ✅ GRANT por columna + trigger `profiles_guard` |
| 2 | **Prueba de 72 h infinita**: el navegador elegía `trial_ends_at` | ✅ la fija el trigger `handle_new_user` en la BD |
| 3 | **Premium solo bloqueado en React**: la API REST se usaba igual sin pagar | ✅ RLS con `is_premium()` en products, budget_templates, invoices, receipts |
| 4 | Enlace público seguía activo con la suscripción vencida | ✅ `get_public_budget` valida premium |
| 5 | Cualquiera con el link podía alternar aceptado/rechazado sin límite | ✅ la respuesta queda congelada |
| 6 | El JSON público exponía `public_token` (el secreto del propio link) | ✅ se quita del payload |
| 7 | Bucket `logos`: cualquier archivo, cualquier tamaño | ✅ 2 MB, solo png/jpeg/webp |
| 8 | No había forma de invalidar un link ya compartido | ✅ RPC `rotate_budget_token` |

Ya estaba bien de antes y **no lo toques**: RLS activo en todas las tablas,
CSP y headers en `vercel.json`, `.env` en `.gitignore` (verificado: nunca se
commiteó), sin source maps en producción, `console.*` eliminado en el build,
tokens públicos con UUID v4 (122 bits — no se adivinan por fuerza bruta).

---

## 3. Cobros con Stripe — la parte que falta

`PAYMENT_URL` está vacío en `src/lib/config.js`. Cuando lo actives:

**Regla de oro: el navegador nunca activa premium.** La única vía es el webhook
de Stripe → Edge Function → `admin_set_premium()`.

Si en cambio activás premium desde el front después de volver de Stripe
(`?success=true` o similar), cualquiera se suscribe gratis visitando esa URL a mano.

Flujo correcto:

1. Payment Link de Stripe con precio recurrente USD 2/mes.
2. Pasá el email del usuario a Stripe (`client_reference_id` o prefilled email)
   para poder identificarlo después.
3. Edge Function `stripe-webhook` en Supabase que:
   - lee el header `stripe-signature` y **verifica la firma** con
     `STRIPE_WEBHOOK_SECRET` (sin esto, cualquiera te falsifica un pago con un
     `curl`);
   - en `checkout.session.completed` e `invoice.payment_succeeded` →
     `admin_set_premium(email, 1)`;
   - en `customer.subscription.deleted` → `admin_cancel_premium(email)`.
4. La función usa `SUPABASE_SERVICE_ROLE_KEY` como secreto de la Edge Function.

**El `service_role` key no va NUNCA en el front, ni en una variable `VITE_*`.**
Todo lo que empieza con `VITE_` termina dentro del JavaScript público que
descarga cualquier visitante. El `anon` key sí es público y está bien que lo sea
(es RLS lo que protege los datos, no el secreto de esa clave).

5. Agregá Stripe al CSP de `vercel.json` (`connect-src` y `frame-src` con
   `https://js.stripe.com https://api.stripe.com`), si no el checkout se bloquea.

Mientras tanto, activación manual desde el SQL Editor:

```sql
select public.admin_set_premium('cliente@ejemplo.com', 1);   -- +1 mes
select public.admin_cancel_premium('cliente@ejemplo.com');   -- baja
```

---

## 4. Configuración del panel de Supabase (5 minutos, hacelo)

Authentication → Settings:

- [ ] **Confirm email: ON.** Sin esto se registran con emails ajenos o inventados.
- [ ] **Leaked password protection: ON** (Auth → Passwords). Cruza contra
      HaveIBeenPwned y frena las contraseñas ya filtradas.
- [ ] **Minimum password length: 8** o más.
- [ ] **Site URL y Redirect URLs**: solo tu dominio real. Si dejás comodines,
      un atacante se lleva el token de sesión a su propio dominio.
- [ ] Revisá los **rate limits** de Auth (los default están bien; no los subas).

Settings → Database:

- [ ] **Backups**: en el plan Free son 7 días. Si esto va a tener clientes
      pagando, el plan Pro (backups diarios + PITR) es lo mínimo razonable.
- [ ] **Nunca** expongas la base directamente; todo pasa por PostgREST + RLS.

---

## 5. Que no te copien el producto

- `LICENSE` ya es propietaria (todos los derechos reservados) ✅
- **El repo de GitHub tiene que ser privado.** No pude verificarlo (no hay
  sesión de `gh` acá). Andá a
  https://github.com/Guillemuhana/cati/settings → Danger Zone → Change
  visibility → Private. Si estuvo público, asumí que alguien pudo clonarlo.
- El JavaScript del front **siempre** es legible por cualquiera; no hay forma de
  evitarlo en una SPA. Lo que no puede copiarse es tu base de datos, tus
  clientes y tu marca. Por eso lo importante es que la lógica de negocio que da
  valor (y la de cobro) viva en el servidor, no en React.
- Ya tenés `sourcemap: false` y `drop: ['console','debugger']`, que es lo
  razonable. Ofuscar más no aporta seguridad real.
- Registrá la marca "Numera"/"Cati" si el proyecto avanza — vale más que
  cualquier medida técnica contra un competidor.

---

## 6. Regla permanente

Cada vez que agregues una función premium, gatearla en **dos** lugares:

1. RLS o RPC en Postgres → `public.is_premium(auth.uid())` ← esto es lo que
   realmente protege.
2. `PremiumGate` / `usePlan` en React ← esto es solo para que se vea lindo.

Si solo hacés el 2, la función es gratis para cualquiera que sepa abrir la
pestaña Network.

---

## 7. Lo que NO revisé

- El proyecto Supabase de Numera (`hzkfqbccayoooteqyfeu`) no está en la cuenta
  conectada acá, así que la auditoría es sobre los archivos SQL del repo. Si
  alguna vez corriste SQL suelto en el panel que no quedó en `supabase/*.sql`,
  esa parte no la vi.
- Sí revisé el otro proyecto de tu cuenta (`Guillemuhana's Project`, el del CRM
  con `contactos`/`mensajes`/`vendedores`): tiene **12 políticas RLS con
  `USING (true)`**, o sea cualquier usuario logueado lee y escribe los datos de
  todos. Es otra app, pero si tiene datos reales de clientes conviene mirarlo
  aparte.
