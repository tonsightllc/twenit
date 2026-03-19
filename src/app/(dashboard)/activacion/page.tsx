import { getUserOrg } from "@/lib/supabase/get-user-org";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Settings, CheckCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";

export default async function ActivacionPage() {
  const { supabase, user, orgId } = await getUserOrg();
  if (!user || !orgId) return null;

  // Get customers by activation status
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const pendingCount = customers?.filter(c => c.activation_status === "pending").length || 0;
  const activatedCount = customers?.filter(c => c.activation_status === "activated").length || 0;
  const inactiveCount = customers?.filter(c => c.activation_status === "inactive").length || 0;

  const activationRate = customers && customers.length > 0 
    ? Math.round((activatedCount / customers.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activación</h1>
          <p className="text-muted-foreground">
            Monitorea y mejora la activación de tus clientes
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Configurar Endpoint
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Activación</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activationRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activatedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Customers List */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes por Estado</CardTitle>
          <CardDescription>
            Clientes ordenados por estado de activación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers && customers.length > 0 ? (
            <div className="space-y-4">
              {customers.slice(0, 10).map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{customer.name || customer.email}</p>
                    <p className="text-sm text-muted-foreground">{customer.email}</p>
                  </div>
                  <Badge
                    variant={
                      customer.activation_status === "activated"
                        ? "default"
                        : customer.activation_status === "pending"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {customer.activation_status === "activated" && (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    )}
                    {customer.activation_status === "pending" && (
                      <Clock className="mr-1 h-3 w-3" />
                    )}
                    {customer.activation_status === "inactive" && (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    {customer.activation_status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No hay clientes todavía. Se sincronizarán automáticamente desde Stripe.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Activación</CardTitle>
          <CardDescription>
            Configura cómo verificar si un cliente está activado en tu plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Endpoint de Verificación</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Proporciona un endpoint donde podamos verificar si un cliente está activado.
              Enviaremos el email del cliente y esperamos una respuesta con el estado.
            </p>
            <Button asChild variant="outline">
              <Link href="/settings">Configurar Endpoint</Link>
            </Button>
          </div>
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Emails de Push</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Configura emails automáticos para recordar a los clientes que activen su cuenta.
            </p>
            <Button asChild variant="outline">
              <Link href="/mails/templates">Configurar Templates</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
