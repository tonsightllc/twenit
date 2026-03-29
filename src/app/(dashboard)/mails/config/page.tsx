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
  Mail, Bot, Save, Plus, Edit, Clock, ExternalLink, CheckCircle2,
  AlertCircle, Loader2, Trash2, X, Globe, Server, XCircle
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface EmailConfig {
  id?: string;
  provider: string;
  email_address: string;
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
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saving = saveStatus === "saving";
  const [config, setConfig] = useState<EmailConfig>({
    provider: "none",
    email_address: "",
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

  // Connection tab state
  const [domainInput, setDomainInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<{
    type: string; name: string; value: string; status: string; priority?: number;
  }[]>([]);

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

  // Appearance
  const [logo, setLogo] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emails/config");
      if (res.ok) {
        const { config: loaded } = await res.json();
        if (loaded) {
          setConfig(loaded);
          if (loaded.resend_domain) setDomainInput(loaded.resend_domain);
          if (loaded.credentials?.smtp_host) {
            setSmtpHost(loaded.credentials.smtp_host);
            setSmtpPort(loaded.credentials.smtp_port ?? "587");
            setSmtpUser(loaded.credentials.smtp_user ?? "");
            setSmtpFrom(loaded.credentials.smtp_from ?? "");
          }
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

  const verifyDomain = async () => {
    if (!domainInput) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/emails/verify-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setDnsRecords(
          (data.records ?? []).map((r: { type: string; name: string; value: string; status: string; priority?: number }) => ({
            type: r.type,
            name: r.name,
            value: r.value,
            status: r.status ?? "pending",
            priority: r.priority,
          }))
        );
        setConfig((prev) => ({ ...prev, resend_domain: domainInput, resend_domain_verified: data.verified }));
        toast.success(data.verified ? "✅ Dominio verificado" : "DNS records generados — aguardando propagación");
      } else {
        toast.error(data.error ?? "Error verificando dominio");
      }
    } finally {
      setVerifying(false);
    }
  };

  const saveSMTP = async () => {
    await saveConfig({
      provider: "smtp",
      email_address: smtpFrom,
      credentials: {
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_from: smtpFrom,
      },
    });
  };

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

  // Active connection status
  const connectionStatus = () => {
    if (config.provider === "resend_domain" && config.resend_domain_verified) {
      return { label: "Dominio verificado ✅", sub: `Enviando y recibiendo desde ${config.resend_domain}`, color: "bg-green-50 border-green-200 text-green-700" };
    }
    if (config.provider === "resend_domain" && config.resend_domain) {
      return { label: "DNS pendiente ⏳", sub: `Dominio ${config.resend_domain} — verificando DNS`, color: "bg-yellow-50 border-yellow-200 text-yellow-700" };
    }
    if (config.provider === "smtp") {
      return { label: "SMTP configurado", sub: `Enviando desde ${config.email_address}`, color: "bg-blue-50 border-blue-200 text-blue-700" };
    }
    return { label: "Sin configurar", sub: "Respondés desde dominio compartido de la plataforma", color: "bg-gray-50 border-gray-200 text-gray-600" };
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
          <p className="text-muted-foreground">Configurá las opciones de gestión de correo electrónico</p>
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

          {/* Case B: Resend Domain */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Dominio propio con Resend</CardTitle>
                  <CardDescription>
                    Recibí y enviá emails desde tu dominio. Requiere configurar 2 registros DNS.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">
                  Recomendado
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="miempresa.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={verifyDomain} disabled={verifying || !domainInput}>
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {config.resend_domain ? "Re-verificar" : "Configurar"}
                </Button>
              </div>

              {dnsRecords.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Registros DNS a agregar en tu proveedor:</p>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left font-medium">Tipo</th>
                          <th className="p-3 text-left font-medium">Nombre</th>
                          <th className="p-3 text-left font-medium">Valor</th>
                          <th className="p-3 text-left font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dnsRecords.map((rec, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-3 font-mono text-xs">{rec.type}</td>
                            <td className="p-3 font-mono text-xs">{rec.name}</td>
                            <td className="p-3 font-mono text-xs break-all">{rec.value}{rec.priority ? ` (Prioridad ${rec.priority})` : ""}</td>
                            <td className="p-3">
                              {rec.status === "verified" ? (
                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Verificado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                                  <Clock className="h-3 w-3 mr-1" /> Pendiente
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <a
                    href="https://resend.com/docs/dashboard/domains/introduction"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Ver guía completa de DNS <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {!dnsRecords.length && !config.resend_domain && (
                <div className="rounded-lg border p-4 bg-blue-50 border-blue-200 text-sm text-blue-800">
                  <p className="font-medium text-blue-900 mb-1">¿Cómo funciona?</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-800">
                    <li>Ingresá tu dominio (ej: <code className="bg-blue-100 px-1 rounded">miempresa.com</code>)</li>
                    <li>Hacé click en &quot;Configurar&quot; — te mostramos los registros DNS a agregar</li>
                    <li>Agregalos en tu proveedor de dominio (Cloudflare, GoDaddy, etc.)</li>
                    <li>Hacé click en &quot;Re-verificar&quot; — listo ✅</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Case C: SMTP */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                <div>
                  <CardTitle>SMTP propio</CardTitle>
                  <CardDescription>
                    Enviá desde tu cuenta de Gmail, Outlook u otro servidor. Solo envío (no recepción automática).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="rounded-lg border p-4 bg-yellow-50 border-yellow-200 text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                <strong>Importante:</strong> El SMTP solo habilita el <em>envío</em>. Para <em>recibir</em> emails automáticamente en el inbox, necesitás configurar también el dominio con Resend (arriba).
              </div>
              <Button onClick={saveSMTP} disabled={saving || !smtpHost || !smtpUser || !smtpFrom}>
                <Save className="mr-2 h-4 w-4" /> Guardar SMTP
              </Button>
            </CardContent>
          </Card>

          {/* Case A: info */}
          <Card className="border-dashed">
            <CardContent className="py-4 flex gap-3 items-start">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-muted-foreground">Sin configuración (fallback)</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Si no configurás ninguna de las opciones anteriores, podés igualmente responder emails pero saldrán desde un dominio compartido de la plataforma.
                  Los clientes verán que el email viene de un dominio genérico.
                </p>
              </div>
            </CardContent>
          </Card>
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
                        Hola <strong>Cliente</strong> 👋<br /><br />
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

              {/* Removed Guardar button as it auto-saves now */}
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
