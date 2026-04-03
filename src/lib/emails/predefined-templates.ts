import type { EmailBlock } from "@/emails/components/types";

export interface PredefinedTemplate {
  slug: string;
  name: string;
  description: string;
  template_type: string;
  subject: string;
  emoji: string;
  blocks: EmailBlock[];
  custom_html?: string;
}

export const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  {
    slug: "welcome",
    name: "Bienvenida",
    description: "Saludá a tu nuevo cliente cuando se registra o compra por primera vez",
    template_type: "welcome",
    subject: "¡Bienvenido/a a {{companyName}}!",
    emoji: "👋",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <h1 style="color: #111; font-size: 24px; margin-bottom: 20px;">¡Bienvenido/a!</h1>
  <p style="margin-bottom: 16px;">Hola <strong>{{customerName}}</strong>,</p>
  <p style="margin-bottom: 16px;">Estamos muy contentos de tenerte con nosotros. Tu cuenta ya está activa y lista para usar.</p>
  <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 24px 0; border-radius: 4px;">
    <p style="margin: 0; color: #166534;">Si necesitás ayuda para empezar, no dudes en contactarnos. ¡Estamos acá para ayudarte!</p>
  </div>
  <div style="margin: 32px 0;">
    <a href="https://tuempresa.com" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Comenzar ahora</a>
  </div>
  <p style="margin-bottom: 16px;">{{customMessage}}</p>
  <p style="margin-top: 32px; color: #666;">¡Gracias por elegirnos!</p>
</div>
    `,
  },
  {
    slug: "new_sale",
    name: "Confirmación de compra",
    description: "Confirmación automática cuando un cliente realiza una compra",
    template_type: "new_sale",
    subject: "Confirmación de tu compra - {{productName}}",
    emoji: "🛒",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <h1 style="color: #111; font-size: 24px; margin-bottom: 20px;">¡Gracias por tu compra!</h1>
  <p style="margin-bottom: 16px;">Hola <strong>{{customerName}}</strong>,</p>
  <p style="margin-bottom: 16px;">Tu compra de <strong>{{productName}}</strong> ha sido procesada correctamente.</p>
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 24px 0; border-radius: 8px;">
    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Total pagado</p>
    <p style="margin: 0; font-size: 24px; font-weight: 600; color: #0f172a;">{{amount}}</p>
  </div>
  <p style="margin-bottom: 16px;">{{customMessage}}</p>
  <p style="margin-bottom: 16px;">Si tenés alguna pregunta sobre tu compra, no dudes en responder a este correo para contactarnos.</p>
  <div style="margin: 32px 0;">
    <a href="https://tuempresa.com" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Ver mi compra</a>
  </div>
</div>
    `,
  },
  {
    slug: "new_subscription",
    name: "Nueva suscripción",
    description: "Notificación cuando un cliente se suscribe a un plan",
    template_type: "new_subscription",
    subject: "Tu suscripción a {{productName}} está activa",
    emoji: "🔄",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <h1 style="color: #111; font-size: 24px; margin-bottom: 20px;">¡Tu suscripción está activa!</h1>
  <p style="margin-bottom: 16px;">Hola <strong>{{customerName}}</strong>,</p>
  <p style="margin-bottom: 16px;">Te confirmamos que tu suscripción a <strong>{{productName}}</strong> por <strong>{{amount}}</strong> está activa y lista para usar.</p>
  <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
    <p style="margin: 0; color: #1e40af;">Tu próximo cobro se realizará automáticamente. Podés cancelar en cualquier momento desde tu panel de control.</p>
  </div>
  <p style="margin-bottom: 16px;">{{customMessage}}</p>
  <div style="margin: 32px 0;">
    <a href="https://tuempresa.com" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Administrar suscripción</a>
  </div>
  <p style="margin-top: 32px; color: #666;">Gracias por confiar en nosotros.</p>
</div>
    `,
  },
  {
    slug: "cancellation",
    name: "Cancelación de suscripción",
    description: "Confirmación cuando un cliente cancela su suscripción",
    template_type: "cancellation",
    subject: "Tu suscripción ha sido cancelada",
    emoji: "😔",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <h1 style="color: #111; font-size: 24px; margin-bottom: 20px;">Tu suscripción ha sido cancelada</h1>
  <p style="margin-bottom: 16px;">Hola <strong>{{customerName}}</strong>,</p>
  <p style="margin-bottom: 16px;">Te escribimos para confirmar que tu suscripción ha sido cancelada exitosamente.</p>
  <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
    <p style="margin: 0; color: #b45309;"><strong>No se te realizarán más cobros.</strong> Tu acceso seguirá activo hasta el fin del período actual ya abonado.</p>
  </div>
  <p style="margin-bottom: 16px;">{{customMessage}}</p>
  <p style="margin-bottom: 16px;">Lamentamos verte partir. Si tenés algún comentario sobre tu experiencia, nos encantaría escucharte, simplemente responde a este mail.</p>
  <div style="margin: 32px 0;">
    <a href="https://tuempresa.com" style="background-color: #f1f5f9; color: #0f172a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Reactivar suscripción</a>
  </div>
  <p style="margin-top: 32px; color: #666;">Gracias por haber sido parte.</p>
</div>
    `,
  },
  {
    slug: "refund",
    name: "Confirmación de reembolso",
    description: "Notificación cuando se procesa un reembolso",
    template_type: "refund_confirmation",
    subject: "Tu reembolso ha sido procesado",
    emoji: "💰",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <h1 style="color: #111; font-size: 24px; margin-bottom: 20px;">Reembolso procesado</h1>
  <p style="margin-bottom: 16px;">Hola <strong>{{customerName}}</strong>,</p>
  <p style="margin-bottom: 16px;">Te informamos que tu solicitud de reembolso ha sido aprobada y el monto de <strong>{{amount}}</strong> ha sido procesado correctamente.</p>
  <div style="background-color: #f0fdfa; border-left: 4px solid #14b8a6; padding: 16px; margin: 24px 0; border-radius: 4px;">
    <p style="margin: 0; color: #0f766e;">El dinero debería reflejarse en el resumen de tu tarjeta dentro de 5-10 días hábiles, dependiendo exclusivamente de tu banco.</p>
  </div>
  <p style="margin-bottom: 16px;">{{customMessage}}</p>
  <p style="margin-top: 32px; color: #666;">Si tenés alguna pregunta adicional, no dudes en contactarnos.</p>
</div>
    `,
  },
  {
    slug: "activation_reminder",
    name: "Recordatorio de activación",
    description: "Recordá a clientes que aún no activaron su cuenta",
    template_type: "activation_reminder",
    subject: "¡No te olvides de activar tu cuenta!",
    emoji: "⏰",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <h1 style="color: #111; font-size: 24px; margin-bottom: 20px;">¡Tu cuenta te espera!</h1>
  <p style="margin-bottom: 16px;">Hola <strong>{{customerName}}</strong>,</p>
  <p style="margin-bottom: 16px;">Notamos que aún no completaste la activación de tu cuenta. ¡Te estás perdiendo de todo lo que tenemos preparado para ofrecerte!</p>
  <p style="margin-bottom: 16px;">{{customMessage}}</p>
  <div style="margin: 32px 0;">
    <a href="https://tuempresa.com" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Completar Activación</a>
  </div>
  <p style="margin-top: 32px; color: #666;">Si estás teniendo inconvenientes técnicos, respondé este mail e intentaremos ayudarte a la brevedad.</p>
</div>
    `,
  },
  {
    slug: "feedback",
    name: "Pedido de feedback",
    description: "Pedí feedback o una reseña a tus clientes",
    template_type: "custom",
    subject: "¿Cómo fue tu experiencia?",
    emoji: "⭐",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <h1 style="color: #111; font-size: 24px; margin-bottom: 20px;">¿Cómo calificarías tu experiencia?</h1>
  <p style="margin-bottom: 16px;">Hola <strong>{{customerName}}</strong>,</p>
  <p style="margin-bottom: 16px;">Tu opinión es sumamente valiosa para nosotros y para otros usuarios. Nos encantaría saber de primera mano cómo fue tu experiencia usando <strong>{{productName}}</strong>.</p>
  <p style="margin-bottom: 16px;">{{customMessage}}</p>
  <p style="margin-bottom: 16px;">Te invitamos a dejar tus comentarios, solo te tomará unos pocos segundos.</p>
  <div style="margin: 32px 0;">
    <a href="https://tuempresa.com" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Dejar mi opinión ✅</a>
  </div>
  <p style="margin-top: 32px; color: #666;">¡Muchísimas gracias por tu tiempo!</p>
</div>
    `,
  },
  {
    slug: "promotion",
    name: "Promoción / Oferta",
    description: "Enviá ofertas especiales o descuentos a tus clientes",
    template_type: "custom",
    subject: "¡Tenemos una oferta especial para vos!",
    emoji: "🎁",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <h1 style="color: #111; font-size: 24px; margin-bottom: 20px;">¡Tenemos una gran sorpresa!</h1>
  <p style="margin-bottom: 16px;">Hola <strong>{{customerName}}</strong>,</p>
  <p style="margin-bottom: 16px;">Queremos agradecerte inmensamente por ser parte activa de nuestra comunidad. Y qué mejor forma de hacerlo que con esta oferta exclusiva.</p>
  <div style="background-color: #faf5ff; border: 2px dashed #9333ea; padding: 24px; margin: 24px 0; border-radius: 8px; text-align: center;">
    <p style="margin: 0 0 8px 0; color: #7e22ce; font-size: 18px; font-weight: 600;">🎉 ¡Descuento Especial!</p>
    <p style="margin: 0; color: #581c87; font-size: 14px;">Aprovechalo hoy mismo en tu próxima compra de {{productName}}.</p>
  </div>
  <p style="margin-bottom: 16px;">{{customMessage}}</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="https://tuempresa.com" style="background-color: #9333ea; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">Obtener Beneficio</a>
  </div>
  <p style="margin-top: 32px; color: #666;">Esta oportunidad es por tiempo limitado. ¡No la dejes pasar!</p>
</div>
    `,
  },
  {
    slug: "blank",
    name: "En blanco",
    description: "Empezá desde cero con un template vacío",
    template_type: "custom",
    subject: "",
    emoji: "📄",
    blocks: [],
    custom_html: `
<div style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <p>{{customMessage}}</p>
</div>
    `,
  },
];
