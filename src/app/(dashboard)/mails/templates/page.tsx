"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Mail, Plus, Edit, Eye, Copy } from "lucide-react";

const defaultTemplates = [
  {
    id: "new_sale",
    name: "Nueva Venta",
    description: "Email enviado cuando se completa una compra",
    type: "new_sale",
    enabled: true,
  },
  {
    id: "new_subscription",
    name: "Nueva Suscripción",
    description: "Email enviado cuando se crea una suscripción",
    type: "new_subscription",
    enabled: true,
  },
  {
    id: "activation_reminder",
    name: "Recordatorio de Activación",
    description: "Email para clientes que no han activado su cuenta",
    type: "activation_reminder",
    enabled: false,
  },
  {
    id: "unsubscribe_confirmation",
    name: "Confirmación de Cancelación",
    description: "Email cuando un cliente cancela su suscripción",
    type: "unsubscribe_confirmation",
    enabled: true,
  },
  {
    id: "refund_confirmation",
    name: "Confirmación de Reembolso",
    description: "Email cuando se procesa un reembolso",
    type: "refund_confirmation",
    enabled: true,
  },
];

export default function TemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates de Email</h1>
          <p className="text-muted-foreground">
            Personaliza los emails automáticos que se envían a tus clientes
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Template
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="activacion">Activación</TabsTrigger>
          <TabsTrigger value="cancelacion">Cancelación</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {defaultTemplates.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-colors hover:border-primary ${
                  selectedTemplate === template.id ? "border-primary" : ""
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Mail className="h-8 w-8 text-primary" />
                    <Badge variant={template.enabled ? "default" : "secondary"}>
                      {template.enabled ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit className="mr-2 h-3 w-3" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm">
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ventas" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {defaultTemplates
              .filter((t) => t.type === "new_sale" || t.type === "new_subscription")
              .map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Mail className="h-8 w-8 text-primary" />
                      <Badge variant={template.enabled ? "default" : "secondary"}>
                        {template.enabled ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="activacion" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {defaultTemplates
              .filter((t) => t.type === "activation_reminder")
              .map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Mail className="h-8 w-8 text-primary" />
                      <Badge variant={template.enabled ? "default" : "secondary"}>
                        {template.enabled ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="cancelacion" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {defaultTemplates
              .filter((t) => t.type === "unsubscribe_confirmation" || t.type === "refund_confirmation")
              .map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Mail className="h-8 w-8 text-primary" />
                      <Badge variant={template.enabled ? "default" : "secondary"}>
                        {template.enabled ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Variables Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Variables Disponibles</CardTitle>
          <CardDescription>
            Usa estas variables en tus templates para personalizar los emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><code className="bg-muted px-1 rounded">{"{{customerName}}"}</code> - Nombre</p>
                <p><code className="bg-muted px-1 rounded">{"{{customerEmail}}"}</code> - Email</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Producto</Label>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><code className="bg-muted px-1 rounded">{"{{productName}}"}</code> - Nombre</p>
                <p><code className="bg-muted px-1 rounded">{"{{amount}}"}</code> - Precio</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Links</Label>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><code className="bg-muted px-1 rounded">{"{{unsubscribeUrl}}"}</code> - Cancelar</p>
                <p><code className="bg-muted px-1 rounded">{"{{refundUrl}}"}</code> - Reembolso</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
