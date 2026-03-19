# Stripe CRM - Contexto del Producto

> Este documento sirve como referencia para LLMs y desarrolladores que trabajen en el proyecto.

## Visión General

Stripe CRM es una plataforma multi-tenant diseñada para gestionar el ciclo de vida completo de clientes que utilizan Stripe como procesador de pagos. El sistema permite a las organizaciones conectar sus cuentas de Stripe y automatizar la gestión de ventas, soporte, retención y comunicaciones.

## Problema que Resuelve

Las empresas que usan Stripe necesitan:
- Visibilidad unificada de sus clientes y suscripciones
- Automatización de procesos de onboarding y activación
- Gestión proactiva de cancelaciones y disputas
- Soporte al cliente con contexto de pagos
- Comunicaciones automatizadas basadas en eventos

## Arquitectura Técnica

### Stack Tecnológico
- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Pagos**: Stripe API + OAuth Connect
- **Emails**: Resend + React Email
- **Estado**: React Query / Zustand (preparado)

### Estructura de Carpetas
```
src/
├── app/
│   ├── (auth)/           # Páginas de login/registro
│   ├── (dashboard)/      # Páginas del dashboard principal
│   │   ├── ventas/       # Dashboard de ventas y suscripciones
│   │   ├── activacion/   # Gestión de activación de clientes
│   │   ├── soporte/      # Wiki, bot, estadísticas
│   │   ├── desuscripcion/# Reglas, refunds, disputas
│   │   ├── mails/        # Inbox, templates, configuración
│   │   └── settings/     # Configuración de la organización
│   ├── api/              # API Routes
│   │   ├── webhooks/stripe/  # Receptor de webhooks de Stripe
│   │   ├── stripe/       # OAuth connect/callback/disconnect
│   │   ├── emails/       # Envío de emails
│   │   ├── bot/          # API del chatbot
│   │   └── wiki/         # API de artículos wiki
│   └── embed/[orgId]/    # Widget embebible del bot
├── components/
│   ├── ui/               # Componentes shadcn/ui
│   ├── dashboard/        # Sidebar, header, etc.
│   └── ...
├── lib/
│   ├── supabase/         # Cliente Supabase (client, server, middleware)
│   ├── stripe/           # Cliente Stripe y helpers
│   └── resend/           # Cliente de emails
├── emails/               # Templates de React Email
└── types/                # Tipos TypeScript compartidos
```

## Modelo de Datos

### Entidades Principales

#### Organizations (Tenants)
- Cada organización es un tenant aislado
- Tiene un `slug` único para URLs
- Conecta una o más cuentas de Stripe

#### Users
- Pertenecen a una organización
- Roles: `owner`, `admin`, `member`
- Autenticados via Supabase Auth

#### Stripe Connections
- Almacena tokens OAuth de cuentas Stripe conectadas
- Permite operar en nombre de la cuenta conectada
- Soporta modo live y test

#### Customers
- Sincronizados desde Stripe via webhooks
- Contienen metadata de activación y estado
- Vinculados a suscripciones

#### Subscriptions
- Estado actual de suscripciones Stripe
- Tracking de períodos y cancelaciones
- Base para automatizaciones

### Entidades de Soporte

#### Wiki Articles
- Base de conocimiento por organización
- Usados por el bot para respuestas
- Categorías y búsqueda por embeddings (preparado)

#### Bot Configs
- Configuración de chatbots por organización
- Árbol de decisión con nodos y acciones
- Personalización de apariencia

#### Support Tickets
- Generados desde el bot o manualmente
- Estados: open, in_progress, resolved, closed
- Prioridades y asignaciones

### Entidades de Automatización

#### Automation Rules
- Triggers basados en eventos Stripe
- Condiciones configurables
- Acciones: enviar email, crear ticket, webhook, etc.

#### Unsubscription Rules
- Configuración de flujo de cancelación
- Ofertas de retención (descuentos, pausas)
- Reglas de refund automático

#### Dispute Evidence Endpoints
- URLs configuradas para obtener evidencia
- Tipos: comunicación, política, entrega, etc.
- Autenticación configurable

## Flujos Principales

### 1. Conexión de Stripe
```
Usuario → Settings → Conectar Stripe → OAuth → Callback → Sync inicial
```

### 2. Procesamiento de Webhooks
```
Stripe Event → Webhook Endpoint → Validación → Log → Handler específico → Automatizaciones
```

### 3. Gestión de Cancelaciones
```
Webhook cancel → Evaluar reglas → Ofrecer retención → Procesar o retener
```

### 4. Chat Bot
```
Usuario final → Widget embebido → Árbol de decisión → Acciones Stripe / Tickets
```

### 5. Disputas
```
Webhook dispute → Recopilar evidencia (endpoints) → Preparar respuesta → Notificar
```

## Webhooks de Stripe Manejados

| Evento | Acción |
|--------|--------|
| `customer.created/updated` | Sync cliente |
| `customer.subscription.created/updated` | Sync suscripción + automatización |
| `customer.subscription.deleted` | Marcar cancelada + automatización |
| `invoice.paid` | Registrar pago + automatización |
| `invoice.payment_failed` | Notificar + automatización |
| `charge.dispute.created/updated/closed` | Gestión de disputas |
| `radar.early_fraud_warning.created` | Alerta de fraude |
| `checkout.session.completed` | Nueva venta + automatización |

## Sistema de Emails

### Templates Disponibles
- `NewSaleEmail`: Notificación de nueva venta
- `ActivationReminderEmail`: Recordatorio de activación
- `UnsubscribeConfirmationEmail`: Confirmación de baja

### Configuración
- Dominio de envío configurable
- Colores y logo personalizables
- Clasificación AI de emails entrantes (preparado)

## Widget Embebible

### Características
- Iframe embebible en cualquier sitio
- Personalizable por organización
- Acciones directas sobre Stripe:
  - Cancelar suscripción
  - Pausar suscripción
  - Solicitar refund
- Creación de tickets de soporte
- Integración con wiki para respuestas

### Integración
```html
<iframe src="https://app.example.com/embed/{orgId}?botId={botId}" />
```

## Seguridad

### Row Level Security (RLS)
- Todas las tablas tienen RLS habilitado
- Políticas basadas en `org_id` del usuario
- Función helper `get_user_org_id()` para validación

### Autenticación
- Supabase Auth con email/password
- Middleware protege rutas del dashboard
- API routes validan sesión

### Stripe
- Tokens OAuth almacenados encriptados
- Webhooks verificados con signing secret
- Acciones ejecutadas con token de cuenta conectada

## Variables de Entorno Requeridas

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CLIENT_ID=              # Para OAuth Connect

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=

# Opcional
OPENAI_API_KEY=                # Para clasificación de emails y bot AI
```

## Extensibilidad

### Preparado para:
- **Vector Search**: Campo `embedding` en wiki_articles para búsqueda semántica
- **AI Classification**: Campos en email_configs para clasificación automática
- **NPS Tracking**: Tabla nps_responses para seguimiento de satisfacción
- **Multi-bot**: Soporte para múltiples bots por organización

### Puntos de Extensión
- Nuevos tipos de automatización en `automation_rules`
- Nuevos tipos de evidencia en `dispute_evidence_endpoints`
- Nuevos templates de email en `/src/emails/`
- Nuevos nodos de bot en la configuración

## Convenciones de Código

- **Componentes**: PascalCase, archivos en kebab-case
- **API Routes**: REST-like, respuestas JSON consistentes
- **Base de datos**: snake_case para columnas
- **TypeScript**: Tipos estrictos, interfaces en `/src/types/`
- **Idioma UI**: Español (según configuración del usuario)

## Comandos de Desarrollo

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run lint     # Verificar linting
npm run start    # Ejecutar build de producción
```

## Migraciones de Base de Datos

Las migraciones están en `supabase/migrations/`:
- `001_initial_schema.sql`: Esquema completo de tablas
- `002_rls_policies.sql`: Políticas de seguridad RLS

Ejecutar en orden en el dashboard de Supabase o con Supabase CLI.
