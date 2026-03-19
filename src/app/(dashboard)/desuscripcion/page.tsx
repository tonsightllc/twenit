import { getUserOrg } from "@/lib/supabase/get-user-org";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserMinus, FileText, AlertTriangle, DollarSign, TrendingDown } from "lucide-react";
import Link from "next/link";

export default async function DesuscripcionPage() {
  const { supabase, user, orgId } = await getUserOrg();
  if (!user || !orgId) return null;

  // Get canceled subscriptions
  const { data: canceledSubs } = await supabase
    .from("subscriptions")
    .select(`
      *,
      customers (
        email,
        name
      )
    `)
    .eq("org_id", orgId)
    .eq("status", "canceled")
    .order("canceled_at", { ascending: false })
    .limit(5);

  // Get unsubscription rules
  const { data: rules } = await supabase
    .from("unsubscription_rules")
    .select("*")
    .eq("org_id", orgId)
    .single();

  // Get counts
  const { count: totalCanceled } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "canceled");

  // Get active disputes count (open/in_progress tickets with category "dispute")
  const { count: activeDisputes } = await supabase
    .from("support_tickets")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("category", "dispute")
    .in("status", ["open", "in_progress"]);

  // Calculate refund amount this month from stripe_events
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: refundEvents } = await supabase
    .from("stripe_events")
    .select("payload")
    .eq("org_id", orgId)
    .eq("event_type", "charge.refunded")
    .gte("created_at", monthStart.toISOString());

  const refundAmountThisMonth = (refundEvents || []).reduce((sum, event) => {
    const payload = event.payload as Record<string, unknown>;
    const amountRefunded = (payload.amount_refunded as number) || 0;
    return sum + amountRefunded;
  }, 0);

  // Calculate churn rate: cancellations this month / total active at start
  const { count: canceledThisMonth } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "canceled")
    .gte("canceled_at", monthStart.toISOString());

  const { count: totalActive } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");

  const totalBase = (totalActive || 0) + (canceledThisMonth || 0);
  const churnRate = totalBase > 0 ? ((canceledThisMonth || 0) / totalBase) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Desuscripción</h1>
          <p className="text-muted-foreground">
            Gestiona cancelaciones, refunds y disputas
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/desuscripcion/reglas">
            <FileText className="mr-2 h-4 w-4" />
            Configurar Reglas
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelaciones Totales</CardTitle>
            <UserMinus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCanceled || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refunds Este Mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(refundAmountThisMonth / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disputas Activas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDisputes || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{churnRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {canceledThisMonth || 0} cancelaciones este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary transition-colors">
          <Link href="/desuscripcion/reglas">
            <CardHeader>
              <FileText className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Reglas de Desuscripción</CardTitle>
              <CardDescription>
                Configura cómo manejar las cancelaciones y ofrecer beneficios
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary transition-colors">
          <Link href="/desuscripcion/refunds">
            <CardHeader>
              <DollarSign className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Refunds</CardTitle>
              <CardDescription>
                Gestiona las solicitudes de reembolso y configura reglas automáticas
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary transition-colors">
          <Link href="/desuscripcion/disputas">
            <CardHeader>
              <AlertTriangle className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Disputas</CardTitle>
              <CardDescription>
                Maneja disputas y configura endpoints de evidencia
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

      {/* Current Rules Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Reglas Actuales</CardTitle>
          <CardDescription>Resumen de tu configuración actual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Cancelación</h4>
              <Badge variant={rules?.immediate_cancel ? "default" : "secondary"}>
                {rules?.immediate_cancel ? "Inmediata" : "Con oferta previa"}
              </Badge>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Refunds</h4>
              <Badge variant="secondary">
                {rules?.refund_rules?.auto_refund_below
                  ? `Auto < $${rules.refund_rules.auto_refund_below}`
                  : "Manual"}
              </Badge>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Disputas</h4>
              <Badge variant="secondary">
                {rules?.dispute_rules?.action || "Revisar"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Cancellations */}
      <Card>
        <CardHeader>
          <CardTitle>Cancelaciones Recientes</CardTitle>
          <CardDescription>Últimas suscripciones canceladas</CardDescription>
        </CardHeader>
        <CardContent>
          {canceledSubs && canceledSubs.length > 0 ? (
            <div className="space-y-4">
              {canceledSubs.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {sub.customers?.name || sub.customers?.email || "Cliente"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sub.canceled_at && new Date(sub.canceled_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="destructive">Cancelado</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No hay cancelaciones recientes
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
