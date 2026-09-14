# Poner a andar el webhook de Mercado Pago

Son cuatro pasos. Hasta que estén los cuatro, el premium se sigue
activando a mano desde `/admin`, así que nada se rompe si esto queda a
medias.

Antes de empezar: correr la **migración 36** en el SQL Editor de
Supabase. Sin la tabla `mp_eventos` la función no tiene dónde escribir.

## 1. Subir la función

Con la CLI de Supabase, parado en la raíz del proyecto:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy mp-webhook --no-verify-jwt
```

`--no-verify-jwt` es obligatorio: Mercado Pago no manda el token de
Supabase, manda su propia firma. Sin ese flag, Supabase rechaza el
aviso antes de que la función lo vea.

La URL queda así, y es la que va en el paso 3:

```
https://TU_PROJECT_REF.supabase.co/functions/v1/mp-webhook
```

## 2. Cargar los secretos

```bash
supabase secrets set MP_ACCESS_TOKEN=APP_USR-...
supabase secrets set MP_WEBHOOK_SECRET=...
```

- **MP_ACCESS_TOKEN**: panel de Mercado Pago → Tus integraciones → tu
  aplicación → Credenciales de producción.
- **MP_WEBHOOK_SECRET**: se genera en el paso 3, al configurar la
  notificación. Volvé acá cuando lo tengas.

Estos dos no van nunca en el repo ni en un chat. Con el access token se
cobra y se reembolsa a tu nombre. Si alguna vez quedó escrito en algún
archivo, revocalo y generá uno nuevo.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya vienen cargadas solas,
no hay que hacer nada con ellas.

## 3. Avisarle a Mercado Pago

Panel → **Tus integraciones** → tu aplicación → **Webhooks**.

- URL de producción: la del paso 1.
- Eventos a tildar, solo estos dos:
  - `subscription_preapproval` — alguien se suscribe, pausa o cancela.
  - `subscription_authorized_payment` — entra un cobro del mes.

Al guardar te da la **clave secreta**: ese es el `MP_WEBHOOK_SECRET`
del paso 2.

## 4. Probar que anda

El panel de Mercado Pago tiene un botón para mandar una notificación de
prueba. Mandala y mirá los registros:

```bash
supabase functions logs mp-webhook
```

Qué esperar:

- **`firma inválida`** → el `MP_WEBHOOK_SECRET` no es el que corresponde
  a esa URL. Se regenera en el mismo lugar del paso 3.
- **`faltan secrets`** → alguno de los dos no quedó cargado.
- **`OK`** → llegó, se validó y se escribió en `mp_eventos`.

Después, la prueba de verdad: suscribirte vos con otra cuenta y ver que
el usuario quede premium solo. En SQL:

```sql
select tipo, estado_mp, payer_email, user_id, resuelto, detalle, created_at
  from public.mp_eventos
 order by created_at desc
 limit 10;
```

## Lo que hay que mirar cada tanto

La fila con `resuelto = false` es un pago que entró y que **no se supo
de quién es**. Pasa cuando alguien paga con una cuenta de Mercado Pago a
nombre de otra persona y con otro mail.

```sql
select payer_email, detalle, created_at
  from public.mp_eventos
 where not resuelto
 order by created_at desc;
```

Esos se activan a mano desde `/admin`, como antes. No se pierden: por
eso se guardan.

## Lo que este webhook NO hace

**No da de baja a nadie.** Si alguien cancela, se le respeta el tiempo
que ya pagó y el premium se vence solo cuando llega la fecha. Cortarle
el servicio el día que cancela sería cobrarle el mes y dárselo por la
mitad.
