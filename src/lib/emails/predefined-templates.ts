import type { EmailBlock } from "@/emails/components/types";

interface PredefinedTemplate {
  name: string;
  template_type: string;
  subject: string;
  blocks: EmailBlock[];
}

export const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  {
    name: "Cancelación de suscripción",
    template_type: "cancellation",
    subject: "Tu suscripción ha sido cancelada",
    blocks: [
      {
        id: "c1",
        type: "heading",
        content: "Tu suscripción ha sido cancelada",
        attrs: { level: 1 },
      },
      {
        id: "c2",
        type: "paragraph",
        content: "Hola,",
      },
      {
        id: "c3",
        type: "paragraph",
        content: "Te escribimos para confirmar que tu suscripción ha sido cancelada exitosamente.",
      },
      {
        id: "c4",
        type: "callout",
        content: "<strong>No se te realizarán más cobros.</strong> Tu acceso seguirá activo hasta el fin del período actual.",
        attrs: { variant: "warning" },
      },
      {
        id: "c5",
        type: "paragraph",
        content: "Lamentamos verte partir. Si tenés algún comentario sobre tu experiencia o si hay algo que podamos mejorar, nos encantaría escucharte.",
      },
      {
        id: "c6",
        type: "paragraph",
        content: "Si cambiás de opinión, podés volver cuando quieras.",
      },
      {
        id: "c7",
        type: "button",
        attrs: {
          label: "Reactivar suscripción",
          href: "https://tuempresa.com",
        },
      },
      {
        id: "c8",
        type: "paragraph",
        content: "Gracias por haber sido parte.",
      },
    ],
  },
  {
    name: "Bienvenida",
    template_type: "welcome",
    subject: "¡Bienvenido/a!",
    blocks: [
      {
        id: "w1",
        type: "heading",
        content: "¡Bienvenido/a!",
        attrs: { level: 1 },
      },
      {
        id: "w2",
        type: "paragraph",
        content: "Hola,",
      },
      {
        id: "w3",
        type: "paragraph",
        content: "Estamos muy contentos de tenerte con nosotros. Tu cuenta ya está activa y lista para usar.",
      },
      {
        id: "w4",
        type: "callout",
        content: "Si necesitás ayuda para empezar, no dudes en contactarnos. Estamos acá para ayudarte.",
        attrs: { variant: "info" },
      },
      {
        id: "w5",
        type: "button",
        attrs: {
          label: "Comenzar ahora",
          href: "https://tuempresa.com",
        },
      },
      {
        id: "w6",
        type: "paragraph",
        content: "¡Gracias por elegirnos!",
      },
    ],
  },
  {
    name: "Email genérico",
    template_type: "generic",
    subject: "",
    blocks: [
      {
        id: "g1",
        type: "heading",
        content: "Título del email",
        attrs: { level: 1 },
      },
      {
        id: "g2",
        type: "paragraph",
        content: "Hola,",
      },
      {
        id: "g3",
        type: "paragraph",
        content: "Escribí acá el contenido de tu email.",
      },
      {
        id: "g4",
        type: "button",
        attrs: {
          label: "Botón de acción",
          href: "https://tuempresa.com",
        },
      },
    ],
  },
];
