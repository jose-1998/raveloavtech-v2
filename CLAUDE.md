# raveloavtech-v2

Sitio web de **Ravelo AV Technologies LLC** — empresa de instalación audiovisual, redes y sistemas de seguridad en el área metropolitana de Nashville, TN.

## Stack

- **Frontend:** HTML/CSS/JS estático, sin framework. Desplegado en Netlify.
- **Backend:** Netlify Functions (Node.js, CommonJS). Bundler: esbuild.
- **Integraciones:** QuickBooks API (OAuth2), Resend (emails), Netlify Identity (auth del admin), Google Places (autocompletado de direcciones), Google Sheets (log de NDAs), Netlify Forms (almacenamiento de cotizaciones).

## Estructura

```
netlify/functions/       # Serverless functions (backend)
  _env-check.js          # Utilidad compartida: valida env vars al arrancar
  create-payment.js      # Crea factura de 50% depósito en QB → devuelve link de pago
  get-estimate.js        # Consulta presupuestos de QB y los normaliza
  send-quote.js          # Recibe formulario de cotización → emails vía Resend
  send-nda.js            # Envía NDA al cliente (requiere JWT de Netlify Identity)
  send-estimate.js       # Webhook de QB cuando se crea un presupuesto
  send-review.js         # Envía solicitud de reseña Google (protegido por JWT)
  get-tickets.js         # Lista cotizaciones desde Netlify Forms API
  log-nda.js             # Registra firmas de NDA en Google Sheets
  qb-auth.js             # Inicia flujo OAuth2 con QuickBooks
  qb-callback.js         # Recibe el código OAuth2 y guarda tokens en Netlify env vars
  __tests__/
    create-payment.test.js  # 10 tests para create-payment.js

quote-modal.js           # Modal del formulario de cotización (Google Places autocomplete)
cms-loader.js            # Carga imágenes de la galería desde images.json
admin/estimates.html     # Panel admin: lista presupuestos y permite enviar NDAs
dev/estimate.html        # Vista del presupuesto para el cliente (requiere NDA)
```

## QuickBooks — lo más importante

- Los tokens se auto-renuevan: si QB devuelve 401, `refreshAccessToken()` obtiene un nuevo token y lo guarda automáticamente en las env vars de Netlify vía su API.
- `QUICKBOOKS_ENV=production` activa el endpoint real; en cualquier otro valor usa sandbox.
- El flujo OAuth2 solo se corre una vez (o cuando el refresh token expira cada 100 días): `/.netlify/functions/qb-auth` → QB login → `/.netlify/functions/qb-callback`.

## Variables de entorno requeridas

| Variable | Usada en |
|---|---|
| `QUICKBOOKS_ACCESS_TOKEN` | `create-payment`, `get-estimate` |
| `QUICKBOOKS_REFRESH_TOKEN` | `create-payment`, `get-estimate` |
| `QUICKBOOKS_CLIENT_ID` | `create-payment`, `get-estimate`, `qb-auth`, `qb-callback` |
| `QUICKBOOKS_CLIENT_SECRET` | `create-payment`, `get-estimate`, `qb-auth`, `qb-callback` |
| `QUICKBOOKS_REALM_ID` | `create-payment`, `get-estimate` |
| `QUICKBOOKS_ENV` | `create-payment`, `get-estimate` (`production` o sandbox) |
| `RESEND_API_KEY` | `send-quote`, `send-nda`, `send-review`, `send-estimate` |
| `NETLIFY_TOKEN` | `create-payment`, `get-estimate`, `qb-callback` (auto-save tokens) |
| `SITE_ID` | igual que NETLIFY_TOKEN (Netlify lo inyecta automáticamente) |
| `URL` | `send-nda`, `qb-callback` (Netlify lo inyecta automáticamente) |

## Pruebas

```bash
npm test          # corre Jest
```

Las pruebas están en `netlify/functions/__tests__/`. Cubren `create-payment.js` (el archivo más crítico porque toca dinero): cálculo del depósito, refresh de token, casos de error, y validación de env vars.

## Flujo principal del negocio

1. Cliente llena formulario en el sitio → `send-quote.js` envía email al negocio y confirmación al cliente
2. El dueño crea el presupuesto en QuickBooks
3. Desde el panel admin (`/admin/estimates.html`) hace clic en "Send NDA" → `send-nda.js` envía email al cliente
4. Cliente recibe email, firma NDA, ve el presupuesto en `/dev/estimate.html`
5. Cliente hace clic en "Pay Deposit" → `create-payment.js` crea factura por 50% en QB y devuelve link de pago de QB Payments
6. Tras completar el proyecto, el dueño envía solicitud de reseña Google vía `send-review.js`
