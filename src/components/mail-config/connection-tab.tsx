"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Mail, ExternalLink, CheckCircle2, AlertCircle, Copy,
  ArrowRight, Send, Inbox, Link2, Key,
} from "lucide-react";
import { toast } from "sonner";
import type { EmailConfig } from "./types";

interface ConnectionTabProps {
  config: EmailConfig;
  inboundAddress: string | null;
  saving: boolean;
  onUpdate: (partial: Partial<EmailConfig>) => void;
  onSave: (partial?: Partial<EmailConfig>) => Promise<void>;
}

export function ConnectionTab({ config, inboundAddress, saving, onUpdate, onSave }: ConnectionTabProps) {
  const router = useRouter();

  const [smtpHost, setSmtpHost] = useState(config.credentials?.smtp_host ?? "");
  const [smtpPort, setSmtpPort] = useState(config.credentials?.smtp_port ?? "587");
  const [smtpUser, setSmtpUser] = useState(config.credentials?.smtp_user ?? "");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState(config.credentials?.smtp_from ?? "");

  const [resendApiKey, setResendApiKey] = useState(config.credentials?.resend_api_key ?? "");
  const defaultResendFrom = () => {
    if (config.credentials?.resend_from_email) return config.credentials.resend_from_email;
    const domain = config.email_address?.split("@")[1];
    return domain ? `reply@${domain}` : "";
  };
  const [resendFromEmail, setResendFromEmail] = useState(defaultResendFrom);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  const saveSMTP = async () => {
    await onSave({
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

  const saveResendClient = async () => {
    await onSave({
      provider: "resend_client",
      connection_method: "resend_client",
      credentials: {
        ...config.credentials,
        resend_api_key: resendApiKey,
        resend_from_email: resendFromEmail,
      },
    });
  };

  const method = config.connection_method;

  return (
    <div className="space-y-6">
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
            onChange={(e) => onUpdate({ email_address: e.target.value })}
            onBlur={() => onSave()}
            className="max-w-md text-base"
          />
        </CardContent>
      </Card>

      {/* Connection method selector */}
      <div>
        <h2 className="text-lg font-semibold mb-1">¿Cómo querés gestionar los emails de tus clientes?</h2>
        <p className="text-sm text-muted-foreground mb-4">Elegí la opción que mejor se adapte a tu caso</p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Resend */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              method === "resend_client" ? "ring-2 ring-primary border-primary" : ""
            }`}
            onClick={() => onUpdate({ connection_method: "resend_client", provider: "resend_client" })}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-purple-100 dark:bg-purple-900 p-2.5 shrink-0">
                  <Key className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Resend</h3>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800">
                      Fácil
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enviá y recibí emails con tu dominio. Solo necesitás una API key.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forwarding */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              method === "forwarding" ? "ring-2 ring-primary border-primary" : ""
            }`}
            onClick={() => onUpdate({ connection_method: "forwarding", provider: "forwarding" })}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-green-100 dark:bg-green-900 p-2.5 shrink-0">
                  <Inbox className="h-5 w-5 text-green-700 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Reenvío automático</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Solo recibir. Configurás un reenvío desde tu proveedor de email.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* IMAP */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              method === "imap" ? "ring-2 ring-primary border-primary" : ""
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
                    Conectamos directo a tu email (IMAP + SMTP).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMTP only */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              method === "smtp_only" ? "ring-2 ring-primary border-primary" : ""
            }`}
            onClick={() => onUpdate({ connection_method: "smtp_only", provider: "smtp" })}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-2.5 shrink-0">
                  <Send className="h-5 w-5 text-gray-700 dark:text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Solo enviar (SMTP)</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Respondé desde la plataforma con tu propio email.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- Detail panels ---- */}

      {/* Resend client details */}
      {method === "resend_client" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              Conectar con Resend
            </CardTitle>
            <CardDescription>
              Resend te permite enviar y recibir emails con tu dominio. Seguí estos pasos:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <div>
                  <p className="font-medium">Creá una cuenta en Resend</p>
                  <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 text-xs mt-0.5">
                    resend.com/signup <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <div>
                  <p className="font-medium">Verificá tu dominio</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    En Resend, andá a <strong>Domains</strong> y agregá tu dominio. Te va a pedir agregar registros DNS.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <div>
                  <p className="font-medium">Configurá el webhook para recibir emails</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    En Resend, andá a <strong>Webhooks</strong>, creá uno con el evento <code className="bg-muted px-1 py-0.5 rounded">email.received</code> y esta URL:
                  </p>
                  <div className="flex gap-2 items-center mt-1.5">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-xs border">
                      https://www.twenit.com/api/webhooks/resend
                    </code>
                    <Button variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => copyToClipboard("https://www.twenit.com/api/webhooks/resend")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                <div>
                  <p className="font-medium">Generá una API key y pegala acá</p>
                  <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 text-xs mt-0.5">
                    resend.com/api-keys <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </li>
            </ol>

            <div className="space-y-3 border-t pt-4">
              <div className="space-y-2">
                <Label className="text-sm">API Key de Resend</Label>
                <Input
                  type="password"
                  placeholder="re_xxxxxxxxxx"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Email de envío</Label>
                <Input
                  type="email"
                  placeholder="soporte@support.tuempresa.com"
                  value={resendFromEmail}
                  onChange={(e) => setResendFromEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  El email exacto desde el que vas a enviar. Tiene que usar el dominio que verificaste en Resend.
                </p>
              </div>

              <Button onClick={saveResendClient} disabled={saving || !resendApiKey || !resendFromEmail}>
                Guardar conexión
              </Button>
            </div>

            {config.credentials?.resend_api_key && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm dark:bg-green-950 dark:border-green-800 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Resend conectado — tu cuenta está lista para enviar y recibir emails
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Forwarding details */}
      {method === "forwarding" && (
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

            <div className="space-y-3">
              <p className="text-sm font-medium">¿Cómo se configura? (2 minutos)</p>

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
                    <li>Gmail te va a enviar un email de confirmación</li>
                    <li>Confirmá y activá el reenvío</li>
                  </ol>
                </div>
              </details>

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
                    <li>Marcá &quot;Conservar una copia&quot; si querés mantenerlos en Outlook</li>
                    <li>Guardá los cambios</li>
                  </ol>
                </div>
              </details>

              <details className="group border rounded-lg">
                <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50">
                  <div className="h-6 w-6 rounded bg-white border flex items-center justify-center shrink-0">
                    <Mail className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <span className="font-medium text-sm">Otro proveedor</span>
                  <ArrowRight className="h-4 w-4 ml-auto transition-transform group-open:rotate-90 text-muted-foreground" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>Buscá la opción de <strong>&quot;Reenvío&quot;</strong> o <strong>&quot;Forwarding&quot;</strong> y configurá el reenvío a:</p>
                  <code className="block mt-2 bg-muted px-3 py-2 rounded text-xs font-mono">{inboundAddress}</code>
                </div>
              </details>
            </div>

            {/* Optional SMTP for replies */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Responder desde tu email (opcional)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Si configurás SMTP, las respuestas salen desde tu email real. Si no, salen desde twenit.com.
              </p>
              <SmtpForm
                smtpHost={smtpHost} setSmtpHost={setSmtpHost}
                smtpPort={smtpPort} setSmtpPort={setSmtpPort}
                smtpUser={smtpUser} setSmtpUser={setSmtpUser}
                smtpPass={smtpPass} setSmtpPass={setSmtpPass}
                smtpFrom={smtpFrom} setSmtpFrom={setSmtpFrom}
                onSave={saveSMTP} saving={saving} collapsible
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* IMAP connected status */}
      {method === "imap" && (
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
      {method === "smtp_only" && (
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
              Esta opción es solo para enviar respuestas desde tu email. No recibe emails.
            </div>
            <SmtpForm
              smtpHost={smtpHost} setSmtpHost={setSmtpHost}
              smtpPort={smtpPort} setSmtpPort={setSmtpPort}
              smtpUser={smtpUser} setSmtpUser={setSmtpUser}
              smtpPass={smtpPass} setSmtpPass={setSmtpPass}
              smtpFrom={smtpFrom} setSmtpFrom={setSmtpFrom}
              onSave={saveSMTP} saving={saving}
            />
          </CardContent>
        </Card>
      )}

      {/* No method selected */}
      {(!method || method === "none") && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-medium text-muted-foreground">Elegí un método de conexión arriba</p>
            <p className="text-xs text-muted-foreground mt-1">
              Te recomendamos <strong>Resend</strong> — es la forma más fácil de enviar y recibir
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---- SMTP form (reused in forwarding + smtp_only) ---- */

interface SmtpFormProps {
  smtpHost: string; setSmtpHost: (v: string) => void;
  smtpPort: string; setSmtpPort: (v: string) => void;
  smtpUser: string; setSmtpUser: (v: string) => void;
  smtpPass: string; setSmtpPass: (v: string) => void;
  smtpFrom: string; setSmtpFrom: (v: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  collapsible?: boolean;
}

function SmtpForm({ smtpHost, setSmtpHost, smtpPort, setSmtpPort, smtpUser, setSmtpUser, smtpPass, setSmtpPass, smtpFrom, setSmtpFrom, onSave, saving, collapsible }: SmtpFormProps) {
  const content = (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Host SMTP</Label>
          <Input placeholder="smtp.gmail.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Puerto</Label>
          <Input type="number" placeholder="587" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Usuario SMTP</Label>
        <Input placeholder="usuario@gmail.com" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Contraseña / App Password</Label>
        <Input type="password" placeholder="••••••••" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Email &quot;From&quot;</Label>
        <Input placeholder="soporte@tuempresa.com" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} className="h-9 text-sm" />
      </div>
      <Button size="sm" onClick={onSave} disabled={saving || !smtpHost || !smtpUser || !smtpFrom}>
        Guardar SMTP
      </Button>
    </div>
  );

  if (collapsible) {
    return (
      <details className="group border rounded-lg">
        <summary className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 text-sm">
          <span className="font-medium">Configurar SMTP para envío</span>
          <ArrowRight className="h-4 w-4 ml-auto transition-transform group-open:rotate-90 text-muted-foreground" />
        </summary>
        <div className="px-3 pb-3">{content}</div>
      </details>
    );
  }

  return content;
}
