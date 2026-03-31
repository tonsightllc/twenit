import { getUserOrg } from "@/lib/supabase/get-user-org";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, TrendingUp, Users, CreditCard, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { NewCustomersChart } from "@/components/charts/new-customers-chart";
import { aggregateNewCustomers } from "@/lib/charts/customer-stats";

export default async function VentasPage() {
  const { supabase, user, orgId } = await getUserOrg();
  if (!user || !orgId) return null;

  // Get recent subscriptions with customer id for linking
  const { data: recentSubs } = await supabase
    .from("subscriptions")
    .select(`
      *,
      customers (
        id,
        email,
        name
      )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  // Get all customers for the customer list
  const { data: allCustomers } = await supabase
    .from("customers")
    .select("id, email, name, stripe_customer_id, activation_status, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Get stats
  const { count: totalCustomers } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const { count: activeSubscriptions } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["active", "trialing", "past_due"]);

  // Count customers created today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: newToday } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", todayStart.toISOString());

  // Calculate MRR from invoice events this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: paidEvents } = await supabase
    .from("stripe_events")
    .select("payload")
    .eq("org_id", orgId)
    .eq("event_type", "invoice.paid")
    .gte("created_at", monthStart.toISOString());

  const monthlyRevenue = (paidEvents || []).reduce((sum, event) => {
    const payload = event.payload as Record<string, unknown>;
    const amountPaid = (payload.amount_paid as number) || 0;
    return sum + amountPaid;
  }, 0);

  // Check if Stripe is connected
  const { data: stripeConnection } = await supabase
    .from("stripe_connections")
    .select("id")
    .eq("org_id", orgId)
    .single();

  const isStripeConnected = !!stripeConnection;

  // Get all customer creation dates for the chart
  const { data: customerDates } = await supabase
    .from("customers")
    .select("created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const customerChartData = aggregateNewCustomers(customerDates ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevas Ventas</h1>
          <p className="text-muted-foreground">
            Monitorea las ventas y suscripciones de tu cuenta de Stripe
          </p>
        </div>
        {!isStripeConnected && (
          <Button asChild>
            <Link href="/settings">
              <CreditCard className="mr-2 h-4 w-4" />
              Conectar Stripe
            </Link>
          </Button>
        )}
      </div>

      {!isStripeConnected ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Conecta tu cuenta de Stripe</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Para ver tus ventas y suscripciones, primero necesitas conectar tu cuenta de Stripe.
            </p>
            <Button asChild>
              <Link href="/settings">
                Conectar Stripe
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCustomers || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suscripciones Activas</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeSubscriptions || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos Mes</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${(monthlyRevenue / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">Basado en facturas pagadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nuevos Hoy</CardTitle>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{newToday || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* New Customers Chart */}
          <NewCustomersChart data={customerChartData} />

          {/* Customers List */}
          <Card>
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>
                Haz click en un cliente para ver sus detalles, suscripciones y cobros
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allCustomers && allCustomers.length > 0 ? (
                <div className="space-y-2">
                  {allCustomers.map((customer) => (
                    <Link
                      key={customer.id}
                      href={`/ventas/customer/${customer.id}`}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">
                          {customer.name || customer.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {customer.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={customer.activation_status === "activated" ? "default" : "secondary"}
                        >
                          {customer.activation_status}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No hay clientes todavía. Se sincronizarán automáticamente desde Stripe.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Subscriptions */}
          <Card>
            <CardHeader>
              <CardTitle>Suscripciones Recientes</CardTitle>
              <CardDescription>
                Las últimas suscripciones de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentSubs && recentSubs.length > 0 ? (
                <div className="space-y-4">
                  {recentSubs.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/ventas/customer/${sub.customers?.id || sub.customer_id}`}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 hover:bg-muted/50 rounded p-2 -mx-2 transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">
                          {sub.customers?.name || sub.customers?.email || "Cliente"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sub.stripe_subscription_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={sub.status === "active" ? "default" : "secondary"}
                        >
                          {sub.status}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No hay suscripciones todavía. Se sincronizarán automáticamente desde Stripe.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
