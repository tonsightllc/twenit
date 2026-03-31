export interface EmailConfig {
  id?: string;
  provider: string;
  email_address: string;
  connection_method?: string;
  inbound_address?: string;
  resend_domain?: string;
  resend_domain_verified?: boolean;
  credentials?: Record<string, string>;
  sender_name?: string;
  reply_to_email?: string;
  signature?: string;
  logo_url?: string;
  accent_color?: string;
  show_footer?: boolean;
  footer_text?: string;
  custom_css?: string;
  auto_classify?: boolean;
  auto_respond?: boolean;
  ai_model?: string;
  ai_categories?: string[];
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger_condition: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  enabled: boolean;
}

export const ACTION_LABELS: Record<string, string> = {
  auto_reply: "Respuesta automática",
  apply_label: "Aplicar etiqueta",
  unsubscribe: "Desuscribir cliente",
  refund: "Reembolso automático",
  create_ticket: "Crear ticket",
  forward: "Reenviar email",
};

export const CONDITION_LABELS: Record<string, string> = {
  classification: "Clasificación",
  intent: "Intención",
  from_contains: "Remitente contiene",
  subject_contains: "Asunto contiene",
};

export const DEFAULT_CONFIG: EmailConfig = {
  provider: "none",
  email_address: "",
  connection_method: "none",
  sender_name: "Soporte",
  reply_to_email: "",
  signature: "Saludos,\n\nEl equipo de Soporte",
  accent_color: "#fbbf24",
  show_footer: true,
  footer_text: "© 2024 Tu Empresa. Todos los derechos reservados.",
  auto_classify: false,
  auto_respond: false,
  ai_model: "gpt-4o-mini",
  ai_categories: ["Soporte", "Facturación", "Ventas", "Cancelación", "Otro"],
};
