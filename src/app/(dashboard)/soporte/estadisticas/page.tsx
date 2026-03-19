"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  MessageSquare,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Bot
} from "lucide-react";

// Mock statistics data
const stats = {
  totalTickets: 156,
  resolvedTickets: 142,
  avgResponseTime: "2.5 horas",
  satisfactionRate: 94,
  topCategories: [
    { name: "Facturación", count: 45, percentage: 29 },
    { name: "Soporte Técnico", count: 38, percentage: 24 },
    { name: "Cancelaciones", count: 32, percentage: 21 },
    { name: "Ventas", count: 25, percentage: 16 },
    { name: "Otros", count: 16, percentage: 10 },
  ],
  botStats: {
    totalConversations: 523,
    completionRate: 78,
    topFlows: [
      { name: "Cancelación", count: 234 },
      { name: "Soporte General", count: 189 },
      { name: "Facturación", count: 100 },
    ],
  },
  npsScores: {
    promoters: 65,
    passives: 22,
    detractors: 13,
    score: 52,
  },
  weeklyTrend: [
    { day: "Lun", tickets: 32 },
    { day: "Mar", tickets: 28 },
    { day: "Mié", tickets: 35 },
    { day: "Jue", tickets: 22 },
    { day: "Vie", tickets: 25 },
    { day: "Sáb", tickets: 8 },
    { day: "Dom", tickets: 6 },
  ],
};

export default function EstadisticasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estadísticas de Soporte</h1>
        <p className="text-muted-foreground">
          Analiza el rendimiento del soporte y los flujos más utilizados
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Totales</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTickets}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">+12%</span> vs mes anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Resolución</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((stats.resolvedTickets / stats.totalTickets) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.resolvedTickets} de {stats.totalTickets} resueltos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo de Respuesta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseTime}</div>
            <p className="text-xs text-muted-foreground">Promedio</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfacción</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.satisfactionRate}%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">+3%</span> vs mes anterior
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets por Categoría</CardTitle>
            <CardDescription>Distribución de tickets por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topCategories.map((category) => (
                <div key={category.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{category.name}</span>
                    <span className="text-muted-foreground">{category.count} tickets</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia Semanal</CardTitle>
            <CardDescription>Tickets por día de la semana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-48 gap-2">
              {stats.weeklyTrend.map((day) => {
                const height = (day.tickets / 40) * 100;
                return (
                  <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-primary rounded-t"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{day.day}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Bot Stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle>Estadísticas del Bot</CardTitle>
            </div>
            <CardDescription>Rendimiento del bot de soporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{stats.botStats.totalConversations}</p>
                <p className="text-sm text-muted-foreground">Conversaciones</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{stats.botStats.completionRate}%</p>
                <p className="text-sm text-muted-foreground">Tasa de Completitud</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Flujos más usados</h4>
              <div className="space-y-2">
                {stats.botStats.topFlows.map((flow, index) => (
                  <div
                    key={flow.name}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{index + 1}</Badge>
                      <span>{flow.name}</span>
                    </div>
                    <span className="text-muted-foreground">{flow.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NPS */}
        <Card>
          <CardHeader>
            <CardTitle>Net Promoter Score (NPS)</CardTitle>
            <CardDescription>Satisfacción general de los clientes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-primary">{stats.npsScores.score}</p>
              <p className="text-muted-foreground">NPS Score</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  <span>Promotores (9-10)</span>
                </div>
                <span className="font-medium">{stats.npsScores.promoters}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${stats.npsScores.promoters}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 text-yellow-500">•</span>
                  <span>Pasivos (7-8)</span>
                </div>
                <span className="font-medium">{stats.npsScores.passives}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${stats.npsScores.passives}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  <span>Detractores (0-6)</span>
                </div>
                <span className="font-medium">{stats.npsScores.detractors}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${stats.npsScores.detractors}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
