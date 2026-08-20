# Seguridad de Numera

Auditoría del 27/07/2026, actualizada el 28/07/2026 (invitaciones + fin de la
etapa gratis). Este archivo es la checklist viva: cuando toques cobros,
permisos o la base de datos, volvé acá.

---

## 0. Migraciones pendientes de aplicar

En orden, en Supabase Dashboard → SQL Editor → New query → pegar → Run:

| Archivo | Qué hace | ¿Se puede postergar? |
|---|---|---|
| `migration_10_invitaciones.sql` | Link de invitación, 3 invitados = 3 meses premium | Sí, pero la pantalla «Invitar y ganar» no cuenta nada hasta que la corras |
| `migration_11_fin_promo_noviembre_2026.sql` | La etapa gratis termina sola el 1/11/2026 | **No.** Hasta que no la corras, `is_premium()` devuelve `true` para siempre y el 1/11 no se cobra nada |
| `migration_12_admin.sql` | Panel de administrador en `/admin` | Sí, pero el panel no muestra nada hasta que la corras |
| `migration_13_admin_detalle.sql` | Ficha de usuario, regalos con motivo **y arregla un cerrojo que no funcionaba** | Correla: ver abajo |
| `migration_14_notificaciones.sql` | Avisos en la app: al usuario le llega la campanita cuando le regalás meses | Sí, pero los regalos pasan desapercibidos |
| `migration_18_sin_borrador_y_logo_cliente.sql` | Se saca el estado «borrador» y los clientes pueden tener logo | Sí |
| `migration_19_rubro.sql` | Rubro del negocio, para arrancar con textos propios | Sí |
| `migration_20_imagenes_presupuesto.sql` | Hasta 4 imágenes por presupuesto (bucket `adjuntos`) | Sí |
| `migration_21_seguridad_adjuntos.sql` | Cierra el listado del Storage y valida las URLs de las imágenes | **No, si corriste la 20.** Ver la sección 8 |

Detalle de la 14: el usuario **no puede insertar avisos** (`revoke all`, solo
`select` y `update (read_at)`). Si pudiera, cualquiera se fabricaría un «te
regalamos 12 meses» y te mandaría la captura pidiendo que se lo cumplas.

**El orden importa**: la 12 usa cosas que crean la 10 y la 11. Si las salteás,
falla con `relation does not exist` y no se aplica nada (no rompe nada, pero no
sirve).

**Ojo con la 11**: es la que reactiva el candado del servidor que la migración 09
había desarmado (`select true`). Si el 1 de noviembre solo cambiás el JavaScript,
la app *se ve* cerrada pero la API REST sigue regalando todo a cualquiera que
abra la pestaña Network. La fecha vive en `public.free_until()` y en
`FREE_UNTIL` de `src/lib/config.js`: **si movés una, mové la otra.**

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

### Invitaciones (migraciones 10 y 11)

El premio son 3 meses de premium: o sea, plata. Lo que se hizo para que no se
regale solo:

| Riesgo | Cómo está cerrado |
|---|---|
| Autoasignarse el premio desde la consola | El contador y `premium_until` los toca **solo** un trigger `security definer`. El cliente no tiene GRANT de UPDATE sobre esas columnas y `profiles_guard` las restaura si alguna vez se lo dieran |
| Inventar 3 emails falsos y cobrar | La invitación cuenta recién con el **email confirmado** (trigger `on_auth_user_confirmed`). Por eso *Confirm email* tiene que quedar en ON |
| Invitarse a uno mismo | `register_referral` descarta `ref_id = p_invited` |
| Cobrar el premio dos veces | `referral_bonus_at is null` en el UPDATE + el `where status = 'pendiente'` del confirm, que hace de candado contra el doble conteo |
| Escribir filas de `referrals` a mano | `revoke all` + GRANT de SELECT solo sobre columnas no sensibles |
| Ver el email del invitado | Quien invita solo ve `invited_masked` (`ju•••@gmail.com`); el email completo no tiene GRANT |
| Enumerar códigos ajenos | `profiles` solo deja leer la fila propia; el lookup del código ocurre dentro del trigger |
| Basura en `raw_user_meta_data` (lo único que elige el atacante en el alta) | `handle_new_user` recorta `business_name` a 120 caracteres, saca caracteres de control y valida el código contra `^[A-Z0-9]{4,12}$` |

Lo que **no** está resuelto y conviene mirar si el programa crece: alguien
decidido puede registrar 3 cuentas con 3 emails reales propios y cobrarse los 3
meses. Es el techo de cualquier programa de referidos sin verificación de
identidad; el costo máximo del abuso son 3 meses por cuenta, y el tope de 3
invitados existe justamente para acotarlo. Si un día pesa, la señal a mirar son
varias altas seguidas desde la misma IP con el mismo código.

### 🐛 Bug encontrado el 28/07/2026: el segundo cerrojo no funcionaba

`profiles_guard()` (migración 07, punto 1.b) preguntaba
`current_user in ('authenticated','anon')` para saber si quien edita es el
navegador. Adentro de una función `SECURITY DEFINER`, **`current_user` es el
dueño de la función (`postgres`), nunca el que llama**. Esa condición daba
`false` siempre, así que el guard no restauraba ningún campo.

**No hubo agujero real**: lo que protege de verdad es el GRANT por columna del
punto 1.a, y ese sí funciona — por eso el ataque de la sección 1 sigue fallando.
Pero el "segundo cerrojo" era decorativo, y un cerrojo decorativo es peor que no
tenerlo, porque uno cuenta con él.

Arreglado en la migración 13 con `public.caller_role()`, que lee el rol del JWT
(`authenticated` / `anon` / `service_role`, o `NULL` si no hay token). Si algún
día escribís otra función que necesite saber quién la llama, usá esa — **nunca
`current_user` dentro de un `SECURITY DEFINER`.**

### Panel de administrador (migración 12)

Es la superficie **más sensible** de la app: por esos RPC pasa la base entera
(emails de todos los usuarios, planes, montos). Cómo está cerrado:

| Riesgo | Cómo está cerrado |
|---|---|
| Que un usuario común lea la base entera | Los 5 RPC arrancan con `if not public.is_admin() then raise exception 'no autorizado'`. Sin eso, `grant … to authenticated` sería un desastre |
| Apropiarse del panel cambiándose el email a `guillemuhana@gmail.com` | El admin se identifica por **`user_id`**, no por el email del token. Una dirección se puede reclamar; un uuid no |
| Averiguar quiénes son los admins | La tabla `admins` tiene RLS activo y **cero políticas**: PostgREST no devuelve ni una fila a nadie |
| Regalarse premium desde `/admin` sin ser admin | Igual que arriba: `admin_grant_premium` chequea primero. El botón del front es solo un botón |
| Que una activación quede sin rastro | Toda alta/baja se escribe en `admin_actions` con quién, a quién, cuántos meses y cuándo |

Ocultar el ítem del menú **no es** una medida de seguridad: es cosmética.
Cualquiera puede escribir `/admin` en la barra de direcciones — y va a ver
«Panel no disponible», porque quien decide es Postgres.

**Verificalo vos mismo** (una vez, después de correr la migración): logueate con
una cuenta que NO sea la tuya, abrí la consola y pegá `await
supabase.rpc('admin_users')`. Tiene que responder `no autorizado`. Si devuelve
datos, no publiques hasta arreglarlo.

Ya estaba bien de antes y **no lo toques**: RLS activo en todas las tablas,
CSP y headers en `vercel.json`, `.env` en `.gitignore` (verificado: nunca se
commiteó), sin source maps en producción, `console.*` eliminado en el build,
tokens públicos con UUID v4 (122 bits — no se adivinan por fuerza bruta).

---

## 3. Cobros con Stripe — la parte que falta

**Fecha límite: 1 de noviembre de 2026.** Ese día `is_premium()` se cierra sola
y las funciones premium dejan de estar disponibles para las cuentas sin
suscripción. Si para entonces `PAYMENT_URL` sigue vacío, el usuario ve el
paywall pero **no tiene cómo pagarte**. Llegá con esto listo antes.

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

- [ ] **Confirm email: ON.** Sin esto se registran con emails ajenos o inventados
      — y desde la migración 10 además se cobran los 3 meses del programa de
      invitaciones con 3 direcciones falsas. Es la casilla más importante de
      esta lista.
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

Y la versión corta de la regla, que aplica a todo lo que se agregó después:
**si una acción vale dinero — dar premium, extender una prueba, contar un
referido — el navegador solo la pide; quien la decide es Postgres.** El
navegador es de quien lo abre: todo lo que se decida ahí se puede falsificar
con la consola abierta y dos líneas de JavaScript.

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


---

## 8. Revisión previa a producción (20/08/2026)

Repaso completo antes de publicar. Lo que ya estaba bien, comprobado
**contra el proyecto real con la anon key** (la misma que cualquiera lee
en el navegador):

- Las tablas no filtran nada sin login: `profiles`, `budgets`, `clients`,
  `budget_items`, `products`, `budget_templates`, `invoices` y `receipts`
  devuelven vacío; `admins`, `admin_actions`, `notifications` y `referrals`
  ni siquiera dan permiso.
- `admin_users()` sin ser admin responde `permission denied`.
- `get_public_budget()` con un token inventado devuelve `null`.
- `set_budget_response()` solo acepta `aceptado` / `rechazado` y congela la
  respuesta: con el link no se puede ir y venir entre sí y no.
- No hay ningún secreto en el repo, ni `dangerouslySetInnerHTML`, ni `eval`.
  `.env` no está versionado.

### 8.1 · El Storage se podía listar entero (arreglado en la 21)

Con la anon key, sin cuenta:

```js
await supabase.storage.from('logos').list('')
// → las carpetas, que son los user_id de todos tus usuarios
await supabase.storage.from('logos').list('<user_id>')
// → 'logo.png' → y con eso se arma la URL pública
```

Con los logos el daño es bajo (un logo es marca, y ya viaja en cada
presupuesto compartido). Pero el bucket `adjuntos` de la migración 20 guarda
**fotos de trabajos y de casas de clientes**, y se podrían haber recorrido
todas. La culpa era de la policy `lectura pública`, que da SELECT sobre el
bucket entero. No hace falta: un bucket público sirve el archivo por su URL
sin pasar por RLS; la policy solo habilitaba el listado por API.

La migración 21 la reemplaza por una de dueño. **Después de correrla, probá
en incógnito que el logo se siga viendo en un `/p/<token>` y en el PDF**; si
no se ve, adentro del archivo está el rollback.

### 8.2 · La URL de una imagen no se validaba (arreglado en la 21)

`budgets.images` lo escribe el dueño del presupuesto, y no solo desde el
formulario: con su token puede mandar cualquier texto por la API REST. Un
`javascript:...` guardado ahí terminaba dentro de un `<a href>` del enlace
público — en nuestro dominio y en el navegador del cliente que abre el link.

Ahora se valida en los dos lados: `isSafeImageUrl()` en el navegador
(`src/lib/utils.js`, se aplica en el PDF, la vista previa, el detalle y el
enlace público) y el check `budgets_images_check` en la base, que es el que
manda. Solo pasan URLs `https` del Storage de Supabase.

### 8.3 · Las imágenes borradas quedaban online (arreglado en el código)

Sacar una imagen del presupuesto la sacaba de la lista, pero el archivo
seguía en el Storage y a la vista de cualquiera con la URL. Ahora se borra
del bucket al guardar, y al eliminar un presupuesto se borran las suyas.
Por eso **«Duplicar» ya no se lleva las imágenes**: eran el mismo archivo, y
borrar una copia le hubiera hecho desaparecer la foto a la otra.

### 8.4 · Lo que queda anotado, sin arreglar

- **Una imagen adjunta es pública para quien tenga la URL**, aunque nunca
  compartas el presupuesto. Es el precio de que se vea en el PDF y en el
  link del cliente sin pedirle cuenta. Lo que la protege es que el nombre
  del archivo es un UUID al azar y que ya no se puede listar el bucket.
- **Mercado Pago**: el access token va como secret del servidor (una Edge
  Function de Supabase), nunca en `src/`. Todo lo que está en `src/` se
  compila y viaja al navegador. Y si algún día el checkout se abre dentro
  de la app, hay que sumar los dominios de MP al CSP de `vercel.json`,
  igual que dice la sección 3 para Stripe.
- **El enlace público no se indexa**: `/p/` va con `noindex` y en
  `robots.txt`. Es un pedido, no una cerradura: quien tenga el link entra.
