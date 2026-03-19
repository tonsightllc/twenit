import { getUserOrg } from "@/lib/supabase/get-user-org";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeadphonesIcon, BookOpen, Bot, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";

export default async function SoportePage() {
  const { supabase, user, orgId } = await getUserOrg();
  if (!user || !orgId) return null;

  // Get recent tickets
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Get counts
  const { count: openTickets } = await supabase
    .from("support_tickets")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["open", "in_progress"]);

  const { count: wikiArticles } = await supabase
    .from("wiki_articles")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const { count: botConfigs } = await supabase
    .from("bot_configs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de Soporte</h1>
          <p className="text-muted-foreground">
            Gestiona tickets, wiki y bots de soporte
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Ticket
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Abiertos</CardTitle>
            <HeadphonesIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTickets || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Artículos Wiki</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wikiArticles || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bots Activos</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{botConfigs || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respuestas NPS</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href="/soporte/wiki">
            <CardHeader>
              <BookOpen className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Wiki de Soporte</CardTitle>
              <CardDescription>
                Crea y gestiona artículos de ayuda para tus clientes
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href="/soporte/bot">
            <CardHeader>
              <Bot className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Bot Builder</CardTitle>
              <CardDescription>
                Configura bots con árboles de decisión para automatizar respuestas
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary transition-colors cursor-pointer">
          <Link href="/soporte/estadisticas">
            <CardHeader>
              <HeadphonesIcon className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Estadísticas</CardTitle>
              <CardDescription>
                Analiza los flujos más usados y el rendimiento del soporte
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets Recientes</CardTitle>
          <CardDescription>Los últimos tickets de soporte</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets && tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{ticket.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      Fuente: {ticket.source} | {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      ticket.status === "open"
                        ? "default"
                        : ticket.status === "resolved"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {ticket.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No hay tickets todavía
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
