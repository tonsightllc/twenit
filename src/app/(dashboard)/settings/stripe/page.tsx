"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CreditCard,
  Link as LinkIcon,
  Loader2,
  ShieldCheck,
  BarChart3,
  Bell,
  UserMinus,
  AlertTriangle,
  XCircle,
  Key,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useOrg } from "@/components/providers/org-provider";

interface StripeConnectionData {
  id: string;
  stripe_account_id: string;
  livemode: boolean;
  connected_at: string;
  connection_type: string | null;
  has_webhook_secret: boolean;
}

const FEATURES = [
  {
    icon: BarChart3,
    title: "Dashboard de Ventas",
    description:
      "Visualiza ingresos, suscripciones activas y nuevos clientes en tiempo real.",
  },
  {
    icon: UserMinus,
    title: "Gestión de Desuscripciones",
    description:
      "Cancela, pausa o aplica descuentos a suscripciones directamente.",
  },
  {
    icon: CreditCard,
    title: "Refunds",
    description:
      "Procesa reembolsos totales o parciales con un click desde el dashboard.",
  },
  {
    icon: AlertTriangle,
    title: "Disputas y Evidencia",
    description:
      "Recibe alertas de disputas y envía evidencia automáticamente a Stripe.",
  },
  {
    icon: ShieldCheck,
    title: "Early Fraud Warning (EFW)",
    description:
      "Detecta fraude temprano y actúa automáticamente según tus reglas.",
  },
  {
    icon: Bell,
    title: "Automatizaciones",
    description:
      "Envía emails, crea tickets y ejecuta acciones cuando ocurren eventos en Stripe.",
  },
];

export default function StripeSettingsPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connection, setConnection] = useState<StripeConnectionData | null>(null);
  const [customerCount, setCustomerCount] = useState(0);
  const [subCount, setSubCount] = useState(0);
  const [connectMethod, setConnectMethod] = useState<"oauth" | "apikey" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncIncomplete, setSyncIncomplete] = useState(false);
  const [liveCustomers, setLiveCustomers] = useState<number | null>(null);
  const [liveSubs, setLiveSubs] = useState<number | null>(null);

  // Webhook registration state
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [showManualSecret, setShowManualSecret] = useState(false);
  const [manualSecret, setManualSecret] = useState("");

  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [connectingApiKey, setConnectingApiKey] = useState(false);

  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "stripe_connected") {
      toast.success("Stripe conectado exitosamente");
    }
    if (error) {
      const errorMessages: Record<string, string> = {
        no_org: "Tu usuario no tiene una organización asignada.",
        missing_params: "Faltan parámetros en la respuesta de Stripe.",
        oauth_failed: "Error en la autenticación con Stripe.",
        db_error: "Error al guardar la conexión.",
      };
      toast.error(errorMessages[error] || `Error: ${error}`);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !orgId) { setLoading(false); return; }

    const [{ data: stripeConnection }, { count: customers }, { count: subs }] =
      await Promise.all([
        supabase
          .from("stripe_connections")
          .select("id, stripe_account_id, livemode, connected_at, connection_type, webhook_secret")
          .eq("org_id", orgId)
          .single(),
        supabase
          .from("customers")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId),
        supabase
          .from("subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "active"),
      ]);

    setConnection(stripeConnection ? {
      ...stripeConnection,
      has_webhook_secret: !!stripeConnection.webhook_secret,
    } : null);
    setCustomerCount(customers || 0);
    setSubCount(subs || 0);
    setLoading(false);
  }, [supabase, orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    setSyncIncomplete(false);
    // Resume UX: start counters from what's already in DB, not 0
    setLiveCustomers(customerCount);
    setLiveSubs(subCount);
    let completed = false;

    try {
      const res = await fetch("/api/stripe/sync", { method: "POST" });
      if (!res.ok || !res.body) {
        toast.error("Error al iniciar sincronización");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as {
              phase: string;
              customers: number;
              subscriptions: number;
              done: boolean;
              error?: string;
            };
            setLiveCustomers(data.customers);
            setLiveSubs(data.subscriptions);

            if (data.done) {
              completed = true;
              toast.success(`Sincronización completa — ${data.customers} clientes, ${data.subscriptions} suscripciones`);
            } else if (data.error) {
              toast.error(`Error durante sync: ${data.error}`);
            }
          } catch {
            // malformed chunk, skip
          }
        }
      }

      if (!completed) {
        setSyncIncomplete(true);
        toast.warning("La sincronización se interrumpió antes de completarse");
      }

      await loadData();
    } catch {
      toast.error("Error de conexión durante la sincronización");
    } finally {
      setSyncing(false);
      setLiveCustomers(null);
      setLiveSubs(null);
    }
  }

  async function handleRegisterWebhook(manualSecretValue?: string) {
    setRegisteringWebhook(true);
    try {
      const body = manualSecretValue ? { manualSecret: manualSecretValue } : {};
      const res = await fetch("/api/stripe/register-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.method === "manual" ? "Webhook secret guardado" : "Webhook registrado automáticamente ✓");
        setShowManualSecret(false);
        setManualSecret("");
        await loadData();
      } else if (data.needsManual) {
        toast.warning("No se pudo registrar automáticamente. Pegá el secret manualmente.");
        setShowManualSecret(true);
      } else {
        toast.error(data.error || "Error al registrar webhook");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setRegisteringWebhook(false);
    }
  }

  async function handleApiKeyConnect() {
    if (!apiKey.trim()) return;
    setConnectingApiKey(true);
    try {
      const res = await fetch("/api/stripe/connect-apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          data.webhookRegistered
            ? `Stripe conectado — webhook registrado automáticamente ✓`
            : `Stripe conectado — configurá el webhook manualmente en tu dashboard de Stripe`
        );
        setApiKey("");
        setConnectMethod(null);
        await loadData();
      } else {
        toast.error(data.error || "Error al conectar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setConnectingApiKey(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("¿Estás seguro de desconectar Stripe? Se perderá la sincronización de datos.")) return;
    setDisconnecting(true);
    try {
      const response = await fetch("/api/stripe/disconnect", { method: "POST" });
      const result = await response.json();
      if (result.success) {
        toast.success("Stripe desconectado");
        setConnection(null);
      } else {
        toast.error(result.error || "Error al desconectar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexión con Stripe</h1>
          <p className="text-muted-foreground">
            {connection
              ? "Tu cuenta de Stripe está conectada"
              : "Conecta tu cuenta de Stripe para habilitar todas las funcionalidades"}
          </p>
        </div>
      </div>

      {connection ? (
        // ─── Connected State ────────────────────────────────────────────────
        <div className="space-y-6">
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-500/10 p-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Stripe Conectado</CardTitle>
                    <CardDescription>Tu cuenta está vinculada y sincronizando datos</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={connection.livemode ? "default" : "secondary"} className="text-sm">
                    {connection.livemode ? "Producción" : "Modo Test"}
                  </Badge>
                  {connection.connection_type === "apikey" && (
                    <Badge variant="outline" className="text-sm gap-1">
                      <Key className="h-3 w-3" /> API Key
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account ID</label>
                  <p className="font-mono text-sm mt-1">{connection.stripe_account_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Conectado desde</label>
                  <p className="text-sm mt-1">
                    {new Date(connection.connected_at).toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Dashboard de Stripe</label>
                  <p className="mt-1">
                    <a
                      href={`https://dashboard.stripe.com/${connection.livemode ? "" : "test/"}dashboard`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Abrir dashboard <ArrowRight className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Synced Data */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Sincronizados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums transition-all">
                  {liveCustomers !== null ? liveCustomers : customerCount}
                  {syncing && liveCustomers !== null && <span className="text-base text-muted-foreground ml-1 animate-pulse">...</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <Button variant="link" className="px-0 h-auto" asChild>
                    <Link href="/ventas">Ver clientes <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Suscripciones Activas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums transition-all">
                  {liveSubs !== null ? liveSubs : subCount}
                  {syncing && liveSubs !== null && <span className="text-base text-muted-foreground ml-1 animate-pulse">...</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <Button variant="link" className="px-0 h-auto" asChild>
                    <Link href="/ventas">Ver suscripciones <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sincronización Manual</CardTitle>
              </CardHeader>
              <CardContent>
                {syncIncomplete && (
                  <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg mb-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>La última sincronización no terminó. Los datos pueden estar incompletos. Intentá de nuevo.</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mb-3">
                  {syncing
                    ? `Sincronizando... ${liveCustomers ?? 0} clientes, ${liveSubs ?? 0} suscripciones`
                    : "Forzá una re-sincronización completa desde Stripe."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Sincronizando...</>
                  ) : (
                    syncIncomplete ? "Reintentar sincronización" : "Re-sincronizar ahora"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Webhook Status */}
          <Card>
            <CardHeader>
              <CardTitle>Sincronización en Tiempo Real</CardTitle>
              <CardDescription>
                {connection.connection_type === "apikey"
                  ? "Conectado vía API Key — los eventos se reciben a través del webhook registrado en tu cuenta."
                  : "Conectado vía OAuth — los eventos se gestionan automáticamente usando Stripe Connect."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {connection.connection_type === "apikey" && !connection.has_webhook_secret ? (
                // ── Webhook secret missing ────────────────────────────────
                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 p-4 rounded-lg">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Webhook no configurado</p>
                      <p className="mt-1 text-amber-600 dark:text-amber-500">
                        No estás recibiendo eventos de Stripe en tiempo real. Configurá el webhook para activar automatizaciones, EFW y disputas.
                      </p>
                    </div>
                  </div>
                  {!showManualSecret ? (
                    <Button
                      size="sm"
                      onClick={() => handleRegisterWebhook()}
                      disabled={registeringWebhook}
                    >
                      {registeringWebhook
                        ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Registrando...</>
                        : "Registrar webhook automáticamente"}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Pegá el <strong>Signing Secret</strong> de tu webhook ({`Stripe → Developers → Webhooks → tu endpoint → Signing secret`}):
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="whsec_..."
                          value={manualSecret}
                          onChange={(e) => setManualSecret(e.target.value)}
                          className="font-mono text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleRegisterWebhook(manualSecret)}
                          disabled={registeringWebhook || !manualSecret.startsWith("whsec_")}
                        >
                          {registeringWebhook ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRegisterWebhook()}>
                        ← Intentar automáticamente de nuevo
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                // ── Webhook active ────────────────────────────────────────
                <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 p-4 rounded-lg">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <p>
                    Nuestra plataforma está recibiendo todos tus eventos de suscripciones, pagos, Early Fraud Warnings y disputas en tiempo real.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-red-600">Zona de Peligro</CardTitle>
              <CardDescription>
                Desconectar Stripe detendrá la sincronización de datos. Los datos ya sincronizados se conservarán.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Desconectar Stripe
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        // ─── Not Connected State ──────────────────────────────────────────
        <div className="space-y-8">
          {/* Hero */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent">
              <CardContent className="flex flex-col items-center text-center py-12 px-6">
                <div className="rounded-2xl bg-primary/10 p-4 mb-6">
                  <CreditCard className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Vincula tu cuenta de Stripe</h2>
                <p className="text-muted-foreground max-w-lg mb-8">
                  Al conectar Stripe podés visualizar dashboards de suscripciones, gestionar disputas, Early Fraud Warnings y automatizar acciones. Todo sincronizado en tiempo real.
                </p>

                {/* Connection Method Selector */}
                {connectMethod === null && (
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                    <Button size="lg" className="flex-1" asChild>
                      <Link href="/api/stripe/connect">
                        <LinkIcon className="mr-2 h-5 w-5" />
                        Conectar con OAuth
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="flex-1" onClick={() => setConnectMethod("apikey")}>
                      <Key className="mr-2 h-5 w-5" />
                      Conectar con API Key
                    </Button>
                  </div>
                )}

                {/* API Key Form */}
                {connectMethod === "apikey" && (
                  <div className="w-full max-w-md space-y-4 text-left">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold">Restricted API Key de Stripe</label>
                      <p className="text-xs text-muted-foreground">
                        En tu dashboard de Stripe → Developers → API keys → Create restricted key. Habilitá permisos de <strong>Read</strong> en Customers, Subscriptions, Invoices, Disputes y <strong>Write</strong> en Webhook Endpoints.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="sk_live_... o rk_live_..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleApiKeyConnect()}
                        className="font-mono text-xs"
                        autoFocus
                      />
                      <Button onClick={handleApiKeyConnect} disabled={connectingApiKey || !apiKey.trim()}>
                        {connectingApiKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setConnectMethod(null)}>
                      ← Volver
                    </Button>
                  </div>
                )}

                {/* OAuth description */}
                {connectMethod === null && (
                  <p className="text-xs text-muted-foreground mt-4">
                    OAuth: 1 clic, sin copiar keys — API Key: ideal si preferís control total sobre los permisos.
                  </p>
                )}
              </CardContent>
            </div>
          </Card>

          {/* Features Grid */}
          <div>
            <h3 className="text-lg font-semibold mb-4">¿Qué podrás hacer con Stripe conectado?</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-base">{feature.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* How it works */}
          <Card>
            <CardHeader><CardTitle>¿Cómo funciona?</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  { n: 1, title: "Elegí cómo conectar", desc: "OAuth (1 clic) o API Key restringida si preferís control total sobre los permisos." },
                  { n: 2, title: "Sincronización inicial", desc: "Importamos tus clientes y suscripciones actuales automáticamente." },
                  { n: 3, title: "Eventos en tiempo real", desc: "El webhook registrado automáticamente dispara acciones en cuanto ocurre algo en Stripe." },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{n}</div>
                    <div>
                      <h4 className="font-medium">{title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
