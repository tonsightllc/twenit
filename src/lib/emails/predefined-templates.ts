import type { EmailBlock } from "@/emails/components/types";

export interface PredefinedTemplate {
  slug: string;
  name: string;
  description: string;
  template_type: string;
  subject: string;
  emoji: string;
  blocks: EmailBlock[];
}

export const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  {
    slug: "welcome",
    name: "Bienvenida",
    description: "Saludá a tu nuevo cliente cuando se registra o compra por primera vez",
    template_type: "welcome",
    subject: "¡Bienvenido/a a {{companyName}}!",
    emoji: "👋",
    blocks: [
      { id: "w1", type: "heading", content: "¡Bienvenido/a!", attrs: { level: 1 } },
      { id: "w2", type: "paragraph", content: "Hola <strong>{{customerName}}</strong>," },
      { id: "w3", type: "paragraph", content: "Estamos muy contentos de tenerte con nosotros. Tu cuenta ya está activa y lista para usar." },
      { id: "w4", type: "callout", content: "Si necesitás ayuda para empezar, no dudes en contactarnos. Estamos acá para ayudarte.", attrs: { variant: "info" } },
      { id: "w5", type: "button", attrs: { label: "Comenzar ahora", href: "https://tuempresa.com" } },
      { id: "w6", type: "paragraph", content: "¡Gracias por elegirnos!" },
    ],
  },
  {
    slug: "new_sale",
    name: "Confirmación de compra",
    description: "Confirmación automática cuando un cliente realiza una compra",
    template_type: "new_sale",
    subject: "Confirmación de tu compra - {{productName}}",
    emoji: "🛒",
    blocks: [
      { id: "s1", type: "heading", content: "¡Gracias por tu compra!", attrs: { level: 1 } },
      { id: "s2", type: "paragraph", content: "Hola <strong>{{customerName}}</strong>," },
      { id: "s3", type: "paragraph", content: "Tu compra de <strong>{{productName}}</strong> ha sido procesada correctamente." },
      { id: "s4", type: "callout", content: "Monto: <strong>{{amount}}</strong>", attrs: { variant: "success" } },
      { id: "s5", type: "paragraph", content: "Si tenés alguna pregunta sobre tu compra, no dudes en contactarnos." },
      { id: "s6", type: "button", attrs: { label: "Ver mi compra", href: "https://tuempresa.com" } },
    ],
  },
  {
    slug: "new_subscription",
    name: "Nueva suscripción",
    description: "Notificación cuando un cliente se suscribe a un plan",
    template_type: "new_subscription",
    subject: "Tu suscripción a {{productName}} está activa",
    emoji: "🔄",
    blocks: [
      { id: "sub1", type: "heading", content: "¡Tu suscripción está activa!", attrs: { level: 1 } },
      { id: "sub2", type: "paragraph", content: "Hola <strong>{{customerName}}</strong>," },
      { id: "sub3", type: "paragraph", content: "Te confirmamos que tu suscripción a <strong>{{productName}}</strong> por <strong>{{amount}}</strong> está activa." },
      { id: "sub4", type: "callout", content: "Tu próximo cobro se realizará automáticamente. Podés cancelar en cualquier momento.", attrs: { variant: "info" } },
      { id: "sub5", type: "button", attrs: { label: "Administrar suscripción", href: "https://tuempresa.com" } },
      { id: "sub6", type: "paragraph", content: "Gracias por confiar en nosotros." },
    ],
  },
  {
    slug: "cancellation",
    name: "Cancelación de suscripción",
    description: "Confirmación cuando un cliente cancela su suscripción",
    template_type: "cancellation",
    subject: "Tu suscripción ha sido cancelada",
    emoji: "😔",
    blocks: [
      { id: "c1", type: "heading", content: "Tu suscripción ha sido cancelada", attrs: { level: 1 } },
      { id: "c2", type: "paragraph", content: "Hola <strong>{{customerName}}</strong>," },
      { id: "c3", type: "paragraph", content: "Te escribimos para confirmar que tu suscripción ha sido cancelada exitosamente." },
      { id: "c4", type: "callout", content: "<strong>No se te realizarán más cobros.</strong> Tu acceso seguirá activo hasta el fin del período actual.", attrs: { variant: "warning" } },
      { id: "c5", type: "paragraph", content: "Lamentamos verte partir. Si tenés algún comentario sobre tu experiencia, nos encantaría escucharte." },
      { id: "c6", type: "button", attrs: { label: "Reactivar suscripción", href: "https://tuempresa.com" } },
      { id: "c7", type: "paragraph", content: "Gracias por haber sido parte." },
    ],
  },
  {
    slug: "refund",
    name: "Confirmación de reembolso",
    description: "Notificación cuando se procesa un reembolso",
    template_type: "refund_confirmation",
    subject: "Tu reembolso ha sido procesado",
    emoji: "💰",
    blocks: [
      { id: "r1", type: "heading", content: "Reembolso procesado", attrs: { level: 1 } },
      { id: "r2", type: "paragraph", content: "Hola <strong>{{customerName}}</strong>," },
      { id: "r3", type: "paragraph", content: "Te informamos que tu reembolso por <strong>{{amount}}</strong> ha sido procesado correctamente." },
      { id: "r4", type: "callout", content: "El monto debería reflejarse en tu cuenta dentro de 5-10 días hábiles, dependiendo de tu banco.", attrs: { variant: "info" } },
      { id: "r5", type: "paragraph", content: "Si tenés alguna pregunta, no dudes en contactarnos." },
    ],
  },
  {
    slug: "activation_reminder",
    name: "Recordatorio de activación",
    description: "Recordá a clientes que aún no activaron su cuenta",
    template_type: "activation_reminder",
    subject: "¡No te olvides de activar tu cuenta!",
    emoji: "⏰",
    blocks: [
      { id: "a1", type: "heading", content: "¡Tu cuenta te espera!", attrs: { level: 1 } },
      { id: "a2", type: "paragraph", content: "Hola <strong>{{customerName}}</strong>," },
      { id: "a3", type: "paragraph", content: "Notamos que aún no activaste tu cuenta. Te estás perdiendo de todo lo que tenemos para ofrecerte." },
      { id: "a4", type: "button", attrs: { label: "Activar mi cuenta", href: "https://tuempresa.com" } },
      { id: "a5", type: "paragraph", content: "Si necesitás ayuda, estamos acá para vos." },
    ],
  },
  {
    slug: "feedback",
    name: "Pedido de feedback",
    description: "Pedí feedback o una reseña a tus clientes",
    template_type: "custom",
    subject: "¿Cómo fue tu experiencia?",
    emoji: "⭐",
    blocks: [
      { id: "f1", type: "heading", content: "¿Cómo fue tu experiencia?", attrs: { level: 1 } },
      { id: "f2", type: "paragraph", content: "Hola <strong>{{customerName}}</strong>," },
      { id: "f3", type: "paragraph", content: "Tu opinión es muy importante para nosotros. Nos encantaría saber cómo fue tu experiencia con <strong>{{productName}}</strong>." },
      { id: "f4", type: "paragraph", content: "Solo te tomará un minuto y nos ayuda mucho a mejorar." },
      { id: "f5", type: "button", attrs: { label: "Dejar mi opinión", href: "https://tuempresa.com" } },
      { id: "f6", type: "paragraph", content: "¡Gracias por tu tiempo!" },
    ],
  },
  {
    slug: "promotion",
    name: "Promoción / Oferta",
    description: "Enviá ofertas especiales o descuentos a tus clientes",
    template_type: "custom",
    subject: "¡Tenemos una oferta especial para vos!",
    emoji: "🎁",
    blocks: [
      { id: "p1", type: "heading", content: "¡Oferta especial!", attrs: { level: 1 } },
      { id: "p2", type: "paragraph", content: "Hola <strong>{{customerName}}</strong>," },
      { id: "p3", type: "paragraph", content: "Queremos agradecerte por ser parte de nuestra comunidad con una oferta exclusiva." },
      { id: "p4", type: "callout", content: "🎉 <strong>Obtené un descuento especial</strong> en tu próxima compra. Esta oferta es por tiempo limitado.", attrs: { variant: "success" } },
      { id: "p5", type: "button", attrs: { label: "Aprovechar oferta", href: "https://tuempresa.com" } },
      { id: "p6", type: "paragraph", content: "¡No te lo pierdas!" },
    ],
  },
  {
    slug: "blank",
    name: "En blanco",
    description: "Empezá desde cero con un template vacío",
    template_type: "custom",
    subject: "",
    emoji: "📄",
    blocks: [],
  },
];
