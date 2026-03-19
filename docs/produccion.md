# Guía de Despliegue en Producción

## Requisitos previos

- Cuenta de [Supabase](https://supabase.com) (proyecto creado)
- Cuenta de [Stripe](https://stripe.com) con Connect habilitado
- Cuenta de [Resend](https://resend.com) con dominio verificado
- Cuenta de [Vercel](https://vercel.com) (u otra plataforma compatible con Next.js)
- (Opcional) Cuenta de [OpenAI](https://platform.openai.com) para clasificación de emails

---

## 1. Base de datos (Supabase)

### 1.1 Crear el proyecto

1. Crear un nuevo proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Anotar la **URL** y las claves **anon** y **service_role** desde Settings → API

### 1.2 Ejecutar migraciones

Las migraciones están en `supabase/migrations/` y deben ejecutarse en orden:

| Orden | Archivo | Descripción |
|-------|---------|-------------|
| 1 | `001_initial_schema.sql` | Esquema base: organizaciones, usuarios, clientes, suscripciones, etc. |
| 2 | `002_rls_policies.sql` | Políticas de Row Level Security en todas las tablas |
| 3 | `003_fix_rls_recursion.sql` | Fix de recursión en políticas de `users` |
| 4 | `004_inbound_emails.sql` | Tabla `inbound_emails` y RLS |
| 5 | `005_fix_rls_bot_recursion.sql` | Ajustes para flujo del Bot Builder |

Ejecutarlas desde el SQL Editor de Supabase o con la CLI:

```bash
supabase db push
```

### 1.3 Extensions requeridas

Las migraciones las crean automáticamente, pero verificar que estén habilitadas:

- `uuid-ossp` — Generación de UUIDs
- `vector` — Embeddings para artículos de wiki

### 1.4 Configurar autenticación

1. En Supabase Dashboard → Authentication → Providers:
   - Habilitar **Email** (login con email/password)
   - (Opcional) Habilitar **Google** con credenciales de [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. En Authentication → URL Configuration:
   - **Site URL**: `https://tu-dominio.com`
   - **Redirect URLs**: agregar `https://tu-dominio.com/api/auth/callback`

### 1.5 Seeds opcionales

Después de crear la primera organización, ejecutar:

```sql
SELECT seed_default_automation_rules('UUID_DE_LA_ORG');
```

Esto crea reglas de automatización por defecto.

---

## 2. Stripe

### 2.1 API Keys

1. En Stripe Dashboard → Developers → API Keys
2. Usar las keys de **producción** (no test):
   - **Secret key** (`STRIPE_SECRET_KEY`): `sk_live_xxx`
   - **Publishable key** (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`): `pk_live_xxx`

### 2.2 Configuración de Connect (OAuth)

La app usa Stripe Connect OAuth para que cada organización conecte su propia cuenta de Stripe.

#### Paso a paso

1. Ir a **Settings → Connect → Onboarding options → OAuth** en Stripe Dashboard
   - URL directa: `https://dashboard.stripe.com/settings/connect/onboarding-options/oauth`
   - En modo test: `https://dashboard.stripe.com/test/settings/connect/onboarding-options/oauth`
2. **Habilitar OAuth** — Click en el botón "Habilitar OAuth". Sin esto, los redirect URIs y el flujo completo no funcionan.
3. Anotar el **Client ID** (`ca_xxx`) que aparece en esa página → es el valor para `STRIPE_CLIENT_ID`
4. Configurar los **Redirect URIs** (sección "Redireccionamientos"):
   - Agregar: `https://tu-dominio.com/api/stripe/callback`
   - Si tenés un entorno de QA/staging, agregarlo también (ej: `https://qa.tu-dominio.com/api/stripe/callback`)
   - **Nota**: OAuth debe estar habilitado primero para que el formulario de URIs funcione correctamente

#### Notas importantes

- Los redirect URIs deben ser exactos: sin trailing slash, sin espacios
- `localhost` no se puede agregar como redirect URI en la UI, pero en modo test Stripe lo permite si el `redirect_uri` del request OAuth coincide exactamente
- Para desarrollo local se recomienda usar la Stripe CLI (ver sección 2.4)
- En la sección de branding (opcional), podés configurar el nombre y logo de tu plataforma — es lo que ven los usuarios cuando autorizan la conexión

### 2.3 Webhooks

1. En Stripe Dashboard → Developers → Webhooks
2. Crear un endpoint:
   - **URL**: `https://tu-dominio.com/api/webhooks/stripe`
   - **Eventos a escuchar**:
     - `customer.created`
     - `customer.updated`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `charge.dispute.created`
     - `charge.dispute.updated`
     - `charge.dispute.closed`
     - `charge.refunded`
     - `radar.early_fraud_warning.created`
     - `checkout.session.completed`
   - **Importante**: Habilitar "Listen to events on Connected accounts" para recibir eventos de las cuentas conectadas
3. Una vez creado el endpoint, click en **"Reveal"** en la sección "Signing secret" → ese es el valor para `STRIPE_WEBHOOK_SECRET` (`whsec_xxx`)

### 2.4 Desarrollo local con Stripe CLI

Para recibir webhooks en localhost sin exponer un endpoint público:

```bash
# Instalar
brew install stripe/stripe-cli/stripe

# Autenticarse
stripe login

# Escuchar y reenviar webhooks (incluye eventos de cuentas conectadas)
stripe listen --forward-to localhost:3000/api/webhooks/stripe --connect-account
```

El comando `stripe listen` imprime un `whsec_xxx` temporal que debés poner en `STRIPE_WEBHOOK_SECRET` en tu `.env.local`.

Para probar el flujo OAuth de Connect en modo test, Stripe muestra una pantalla donde podés hacer click en **"Skip this form"** para simular la conexión sin una cuenta real.

---

## 3. Resend

### 3.1 Configuración de envío

1. En [Resend Dashboard](https://resend.com) → Domains
2. Verificar tu dominio de envío
3. Anotar la **API Key** (`re_xxx`)
4. Actualizar la dirección de envío en `src/lib/resend/index.ts` si es necesario (por defecto: `Twenit <noreply@yourdomain.com>`)

### 3.2 Webhooks de inbound email

1. En Resend → Inbound Emails
2. Configurar el webhook: `https://tu-dominio.com/api/webhooks/resend`

---

## 4. Clave de encriptación

Los tokens de Stripe Connect se almacenan encriptados en la base de datos con AES-256-GCM.

### Generar la clave

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Esto genera una clave de 64 caracteres hexadecimales (256 bits).

### Consideraciones críticas

- **No reutilizar** la clave de desarrollo. Generar una nueva para producción.
- **No perderla**. Si se pierde la clave, todos los tokens encriptados en la base de datos serán irrecuperables y cada organización tendrá que reconectar su cuenta de Stripe.
- **Rotación**: si se necesita rotar la clave, primero hay que desencriptar todos los tokens con la clave vieja y re-encriptarlos con la nueva (no hay script de migración aún).
- Guardarla únicamente en las variables de entorno del hosting (nunca en el código ni en la DB).

---

## 5. Variables de entorno

Configurar todas estas variables en el dashboard de Vercel (o la plataforma elegida):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_CLIENT_ID=ca_xxx

# Encriptación
ENCRYPTION_KEY=<64 caracteres hex generados con el comando anterior>

# Resend
RESEND_API_KEY=re_xxx

# App URL (sin trailing slash)
NEXT_PUBLIC_APP_URL=https://tu-dominio.com

# OpenAI (opcional)
OPENAI_API_KEY=sk-xxx
```

### Variables sensibles (nunca exponer al frontend)

| Variable | Riesgo si se filtra |
|----------|---------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso total a la DB sin RLS |
| `STRIPE_SECRET_KEY` | Control total de tu cuenta de Stripe |
| `ENCRYPTION_KEY` | Permite descifrar todos los tokens de clientes |
| `RESEND_API_KEY` | Enviar emails desde tu dominio |
| `OPENAI_API_KEY` | Consumo de créditos en tu cuenta |

Las variables con prefijo `NEXT_PUBLIC_` son visibles en el frontend por diseño — nunca poner secrets ahí.

---

## 6. Despliegue en Vercel

### 6.1 Setup inicial

1. Conectar el repositorio en [Vercel Dashboard](https://vercel.com/dashboard)
2. Framework preset: **Next.js** (se detecta automáticamente)
3. Configurar todas las variables de entorno del paso anterior
4. Deploy

### 6.2 Verificar después del deploy

- [ ] La app carga correctamente en `https://tu-dominio.com`
- [ ] El login/registro funciona
- [ ] Se puede conectar una cuenta de Stripe vía Connect
- [ ] Los webhooks de Stripe llegan (verificar en Stripe Dashboard → Webhooks → Logs)
- [ ] El envío de emails funciona (verificar en Resend → Logs)
- [ ] El widget embebible carga en dominios externos

---

## 7. Seguridad — Checklist

- [ ] `ENCRYPTION_KEY` de producción es diferente a la de desarrollo
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está solo en variables de entorno del servidor
- [ ] RLS está habilitado en todas las tablas de Supabase
- [ ] El webhook de Stripe valida la firma (`STRIPE_WEBHOOK_SECRET`)
- [ ] No hay tokens de Stripe en texto plano en la DB (nuevas conexiones se encriptan automáticamente)
- [ ] La página de settings no expone `access_token` ni `refresh_token` al frontend
- [ ] `.env.local` está en `.gitignore`

---

## 8. Monitoreo post-deploy

### Stripe

- Dashboard → Developers → Logs: verificar que las llamadas API no tengan errores
- Dashboard → Developers → Webhooks: verificar entregas exitosas

### Supabase

- Dashboard → Logs: revisar errores de RLS o queries fallidas
- Dashboard → Auth: monitorear registros y logins

### Vercel

- Dashboard → Deployments → Functions: revisar errores en las API routes
- Configurar alertas de errores si es posible

---

## 9. URLs de callback a configurar

| Servicio | URL | Dónde se configura |
|----------|-----|--------------------|
| Supabase Auth | `https://tu-dominio.com/api/auth/callback` | Supabase Dashboard → Auth → URL Configuration |
| Stripe Connect OAuth | `https://tu-dominio.com/api/stripe/callback` | Stripe Dashboard → Settings → Connect → Onboarding options → OAuth → Redireccionamientos |
| Stripe Webhooks | `https://tu-dominio.com/api/webhooks/stripe` | Stripe Dashboard → Developers → Webhooks |
| Resend Inbound | `https://tu-dominio.com/api/webhooks/resend` | Resend Dashboard → Inbound Emails |

---

## 10. Arquitectura de referencia

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Next.js API │────▶│   Supabase   │
│  (Vercel)    │     │   Routes     │     │  (Postgres)  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                   ┌────────┼────────┐
                   ▼        ▼        ▼
              ┌────────┐ ┌──────┐ ┌────────┐
              │ Stripe │ │Resend│ │ OpenAI │
              │Connect │ │      │ │  (opt) │
              └────────┘ └──────┘ └────────┘
```

### Flujo de datos principal

1. Usuario se registra → Supabase Auth → se crea org + user en DB
2. Conecta Stripe → OAuth Connect → tokens encriptados en DB
3. Webhooks de Stripe → procesan eventos → actualizan clientes/suscripciones
4. Automatizaciones se disparan desde webhooks → envían emails, crean tickets, etc.
5. Bot embebible → iframe en sitio del cliente → interactúa con la API
