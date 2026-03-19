# Stripe CRM

CRM multi-tenant enfocado en la gestión de cuentas de Stripe, diseñado para automatizar el ciclo de vida del cliente.

## Stack Tecnológico -

- **Framework**: Next.js 14 (App Router)
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Emails**: Resend + React Email
- **UI**: Tailwind CSS + shadcn/ui
- **Stripe**: stripe-node + webhooks

## Funcionalidades

### 1. Nuevas Ventas / Suscripciones
- Sincronización automática de clientes y suscripciones desde Stripe
- Emails automáticos de bienvenida con opciones de desuscripción
- Dashboard de ventas con métricas en tiempo real

### 2. Activación
- Endpoint configurable para verificar activación de clientes
- Emails automáticos de push para activación
- Dashboard con tasa de activación

### 3. Soporte
- **Wiki**: Base de conocimiento con editor markdown
- **Bot Builder**: Constructor visual de bots con árbol de decisión
- **Widget Embebible**: Script para incorporar el bot en sitios externos
- **Estadísticas**: Métricas de flujos más usados y NPS

### 4. Desuscripción
- Reglas configurables (cancelación inmediata vs. ofrecer beneficio)
- Gestión de refunds con reglas automáticas
- Manejo de disputas con endpoints de evidencia
- Configuración para Early Fraud Warnings (EFW)

### 5. Gestión de Mails
- Inbox unificado para gestionar emails entrantes
- Clasificación automática con IA
- Templates personalizables con React Email
- Respuestas automáticas basadas en intención

## Configuración

### 1. Variables de Entorno

Copia `.env.example` a `.env.local` y completa las variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CLIENT_ID=  # Para OAuth

# Resend
RESEND_API_KEY=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OpenAI (opcional, para clasificación de mails)
OPENAI_API_KEY=
```

### 2. Base de Datos

Ejecuta las migraciones en Supabase:

1. Ve a tu proyecto en Supabase
2. Abre el SQL Editor
3. Ejecuta los archivos en `supabase/migrations/` en orden

### 3. Stripe Webhooks

Configura el webhook en Stripe Dashboard:

1. Ve a Developers → Webhooks
2. Agrega un endpoint: `https://tu-dominio.com/api/webhooks/stripe`
3. Selecciona los eventos:
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
   - `radar.early_fraud_warning.created`
   - `checkout.session.completed`

## Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## Estructura del Proyecto

```
src/
├── app/
│   ├── (auth)/           # Páginas de login/register
│   ├── (dashboard)/      # Dashboard principal
│   │   ├── ventas/       # Nuevas ventas
│   │   ├── activacion/   # Activación de usuarios
│   │   ├── soporte/      # Wiki, bot, estadísticas
│   │   ├── desuscripcion/# Reglas, refunds, disputas
│   │   ├── mails/        # Inbox, templates, config
│   │   └── settings/     # Configuración
│   ├── api/              # API routes
│   └── embed/            # Widget embebible
├── components/
│   ├── ui/               # shadcn/ui components
│   └── dashboard/        # Componentes del dashboard
├── lib/
│   ├── supabase/         # Cliente de Supabase
│   ├── stripe/           # Cliente de Stripe
│   └── resend/           # Cliente de Resend
├── emails/               # Templates de React Email
└── types/                # TypeScript types
```

## Bot Embebible

Para incorporar el bot en un sitio externo:

```html
<script 
  src="https://tu-dominio.com/embed/{orgId}/bot.js" 
  data-bot-id="{botId}">
</script>
```

## Licencia

Proyecto privado. Todos los derechos reservados.
