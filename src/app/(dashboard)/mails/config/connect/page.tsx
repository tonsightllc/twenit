"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield, ArrowLeft, Loader2, CheckCircle2, XCircle,
  ExternalLink, Eye, EyeOff, Lock,
} from "lucide-react";
import { toast } from "sonner";

const KNOWN_PROVIDERS: Record<string, {
  name: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: string;
  appPasswordUrl?: string;
  appPasswordGuide?: string;
}> = {
  "gmail.com": {
    name: "Gmail",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    smtp_host: "smtp.gmail.com",
    smtp_port: "587",
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    appPasswordGuide: "Necesitás generar una \"Contraseña de aplicación\" en tu cuenta de Google. Esto es distinto a tu contraseña normal.",
  },
  "googlemail.com": {
    name: "Gmail",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    smtp_host: "smtp.gmail.com",
    smtp_port: "587",
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    appPasswordGuide: "Necesitás generar una \"Contraseña de aplicación\" en tu cuenta de Google. Esto es distinto a tu contraseña normal.",
  },
  "outlook.com": {
    name: "Outlook",
    imap_host: "outlook.office365.com",
    imap_port: 993,
    smtp_host: "smtp-mail.outlook.com",
    smtp_port: "587",
  },
  "hotmail.com": {
    name: "Outlook",
    imap_host: "outlook.office365.com",
    imap_port: 993,
    smtp_host: "smtp-mail.outlook.com",
    smtp_port: "587",
  },
  "live.com": {
    name: "Outlook",
    imap_host: "outlook.office365.com",
    imap_port: 993,
    smtp_host: "smtp-mail.outlook.com",
    smtp_port: "587",
  },
  "yahoo.com": {
    name: "Yahoo",
    imap_host: "imap.mail.yahoo.com",
    imap_port: 993,
    smtp_host: "smtp.mail.yahoo.com",
    smtp_port: "465",
    appPasswordUrl: "https://login.yahoo.com/account/security/app-passwords",
    appPasswordGuide: "Necesitás generar una \"App Password\" en la sección de seguridad de tu cuenta Yahoo.",
  },
};

function detectProvider(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? KNOWN_PROVIDERS[domain] ?? null : null;
}

export default function ConnectEmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");

  const [testResult, setTestResult] = useState<{
    imap?: { ok: boolean; error?: string };
    smtp?: { ok: boolean; error?: string };
  } | null>(null);

  const provider = detectProvider(email);

  useEffect(() => {
    if (provider) {
      setImapHost(provider.imap_host);
      setImapPort(String(provider.imap_port));
      setSmtpHost(provider.smtp_host);
      setSmtpPort(provider.smtp_port);
      if (!imapUser) setImapUser(email);
      if (!smtpUser) setSmtpUser(email);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.name, email]);

  const fetchExistingConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emails/config");
      if (res.ok) {
        const { config } = await res.json();
        if (config) {
          setEmail(config.email_address ?? "");
          const creds = config.credentials ?? {};
          if (creds.imap_host) {
            setImapHost(creds.imap_host);
            setImapPort(creds.imap_port ?? "993");
            setImapUser(creds.imap_user ?? "");
          }
          if (creds.smtp_host) {
            setSmtpHost(creds.smtp_host);
            setSmtpPort(creds.smtp_port ?? "587");
            setSmtpUser(creds.smtp_user ?? "");
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExistingConfig();
  }, [fetchExistingConfig]);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/emails/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imap: { host: imapHost, port: parseInt(imapPort), user: imapUser, pass: imapPass },
          smtp: { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass || imapPass },
        }),
      });
      const result = await res.json();
      setTestResult(result);

      if (result.imap?.ok && result.smtp?.ok) {
        toast.success("Conexión exitosa");
      } else {
        const errors: string[] = [];
        if (result.imap && !result.imap.ok) errors.push(`Recepción: ${result.imap.error}`);
        if (result.smtp && !result.smtp.ok) errors.push(`Envío: ${result.smtp.error}`);
        toast.error(errors.join(" | ") || "Error de conexión");
      }
    } catch {
      toast.error("Error al probar la conexión");
    } finally {
      setTesting(false);
    }
  };

  const saveConnection = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/emails/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: email,
          provider: "imap",
          connection_method: "imap",
          credentials: {
            imap_host: imapHost,
            imap_port: imapPort,
            imap_user: imapUser,
            imap_pass: imapPass,
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_user: smtpUser,
            smtp_pass: smtpPass || imapPass,
            smtp_from: email,
          },
        }),
      });
      if (res.ok) {
        toast.success("Conexión guardada correctamente");
        router.push("/mails/config");
      } else {
        const { error } = await res.json();
        toast.error(error ?? "Error al guardar");
      }
    } catch {
      toast.error("Error al guardar la conexión");
    } finally {
      setSaving(false);
    }
  };

  const canTest = imapHost && imapUser && imapPass && smtpHost && smtpUser;
  const canSave = canTest && testResult?.imap?.ok && testResult?.smtp?.ok;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/mails/config")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Volver a configuración
      </Button>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Conectá tu email de forma segura</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Necesitamos acceso a tu casilla para recibir y responder los emails de tus clientes desde la plataforma
        </p>
      </div>

      {/* Security assurances */}
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30">
        <CardContent className="py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-300">Tus credenciales se guardan <strong>encriptadas</strong></p>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-300">Solo leemos tu bandeja, <strong>no modificamos nada</strong></p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-300">Podés <strong>desconectar en cualquier momento</strong></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu email</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="email"
            placeholder="soporte@tuempresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-base"
          />
          {provider && (
            <p className="text-sm text-muted-foreground mt-2">
              Detectamos que usás <strong>{provider.name}</strong> — configuramos todo automáticamente
            </p>
          )}
        </CardContent>
      </Card>

      {/* Provider-specific guide */}
      {provider?.appPasswordGuide && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="py-4 space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Paso importante para {provider.name}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {provider.appPasswordGuide}
            </p>
            {provider.appPasswordUrl && (
              <a
                href={provider.appPasswordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
              >
                Crear contraseña de aplicación <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Credentials form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciales de acceso</CardTitle>
          <CardDescription>
            {provider
              ? `Los datos del servidor ya están configurados para ${provider.name}. Solo necesitás ingresar tu contraseña.`
              : "Ingresá los datos de tu servidor de email. Si no los conocés, consultá con tu proveedor."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Password field (most important) */}
          <div className="space-y-2">
            <Label>{provider?.appPasswordGuide ? "Contraseña de aplicación" : "Contraseña"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={imapPass}
                onChange={(e) => setImapPass(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Advanced settings (pre-filled if provider detected) */}
          <details className={provider ? "group" : "group open"} open={!provider}>
            <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <span>Configuración avanzada del servidor</span>
              <ArrowLeft className="h-3 w-3 rotate-[270deg] transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-4 pl-0">
              {/* IMAP section */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recepción (IMAP)</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Servidor</Label>
                    <Input placeholder="imap.gmail.com" value={imapHost} onChange={(e) => setImapHost(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Puerto</Label>
                    <Input type="number" value={imapPort} onChange={(e) => setImapPort(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Usuario</Label>
                  <Input placeholder={email || "tu@email.com"} value={imapUser} onChange={(e) => setImapUser(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              {/* SMTP section */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Envío (SMTP)</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Servidor</Label>
                    <Input placeholder="smtp.gmail.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Puerto</Label>
                    <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Usuario</Label>
                  <Input placeholder={email || "tu@email.com"} value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contraseña SMTP (dejar vacío si es la misma)</Label>
                  <Input type="password" placeholder="Misma contraseña" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Test result */}
      {testResult && (
        <Card className={testResult.imap?.ok && testResult.smtp?.ok ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2">
              {testResult.imap?.ok
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <XCircle className="h-4 w-4 text-red-600" />
              }
              <span className="text-sm">
                Recepción: {testResult.imap?.ok ? "Conectado correctamente" : testResult.imap?.error ?? "No probado"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {testResult.smtp?.ok
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <XCircle className="h-4 w-4 text-red-600" />
              }
              <span className="text-sm">
                Envío: {testResult.smtp?.ok ? "Conectado correctamente" : testResult.smtp?.error ?? "No probado"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => router.push("/mails/config")}>
          Cancelar
        </Button>
        <Button
          variant="outline"
          onClick={testConnection}
          disabled={!canTest || testing}
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Probar conexión
        </Button>
        <Button
          onClick={saveConnection}
          disabled={!canSave || saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Guardar y conectar
        </Button>
      </div>
    </div>
  );
}
