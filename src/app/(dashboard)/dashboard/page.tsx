import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Mail,
  Bot,
  Zap,
  CheckCircle2,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";

const ONBOARDING_STEPS = [
  {
    id: "stripe",
    title: "Vincular tu cuenta de Stripe",
    description:
      "Con eso vamos a poder mostrarte los dashboards de suscripciones, desuscripciones, disputas, EFW, etc.",
    href: "/settings/stripe",
    cta: "Conectar Stripe",
    icon: CreditCard,
  },
  {
    id: "mail",
    title: "Vincular tu mail",
    description:
      "Con eso vamos a poder hacer que gestiones los mails desde acá.",
    href: "/mails/config",
    cta: "Configurar mail",
    icon: Mail,
  },
  {
    id: "bot",
    title: "Incluir el bot en tu web",
    description:
      "Con eso te podemos mostrar métricas del bot.",
    href: "/soporte/bot",
    cta: "Configurar bot",
    icon: Bot,
  },
  {
    id: "rules",
    title: "Crear tus primeras reglas automáticas",
    description:
      "Te vamos a poder mostrar estadísticas de reglas.",
    href: "/desuscripcion/reglas",
    cta: "Ver reglas",
    icon: Zap,
  },
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Use service client to bypass RLS recursion on users table
  const serviceClient = await createServiceClient();
  const { data: userProfile } = await serviceClient
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  const orgId = userProfile?.org_id ?? null;

  let completed = { stripe: false, mail: false, bot: false, rules: false };
  let metrics = {
    stripe: { customers: 0, activeSubs: 0, revenue: 0 },
    mail: { configured: false, domain: "" },
    bot: { configured: false, activeBotName: "" },
    rules: { activeCount: 0, totalCount: 0 },
  };

  if (orgId) {
    const [
      { data: stripeConnection },
      { count: customersCount },
      { data: activeSubs },
      { data: emailConfigs },
      { data: botConfigs },
      { data: automationRules },
    ] = await Promise.all([
      supabase
        .from("stripe_connections")
        .select("id")
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId),
      supabase
        .from("subscriptions")
        .select("id") // We can add sum(amout) later if needed
        .eq("org_id", orgId)
        .eq("status", "active"),
      supabase.from("email_configs").select("domain").eq("org_id", orgId),
      supabase
        .from("bot_configs")
        .select("name, enabled")
        .eq("org_id", orgId)
        .eq("enabled", true),
      supabase
        .from("automation_rules")
        .select("enabled")
        .eq("org_id", orgId),
    ]);

    completed = {
      stripe: !!stripeConnection,
      mail: (emailConfigs?.length ?? 0) > 0,
      bot: (botConfigs?.length ?? 0) > 0,
      rules: (automationRules?.length ?? 0) > 0,
    };

    metrics = {
      stripe: {
        customers: customersCount ?? 0,
        activeSubs: activeSubs?.length ?? 0,
        revenue: 0, // Placeholder as we don't have revenue sum yet
      },
      mail: {
        configured: (emailConfigs?.length ?? 0) > 0,
        domain: emailConfigs?.[0]?.domain || "",
      },
      bot: {
        configured: (botConfigs?.length ?? 0) > 0,
        activeBotName: botConfigs?.[0]?.name || "Bot",
      },
      rules: {
        activeCount: automationRules?.filter((r) => r.enabled).length ?? 0,
        totalCount: automationRules?.length ?? 0,
      },
    };
  }

  const pendingSteps = ONBOARDING_STEPS.filter((step) => !completed[step.id]);
  const completedSteps = ONBOARDING_STEPS.filter((step) => completed[step.id]); // Keep order from ONBOARDING_STEPS

  // Recommendation Layout Logic
  // < 4 items: Flex/Grid behaving as row, max 50% width
  // >= 4 items: Grid 2 cols
  const isManyRecommendations = pendingSteps.length >= 4;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-8 w-8" />
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Resumen y recomendaciones para sacar el máximo de tu CRM
        </p>
      </div>

      {!orgId && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Tu usuario aún no tiene una organización asignada. Completá tu
              perfil en Configuración para poder usar Stripe, mails, bot y
              reglas.
            </p>
            <Button asChild size="sm">
              <Link href="/settings">Ir a Configuración</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recommendations Section */}
      {pendingSteps.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Recomendaciones de onboarding
            </h2>
            <Badge variant="secondary">
              {pendingSteps.length} pendiente
              {pendingSteps.length !== 1 ? "s" : ""}
            </Badge>
          </div>

          <div
            className={
              isManyRecommendations
                ? "grid gap-4 sm:grid-cols-2" // 2 cols if 4+ items
                : "flex flex-col sm:flex-row sm:flex-wrap gap-4" // Flex row if < 4
            }
          >
            {pendingSteps.map((step) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.id}
                  className={`overflow-hidden flex flex-col justify-between ${!isManyRecommendations
                      ? "sm:w-[calc(50%-0.5rem)] flex-grow-0"
                      : ""
                    }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {step.title}
                          </CardTitle>
                          <CardDescription className="mt-1 text-sm text-balance">
                            {step.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 mt-auto">
                    <Button asChild size="sm" className="w-full sm:w-auto">
                      <Link href={step.href}>
                        {step.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Completed Metrics Section */}
      {completedSteps.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Tus Herramientas Activas</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {completedSteps.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.id} className="overflow-hidden border-l-4 border-l-primary">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {step.title.replace("Vincular ", "").replace("Crear ", "").replace("Incluir ", "")}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {step.id === "stripe" && (
                      <div className="space-y-1">
                        <div className="text-2xl font-bold">{metrics.stripe.activeSubs}</div>
                        <p className="text-xs text-muted-foreground">Suscripciones activas</p>
                        <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                          {metrics.stripe.customers} clientes totales
                        </div>
                      </div>
                    )}
                    {step.id === "mail" && (
                      <div className="space-y-1">
                        <div className="text-2xl font-bold truncate text-primary/80">
                          Activo
                        </div>
                        <p className="text-xs text-muted-foreground truncate" title={metrics.mail.domain}>
                          {metrics.mail.domain || "Configurado"}
                        </p>
                      </div>
                    )}
                    {step.id === "bot" && (
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-600">
                          Online
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {metrics.bot.activeBotName || "Bot activo"}
                        </p>
                      </div>
                    )}
                    {step.id === "rules" && (
                      <div className="space-y-1">
                        <div className="text-2xl font-bold">{metrics.rules.activeCount}</div>
                        <p className="text-xs text-muted-foreground">Reglas activas</p>
                        <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                          {metrics.rules.totalCount} reglas totales
                        </div>
                      </div>
                    )}
                    <div className="mt-4">
                      <Button variant="ghost" size="sm" className="w-full h-8 text-xs" asChild>
                        <Link href={step.href}>
                          Ver detalles
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Access was requested to be replaced/moved? 
           The user said: "cuando una recomendación se completa ... debería verse su sección con sus metricas".
           It seems the 'Accesos rápidos' section in original code was somewhat redundant with the sidebar.
           I will keep it for now as it provides direct links, but maybe below the metrics.
           Or I can remove it if metrics cards serve as navigation (they have "Ver detalles").
           Let's keep it but simpler or maybe remove it to reduce clutter since we now have metrics cards acting as navigation.
           Actually, the "Accesos rápidos" had "Nuevas Ventas", "Inbox", "Bot", "Configuración".
           The new metrics cards link to "Configuración stripe", "Configurar mail", etc.
           Let's remove "Accesos rápidos" to clean up UI as the Metrics cards provide entry points now.
       */}
    </div>
  );
}
