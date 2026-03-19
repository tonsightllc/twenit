import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Building2, Users, Link as LinkIcon, CheckCircle } from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const serviceClient = await createServiceClient();
  const { data: userProfile } = await serviceClient
    .from("users")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  if (!userProfile?.org_id) return null;

  // Get Stripe connection
  const { data: stripeConnection } = await supabase
    .from("stripe_connections")
    .select("*")
    .eq("org_id", userProfile.org_id)
    .single();

  // Get team members
  const { data: teamMembers } = await serviceClient
    .from("users")
    .select("*")
    .eq("org_id", userProfile.org_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra tu organización y conexiones
        </p>
      </div>

      <div className="grid gap-6">
        {/* Organization Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Organización</CardTitle>
            </div>
            <CardDescription>
              Información de tu organización
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <p className="text-muted-foreground">
                  {userProfile.organizations?.name || "Sin nombre"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Slug</label>
                <p className="text-muted-foreground">
                  {userProfile.organizations?.slug || "Sin slug"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Connection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle>Conexión con Stripe</CardTitle>
              </div>
              {stripeConnection ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="secondary">No conectado</Badge>
              )}
            </div>
            <CardDescription>
              Conecta tu cuenta de Stripe para sincronizar datos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stripeConnection ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Account ID</label>
                    <p className="text-muted-foreground font-mono text-sm">
                      {stripeConnection.stripe_account_id}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Modo</label>
                    <p className="text-muted-foreground">
                      {stripeConnection.livemode ? "Producción" : "Test"}
                    </p>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/settings/stripe">
                    Administrar conexión
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Conecta tu cuenta de Stripe para empezar a sincronizar clientes,
                  suscripciones y eventos.
                </p>
                <Button asChild>
                  <Link href="/settings/stripe">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Conectar con Stripe
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Equipo</CardTitle>
              </div>
              <Button variant="outline" size="sm">
                Invitar Miembro
              </Button>
            </div>
            <CardDescription>
              Miembros de tu organización
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{member.full_name || member.email}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Webhooks de Stripe</CardTitle>
            <CardDescription>
              Configura los webhooks para recibir eventos de Stripe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">URL del Webhook</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 p-2 bg-muted rounded text-sm">
                  {process.env.NEXT_PUBLIC_APP_URL || "https://tu-dominio.com"}/api/webhooks/stripe
                </code>
                <Button variant="outline" size="sm">
                  Copiar
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Copia esta URL en tu dashboard de Stripe en Developers → Webhooks
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
