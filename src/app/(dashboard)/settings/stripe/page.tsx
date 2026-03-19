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
  const [connection, setConnection] = useState<StripeConnectionData | null>(
    null
  );
  const [customerCount, setCustomerCount] = useState(0);
  const [subCount, setSubCount] = useState(0);
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Handle URL params for success/error messages
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    if (!orgId) {
      setLoading(false);
      return;
    }

    const [
      { data: stripeConnection },
      { count: customers },
      { count: subs },
    ] = await Promise.all([
      supabase
        .from("stripe_connections")
        .select("id, stripe_account_id, livemode, connected_at")
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

    setConnection(stripeConnection);
    setCustomerCount(customers || 0);
    setSubCount(subs || 0);
    setLoading(false);
  }, [supabase, orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDisconnect() {
    if (
      !confirm(
        "¿Estás seguro de desconectar Stripe? Se perderá la sincronización de datos."
      )
    )
      return;

    setDisconnecting(true);
    try {
      const response = await fetch("/api/stripe/disconnect", {
        method: "POST",
      });
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
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Conexión con Stripe
          </h1>
          <p className="text-muted-foreground">
            {connection
              ? "Tu cuenta de Stripe está conectada"
              : "Conecta tu cuenta de Stripe para habilitar todas las funcionalidades"}
          </p>
        </div>
      </div>

      {connection ? (
        // ─── Connected State ──────────────────────────────────────
        <div className="space-y-6">
          {/* Connection Info */}
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-500/10 p-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Stripe Conectado</CardTitle>
                    <CardDescription>
                      Tu cuenta está vinculada y sincronizando datos
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant={connection.livemode ? "default" : "secondary"}
                  className="text-sm"
                >
                  {connection.livemode ? "Producción" : "Modo Test"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Account ID
                  </label>
                  <p className="font-mono text-sm mt-1">
                    {connection.stripe_account_id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Conectado desde
                  </label>
                  <p className="text-sm mt-1">
                    {new Date(connection.connected_at).toLocaleDateString(
                      "es-AR",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Dashboard de Stripe
                  </label>
                  <p className="mt-1">
                    <a
                      href={`https://dashboard.stripe.com/${connection.livemode ? "" : "test/"}dashboard`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Abrir dashboard
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Synced Data Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Clientes Sincronizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{customerCount}</div>
                <Button variant="link" className="px-0 h-auto" asChild>
                  <Link href="/ventas">
                    Ver clientes
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Suscripciones Activas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{subCount}</div>
                <Button variant="link" className="px-0 h-auto" asChild>
                  <Link href="/ventas">
                    Ver suscripciones
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Webhook Config */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Webhooks</CardTitle>
              <CardDescription>
                Para recibir eventos en tiempo real, configura este webhook en tu
                dashboard de Stripe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">URL del Webhook</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-3 bg-muted rounded-lg text-sm font-mono">
                    {typeof window !== "undefined"
                      ? window.location.origin
                      : "https://tu-dominio.com"}
                    /api/webhooks/stripe
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/api/webhooks/stripe`
                      );
                      toast.success("URL copiada");
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Eventos que debes habilitar en Stripe:
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[
                    "customer.created",
                    "customer.updated",
                    "customer.subscription.*",
                    "invoice.paid",
                    "invoice.payment_failed",
                    "charge.dispute.*",
                    "charge.refunded",
                    "radar.early_fraud_warning.created",
                    "checkout.session.completed",
                  ].map((event) => (
                    <Badge key={event} variant="outline" className="font-mono text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disconnect */}
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-red-600">Zona de Peligro</CardTitle>
              <CardDescription>
                Desconectar Stripe detendrá la sincronización de datos. Los datos
                ya sincronizados se conservarán.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Desconectar Stripe
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        // ─── Not Connected State ──────────────────────────────────
        <div className="space-y-8">
          {/* Hero Card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent">
              <CardContent className="flex flex-col items-center text-center py-12 px-6">
                <div className="rounded-2xl bg-primary/10 p-4 mb-6">
                  <CreditCard className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  Vincula tu cuenta de Stripe
                </h2>
                <p className="text-muted-foreground max-w-lg mb-8">
                  Al conectar Stripe vamos a poder mostrarte los dashboards de
                  suscripciones, desuscripciones, disputas, Early Fraud Warning
                  y mucho más. Todo sincronizado en tiempo real.
                </p>
                <Button size="lg" asChild>
                  <Link href="/api/stripe/connect">
                    <LinkIcon className="mr-2 h-5 w-5" />
                    Conectar Stripe
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Usamos OAuth de Stripe Connect. No almacenamos tu contraseña.
                </p>
              </CardContent>
            </div>
          </Card>

          {/* Features Grid */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              ¿Qué podrás hacer con Stripe conectado?
            </h3>
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
                        <CardTitle className="text-base">
                          {feature.title}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* How it Works */}
          <Card>
            <CardHeader>
              <CardTitle>¿Cómo funciona?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">Autoriza la conexión</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Haz click en &quot;Conectar Stripe&quot; y autoriza el acceso desde
                      tu cuenta de Stripe.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">Sincronización inicial</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Importamos tus clientes y suscripciones actuales
                      automáticamente.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">Configura los webhooks</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Agrega nuestra URL de webhook en Stripe para recibir
                      eventos en tiempo real.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
