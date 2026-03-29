"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail, Bot, Plus, Edit, ExternalLink, CheckCircle2,
  AlertCircle, Loader2, Trash2, X, XCircle, Copy,
  ArrowRight, Send, Inbox, Shield, Link2,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface EmailConfig {
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

interface AutomationRule {
  id: string;
  name: string;
  trigger_condition: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  enabled: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  auto_reply: "Respuesta automática",
  apply_label: "Aplicar etiqueta",
  unsubscribe: "Desuscribir cliente",
  refund: "Reembolso automático",
  create_ticket: "Crear ticket",
  forward: "Reenviar email",
};

const CONDITION_LABELS: Record<string, string> = {
  classification: "Clasificación",
  intent: "Intención",
  from_contains: "Remitente contiene",
  subject_contains: "Asunto contiene",
};

export default function MailConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saving = saveStatus === "saving";
  const [config, setConfig] = useState<EmailConfig>({
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
  });

  const [generatedInboundAddress, setGeneratedInboundAddress] = useState<string | null>(null);
  const inboundAddress = config.inbound_address ?? generatedInboundAddress;

  // SMTP state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");

  // Automation state
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [newRule, setNewRule] = useState({
    name: "",
    triggerKey: "classification",
    triggerValue: "soporte",
    action_type: "create_ticket",
    actionBody: "",
  });

  const [logo, setLogo] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emails/config");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          if (data.config.credentials?.smtp_host) {
            setSmtpHost(data.config.credentials.smtp_host);
            setSmtpPort(data.config.credentials.smtp_port ?? "587");
            setSmtpUser(data.config.credentials.smtp_user ?? "");
            setSmtpFrom(data.config.credentials.smtp_from ?? "");
          }
        }
        if (data.generatedInboundAddress) {
          setGeneratedInboundAddress(data.generatedInboundAddress);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/emails/automation");
    if (res.ok) {
      const { rules } = await res.json();
      setRules(rules ?? []);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchRules();
  }, [fetchConfig, fetchRules]);

  const saveConfig = async (partial?: Partial<EmailConfig>) => {
    setSaveStatus("saving");
    try {
      const payload = { ...config, ...partial };
      const res = await fetch("/api/emails/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const { config: saved } = await res.json();
        setConfig(saved);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        const { error } = await res.json();
        toast.error(error ?? "Error al guardar");
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    } catch {
      toast.error("Error al guardar");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  };

  const handleUpdate = (partial: Partial<EmailConfig>) => {
    setConfig(c => ({ ...c, ...partial }));
    saveConfig(partial);
  };

  const saveSMTP = async () => {
    await saveConfig({
      provider: "smtp",
      connection_method: "smtp_only",
      email_address: smtpFrom,
      credentials: {
        ...config.credentials,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        smtp_from: smtpFrom,
      },
    });
  };

  const activateForwarding = async () => {
    await saveConfig({
      provider: "forwarding",
      connection_method: "forwarding",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  // Automation CRUD
  const saveRule = async () => {
    const payload = {
      name: newRule.name,
      trigger_condition: { [newRule.triggerKey]: newRule.triggerValue },
      action_type: newRule.action_type,
      action_config: newRule.actionBody ? { body: newRule.actionBody } : {},
      enabled: true,
    };

    if (editingRule) {
      const res = await fetch("/api/emails/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingRule.id, ...payload }),
      });
      if (res.ok) {
        const { rule } = await res.json();
        setRules((r) => r.map((x) => (x.id === rule.id ? rule : x)));
        toast.success("Regla actualizada");
      }
    } else {
      const res = await fetch("/api/emails/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const { rule } = await res.json();
        setRules((r) => [...r, rule]);
        toast.success("Regla creada");
      }
    }
    setShowRuleModal(false);
    setEditingRule(null);
    setNewRule({ name: "", triggerKey: "classification", triggerValue: "soporte", action_type: "create_ticket", actionBody: "" });
  };

  const toggleRule = async (rule: AutomationRule) => {
    const res = await fetch("/api/emails/automation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
    });
    if (res.ok) {
      setRules((r) => r.map((x) => (x.id === rule.id ? { ...x, enabled: !x.enabled } : x)));
    }
  };

  const deleteRule = async (id: string) => {
    await fetch(`/api/emails/automation?id=${id}`, { method: "DELETE" });
    setRules((r) => r.filter((x) => x.id !== id));
    toast.success("Regla eliminada");
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const openRuleModal = (rule?: AutomationRule) => {
    if (rule) {
      setEditingRule(rule);
      const [condKey, condVal] = Object.entries(rule.trigger_condition)[0] ?? ["classification", "soporte"];
      setNewRule({
        name: rule.name,
        triggerKey: condKey,
        triggerValue: condVal,
        action_type: rule.action_type,
        actionBody: (rule.action_config as { body?: string })?.body ?? "",
      });
    } else {
      setEditingRule(null);
      setNewRule({ name: "", triggerKey: "classification", triggerValue: "soporte", action_type: "create_ticket", actionBody: "" });
    }
    setShowRuleModal(true);
  };

  const connectionStatus = () => {
    const method = config.connection_method ?? "none";
    if (method === "forwarding") {
      return { label: "Reenvío automático activo", sub: `Recibiendo emails en ${config.inbound_address}`, color: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400" };
    }
    if (method === "imap") {
      return { label: "Casilla conectada", sub: `Sincronizando ${config.email_address}`, color: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400" };
    }
    if (method === "smtp_only") {
      return { label: "Solo envío configurado", sub: `Enviando desde ${config.email_address}`, color: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400" };
    }
    return { label: "Sin configurar", sub: "Configurá tu email para recibir y responder desde la plataforma", color: "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400" };
  };

  const status = connectionStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración de Mails</h1>
          <p className="text-muted-foreground">Configurá cómo recibís y respondés los emails de tus clientes</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium mr-4">
          {saveStatus === "saving" && <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Guardando...</span></>}
          {saveStatus === "saved" && <><CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /><span className="text-green-600 dark:text-green-500">Guardado</span></>}
          {saveStatus === "error" && <><XCircle className="h-4 w-4 text-red-600 dark:text-red-500" /><span className="text-red-600 dark:text-red-500">Error</span></>}
        </div>
      </div>

      {/* Status bar */}
      <div className={`rounded-lg border p-3 ${status.color}`}>
        <div className="flex items-center gap-2 text-sm font-medium">{status.label}</div>
        <p className="text-xs mt-0.5 opacity-80">{status.sub}</p>
      </div>

      <Tabs defaultValue="connection">
        <TabsList>
          <TabsTrigger value="connection">Conexión</TabsTrigger>
          <TabsTrigger value="appearance">Personalización</TabsTrigger>
          <TabsTrigger value="classification">Clasificación IA</TabsTrigger>
          <TabsTrigger value="automation">Automatización</TabsTrigger>
        </TabsList>

        {/* =================== CONEXIÓN =================== */}
        <TabsContent value="connection" className="mt-6 space-y-6">

          {/* Email address field */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                ¿Cuál es tu email de atención al cliente?
              </CardTitle>
              <CardDescription>
                Es el email desde el que le escribís a tus clientes (ej: soporte@tuempresa.com, contacto@mitienda.com)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="email"
                placeholder="soporte@tuempresa.com"
                value={config.email_address}
                onChange={(e) => setConfig(c => ({ ...c, email_address: e.target.value }))}
                onBlur={() => saveConfig()}
                className="max-w-md text-base"
              />
            </CardContent>
          </Card>

          {/* Connection method selector */}
          <div>
            <h2 className="text-lg font-semibold mb-1">¿Cómo querés recibir los emails de tus clientes?</h2>
            <p className="text-sm text-muted-foreground mb-4">Elegí la opción que mejor se adapte a tu caso</p>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Option 1: Forwarding */}
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  config.connection_method === "forwarding"
                    ? "ring-2 ring-primary border-primary"
                    : ""
                }`}
                onClick={() => handleUpdate({ connection_method: "forwarding", provider: "forwarding" })}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-green-100 dark:bg-green-900 p-2.5 shrink-0">
                      <Inbox className="h-5 w-5 text-green-700 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Reenvío automático</h3>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                          Recomendado
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Recibí los emails de tus clientes sin compartir tu contraseña. Solo configurás un reenvío.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Option 2: IMAP */}
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  config.connection_method === "imap"
                    ? "ring-2 ring-primary border-primary"
                    : ""
                }`}
                onClick={() => router.push("/mails/config/connect")}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-100 dark:bg-blue-900 p-2.5 shrink-0">
                      <Link2 className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Conectar tu casilla</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Conectamos directo a tu email para recibir y responder automáticamente.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Option 3: SMTP only */}
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  config.connection_method === "smtp_only"
                    ? "ring-2 ring-primary border-primary"
                    : ""
                }`}
                onClick={() => handleUpdate({ connection_method: "smtp_only", provider: "smtp" })}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-2.5 shrink-0">
                      <Send className="h-5 w-5 text-gray-700 dark:text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Solo enviar</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Solo respondé desde la plataforma. No recibís emails automáticamente.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Forwarding details */}
          {config.connection_method === "forwarding" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Configurar reenvío
                </CardTitle>
                <CardDescription>
                  Configurá tu email para que reenvíe automáticamente los mensajes a la dirección de abajo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Assigned address */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tu dirección de reenvío</Label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm border">
                      {inboundAddress ?? "Generando..."}
                    </div>
                    {inboundAddress && (
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(inboundAddress)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">¿Cómo se configura? (2 minutos)</p>

                  {/* Gmail instructions */}
                  <details className="group border rounded-lg">
                    <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50">
                      <div className="h-6 w-6 rounded bg-white border flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-red-500">G</span>
                      </div>
                      <span className="font-medium text-sm">Gmail</span>
                      <ArrowRight className="h-4 w-4 ml-auto transition-transform group-open:rotate-90 text-muted-foreground" />
                    </summary>
                    <div className="px-4 pb-4 space-y-2 text-sm text-muted-foreground">
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Abrí <a href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Configuración de Gmail <ExternalLink className="h-3 w-3" /></a></li>
                        <li>Hacé click en <strong>&quot;Agregar una dirección de reenvío&quot;</strong></li>
                        <li>Ingresá: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{inboundAddress}</code></li>
                        <li>Gmail te va a enviar un email de confirmación — lo vas a ver en tu Inbox de la plataforma</li>
                        <li>Confirmá y activá el reenvío</li>
                      </ol>
                    </div>
                  </details>

                  {/* Outlook instructions */}
                  <details className="group border rounded-lg">
                    <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50">
                      <div className="h-6 w-6 rounded bg-white border flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-600">O</span>
                      </div>
                      <span className="font-medium text-sm">Outlook / Hotmail</span>
                      <ArrowRight className="h-4 w-4 ml-auto transition-transform group-open:rotate-90 text-muted-foreground" />
                    </summary>
                    <div className="px-4 pb-4 space-y-2 text-sm text-muted-foreground">
                      <ol className="list-decimal list-inside space-y-1.5">
                        <li>Abrí <a href="https://outlook.live.com/mail/0/options/mail/forwarding" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Configuración de Outlook <ExternalLink className="h-3 w-3" /></a></li>
                        <li>Activá <strong>&quot;Habilitar reenvío&quot;</strong></li>
                        <li>Ingresá: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{inboundAddress}</code></li>
                        <li>Marcá &quot;Conservar una copia&quot; si querés mantener los emails también en Outlook</li>
                        <li>Guardá los cambios</li>
                      </ol>
                    </div>
                  </details>

                  {/* Other providers */}
                  <details className="group border rounded-lg">
                    <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50">
                      <div className="h-6 w-6 rounded bg-white border flex items-center justify-center shrink-0">
                        <Mail className="h-3.5 w-3.5 text-gray-500" />
                      </div>
                      <span className="font-medium text-sm">Otro proveedor</span>
                      <ArrowRight className="h-4 w-4 ml-auto transition-transform group-open:rotate-90 text-muted-foreground" />
                    </summary>
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      <p>Buscá en la configuración de tu proveedor de email la opción de <strong>&quot;Reenvío&quot;</strong> o <strong>&quot;Forwarding&quot;</strong> y configuralo para que reenvíe a:</p>
                      <code className="block mt-2 bg-muted px-3 py-2 rounded text-xs font-mono">{inboundAddress}</code>
                    </div>
                  </details>
                </div>

                {config.connection_method !== "forwarding" && (
                  <Button onClick={activateForwarding} disabled={saving}>
                    Activar reenvío
                  </Button>
                )}

                {/* Optional SMTP for replies */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Responder desde tu email (opcional)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Si configurás SMTP, las respuestas van a salir desde tu email real. Si no, salen desde el dominio de la plataforma.
                  </p>
                  <details className="group border rounded-lg">
                    <summary className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 text-sm">
                      <span className="font-medium">Configurar SMTP para envío</span>
                      <ArrowRight className="h-4 w-4 ml-auto transition-transform group-open:rotate-90 text-muted-foreground" />
                    </summary>
                    <div className="px-3 pb-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Host</Label>
                          <Input placeholder="smtp.gmail.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Puerto</Label>
                          <Input type="number" placeholder="587" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="h-9 text-sm" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Usuario</Label>
                        <Input placeholder="usuario@gmail.com" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Contraseña</Label>
                        <Input type="password" placeholder="••••••••" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email &quot;From&quot;</Label>
                        <Input placeholder="soporte@tuempresa.com" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} className="h-9 text-sm" />
                      </div>
                      <Button size="sm" onClick={saveSMTP} disabled={saving || !smtpHost || !smtpUser || !smtpFrom}>
                        Guardar SMTP
                      </Button>
                    </div>
                  </details>
                </div>
              </CardContent>
            </Card>
          )}

          {/* IMAP connected status */}
          {config.connection_method === "imap" && (
            <Card>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 dark:bg-green-900 p-2">
                    <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Casilla conectada</p>
                    <p className="text-xs text-muted-foreground">
                      Sincronizando {config.email_address} — se revisan nuevos emails cada pocos minutos
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/mails/config/connect")}>
                  Modificar conexión
                </Button>
              </CardContent>
            </Card>
          )}

          {/* SMTP only details */}
          {config.connection_method === "smtp_only" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configurar envío por SMTP</CardTitle>
                <CardDescription>
                  Configurá las credenciales de tu servidor de email para enviar respuestas desde tu dirección.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-3 bg-amber-50 border-amber-200 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Con esta opción no vas a recibir emails automáticamente en la plataforma. Si querés recibir también, elegí &quot;Reenvío automático&quot; o &quot;Conectar tu casilla&quot;.
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Host SMTP</Label>
                    <Input placeholder="smtp.gmail.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Puerto</Label>
                    <Input type="number" placeholder="587" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Usuario SMTP</Label>
                  <Input placeholder="usuario@gmail.com" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña / App Password</Label>
                  <Input type="password" placeholder="••••••••" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email &quot;From&quot;</Label>
                  <Input placeholder="soporte@miempresa.com" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} />
                </div>
                <Button onClick={saveSMTP} disabled={saving || !smtpHost || !smtpUser || !smtpFrom}>
                  Guardar SMTP
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No method selected hint */}
          {(!config.connection_method || config.connection_method === "none") && (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-medium text-muted-foreground">Elegí un método de conexión arriba</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Te recomendamos &quot;Reenvío automático&quot; — es la forma más fácil y segura
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =================== PERSONALIZACIÓN =================== */}
        <TabsContent value="appearance" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Identidad del Remitente</CardTitle>
                  <CardDescription>Cómo te verán tus clientes cuando reciban tus correos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre del Remitente</Label>
                    <Input
                      value={config.sender_name ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, sender_name: e.target.value }))}
                      onBlur={() => saveConfig()}
                      placeholder="Ej: Soporte de TuEmpresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email de Respuesta (reply-to)</Label>
                    <Input
                      value={config.reply_to_email ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, reply_to_email: e.target.value }))}
                      onBlur={() => saveConfig()}
                      placeholder="soporte@tuempresa.com"
                    />
                    <p className="text-xs text-muted-foreground">A donde llegan las respuestas de tus clientes.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estilo y Marca</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-md border border-dashed flex items-center justify-center bg-muted/50">
                        {logo ? (
                          <Image src={logo} alt="Logo" width={48} height={48} className="h-full w-full object-contain" unoptimized />
                        ) : (
                          <span className="text-xs text-muted-foreground">Logo</span>
                        )}
                      </div>
                      <Input type="file" accept="image/*" className="max-w-[250px]" onChange={handleLogoChange} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Color de Acento</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={config.accent_color ?? "#fbbf24"}
                        onChange={(e) => setConfig((c) => ({ ...c, accent_color: e.target.value }))}
                        onBlur={() => saveConfig()}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={config.accent_color ?? "#fbbf24"}
                        onChange={(e) => setConfig((c) => ({ ...c, accent_color: e.target.value }))}
                        onBlur={() => saveConfig()}
                        className="flex-1 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Firma del Correo</Label>
                    <textarea
                      className="w-full min-h-[100px] p-3 border rounded-md bg-background text-sm resize-y"
                      value={config.signature ?? ""}
                      onChange={(e) => setConfig((c) => ({ ...c, signature: e.target.value }))}
                      onBlur={() => saveConfig()}
                    />
                  </div>

                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <Label>Footer del Correo</Label>
                      <Switch
                        checked={config.show_footer ?? true}
                        onCheckedChange={(v) => handleUpdate({ show_footer: v })}
                      />
                    </div>
                    {config.show_footer && (
                      <textarea
                        className="w-full min-h-[70px] p-3 border rounded-md bg-background text-xs resize-y text-muted-foreground"
                        value={config.footer_text ?? ""}
                        onChange={(e) => setConfig((c) => ({ ...c, footer_text: e.target.value }))}
                        onBlur={() => saveConfig()}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            <div className="lg:sticky lg:top-6 h-fit">
              <Card className="overflow-hidden border-2 shadow-lg">
                <div className="bg-muted/50 border-b p-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="mx-auto text-xs text-muted-foreground font-medium bg-background px-3 py-1 rounded-md shadow-sm border">
                    Vista Previa
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="bg-white min-h-[450px] text-zinc-900 font-sans p-8">
                    <div className="max-w-md mx-auto">
                      {logo && <Image src={logo} alt="Logo" width={64} height={64} className="h-14 w-auto mx-auto mb-4 object-contain" unoptimized />}
                      <h2 className="text-lg font-bold text-center mb-4" style={{ color: "#111827" }}>
                        Asunto del email de ejemplo
                      </h2>
                      <p className="text-[15px] text-zinc-700 leading-relaxed">
                        Hola <strong>Cliente</strong><br /><br />
                        Este es el cuerpo del email. Aquí va el contenido principal del mensaje.
                      </p>
                      <div className="mt-6 py-4 text-center">
                        <a
                          href="#"
                          className="inline-block px-6 py-3 rounded-full text-white font-semibold text-sm"
                          style={{ backgroundColor: config.accent_color ?? "#fbbf24", color: "#111" }}
                        >
                          Botón de acción
                        </a>
                      </div>
                      {config.signature && (
                        <div className="mt-6 pt-4 border-t border-zinc-100 text-zinc-600 text-sm whitespace-pre-wrap">
                          {config.signature}
                        </div>
                      )}
                      {config.show_footer && config.footer_text && (
                        <div className="mt-4 text-xs text-zinc-400 text-center whitespace-pre-wrap">
                          {config.footer_text}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* =================== CLASIFICACIÓN IA =================== */}
        <TabsContent value="classification" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <CardTitle>Clasificación con IA</CardTitle>
              </div>
              <CardDescription>
                Clasificá automáticamente los emails entrantes por categoría e intención usando OpenAI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clasificación Automática</Label>
                  <p className="text-sm text-muted-foreground">Se activa al recibir cada email (requiere OPENAI_API_KEY)</p>
                </div>
                <Switch
                  checked={config.auto_classify ?? false}
                  onCheckedChange={(v) => handleUpdate({ auto_classify: v })}
                />
              </div>

              {config.auto_classify && (
                <div className="space-y-4 pl-4 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>Modelo de IA</Label>
                    <Select
                      value={config.ai_model ?? "gpt-4o-mini"}
                      onValueChange={(v) => handleUpdate({ ai_model: v })}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (rápido)</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o (preciso)</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (económico)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Categorías</Label>
                    <div className="flex flex-wrap gap-2">
                      {(config.ai_categories ?? []).map((cat) => (
                        <Badge key={cat} variant="outline" className="gap-1">
                          {cat}
                          <button
                            onClick={() => {
                              const newCats = (config.ai_categories ?? []).filter((x) => x !== cat);
                              handleUpdate({ ai_categories: newCats });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          const cat = prompt("Nueva categoría:");
                          if (cat) {
                            const newCats = [...(config.ai_categories ?? []), cat];
                            handleUpdate({ ai_categories: newCats });
                          }
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== AUTOMATIZACIÓN =================== */}
        <TabsContent value="automation" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Reglas de Automatización</CardTitle>
                  <CardDescription>
                    Acciones automáticas que se ejecutan al recibir emails
                  </CardDescription>
                </div>
                <Button onClick={() => openRuleModal()}>
                  <Plus className="mr-2 h-4 w-4" /> Nueva Regla
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No hay reglas configuradas</p>
                  <p className="text-xs mt-1">Creá una regla para automatizar acciones</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{rule.name}</p>
                          <Badge variant={rule.enabled ? "default" : "secondary"} className="text-xs">
                            {rule.enabled ? "Activa" : "Inactiva"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>Si: {Object.entries(rule.trigger_condition).map(([k, v]) => `${CONDITION_LABELS[k] ?? k} = ${v}`).join(", ")}</span>
                          <span>→</span>
                          <span>Acción: {ACTION_LABELS[rule.action_type] ?? rule.action_type}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRuleModal(rule)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{editingRule ? "Editar Regla" : "Nueva Regla"}</CardTitle>
                <button onClick={() => setShowRuleModal(false)}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Auto-ticket soporte"
                  value={newRule.name}
                  onChange={(e) => setNewRule((r) => ({ ...r, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Condición (Cuando...)</Label>
                <div className="flex gap-2">
                  <Select value={newRule.triggerKey} onValueChange={(v) => setNewRule((r) => ({ ...r, triggerKey: v }))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="soporte"
                    value={newRule.triggerValue}
                    onChange={(e) => setNewRule((r) => ({ ...r, triggerValue: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Acción</Label>
                <Select value={newRule.action_type} onValueChange={(v) => setNewRule((r) => ({ ...r, action_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(newRule.action_type === "auto_reply" || newRule.action_type === "forward") && (
                <div className="space-y-2">
                  <Label>{newRule.action_type === "auto_reply" ? "Texto de respuesta automática" : "Email destino"}</Label>
                  <textarea
                    className="w-full min-h-[80px] p-3 text-sm border rounded-md bg-background resize-none"
                    value={newRule.actionBody}
                    onChange={(e) => setNewRule((r) => ({ ...r, actionBody: e.target.value }))}
                    placeholder={newRule.action_type === "auto_reply" ? "Gracias por contactarnos, te respondemos pronto..." : "equipo@empresa.com"}
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowRuleModal(false)}>Cancelar</Button>
                <Button onClick={saveRule} disabled={!newRule.name || !newRule.triggerValue}>
                  {editingRule ? "Actualizar" : "Crear"} Regla
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
