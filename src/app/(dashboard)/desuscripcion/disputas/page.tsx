"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/components/providers/org-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  Link as LinkIcon,
  Shield,
  FileText,
  CreditCard,
  MessageSquare,
  Clock
} from "lucide-react";

interface DisputeEndpoint {
  id: string;
  evidence_type: string;
  endpoint_url: string;
  auth_config: {
    type: "none" | "api_key" | "bearer" | "basic";
    credentials?: Record<string, string>;
  };
  enabled: boolean;
}

const evidenceTypes = [
  {
    id: "customer_communication",
    name: "Comunicación con Cliente",
    description: "Historial de comunicación con el cliente",
    icon: MessageSquare,
  },
  {
    id: "refund_policy",
    name: "Política de Reembolso",
    description: "URL o contenido de tu política de reembolso",
    icon: FileText,
  },
  {
    id: "receipt",
    name: "Recibo",
    description: "Recibo o comprobante de la transacción",
    icon: CreditCard,
  },
  {
    id: "access_activity_log",
    name: "Log de Actividad",
    description: "Registro de actividad del cliente en tu plataforma",
    icon: Clock,
  },
  {
    id: "service_documentation",
    name: "Documentación del Servicio",
    description: "Documentación de que el servicio fue prestado",
    icon: FileText,
  },
  {
    id: "duplicate_charge_documentation",
    name: "Documentación de Cargo Duplicado",
    description: "Evidencia de que no hubo cargo duplicado",
    icon: Shield,
  },
];

export default function DisputasPage() {
  const { orgId } = useOrg();
  const [endpoints, setEndpoints] = useState<DisputeEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<DisputeEndpoint | null>(null);
  const [formData, setFormData] = useState({
    evidence_type: "",
    endpoint_url: "",
    auth_type: "none" as "none" | "api_key" | "bearer" | "basic",
    api_key: "",
    bearer_token: "",
    basic_user: "",
    basic_pass: "",
  });

  const supabase = createClient();

  const loadEndpoints = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("dispute_evidence_endpoints")
      .select("*")
      .eq("org_id", orgId);

    if (error) {
      console.error(error);
    } else {
      setEndpoints(data || []);
    }
    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    loadEndpoints();
  }, [loadEndpoints]);

  async function handleSave() {
    if (!orgId) return;

    const auth_config: DisputeEndpoint["auth_config"] = { type: formData.auth_type };
    
    if (formData.auth_type === "api_key") {
      auth_config.credentials = { api_key: formData.api_key };
    } else if (formData.auth_type === "bearer") {
      auth_config.credentials = { token: formData.bearer_token };
    } else if (formData.auth_type === "basic") {
      auth_config.credentials = { username: formData.basic_user, password: formData.basic_pass };
    }

    if (editingEndpoint) {
      const { error } = await supabase
        .from("dispute_evidence_endpoints")
        .update({
          evidence_type: formData.evidence_type,
          endpoint_url: formData.endpoint_url,
          auth_config,
        })
        .eq("id", editingEndpoint.id);

      if (error) {
        toast.error("Error al actualizar endpoint");
        return;
      }
      toast.success("Endpoint actualizado");
    } else {
      const { error } = await supabase.from("dispute_evidence_endpoints").insert({
        org_id: orgId,
        evidence_type: formData.evidence_type,
        endpoint_url: formData.endpoint_url,
        auth_config,
        enabled: true,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya existe un endpoint para este tipo de evidencia");
        } else {
          toast.error("Error al crear endpoint");
        }
        return;
      }
      toast.success("Endpoint creado");
    }

    setIsDialogOpen(false);
    resetForm();
    loadEndpoints();
  }

  function resetForm() {
    setEditingEndpoint(null);
    setFormData({
      evidence_type: "",
      endpoint_url: "",
      auth_type: "none",
      api_key: "",
      bearer_token: "",
      basic_user: "",
      basic_pass: "",
    });
  }

  function openEditDialog(endpoint: DisputeEndpoint) {
    setEditingEndpoint(endpoint);
    setFormData({
      evidence_type: endpoint.evidence_type,
      endpoint_url: endpoint.endpoint_url,
      auth_type: endpoint.auth_config.type,
      api_key: endpoint.auth_config.credentials?.api_key || "",
      bearer_token: endpoint.auth_config.credentials?.token || "",
      basic_user: endpoint.auth_config.credentials?.username || "",
      basic_pass: endpoint.auth_config.credentials?.password || "",
    });
    setIsDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar este endpoint?")) return;

    const { error } = await supabase.from("dispute_evidence_endpoints").delete().eq("id", id);

    if (error) {
      toast.error("Error al eliminar endpoint");
      return;
    }

    toast.success("Endpoint eliminado");
    loadEndpoints();
  }

  async function toggleEnabled(endpoint: DisputeEndpoint) {
    const { error } = await supabase
      .from("dispute_evidence_endpoints")
      .update({ enabled: !endpoint.enabled })
      .eq("id", endpoint.id);

    if (error) {
      toast.error("Error al actualizar endpoint");
      return;
    }

    loadEndpoints();
  }

  const configuredTypes = endpoints.map((e) => e.evidence_type);
  const availableTypes = evidenceTypes.filter((t) => !configuredTypes.includes(t.id) || editingEndpoint?.evidence_type === t.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Disputas</h1>
          <p className="text-muted-foreground">
            Configura endpoints para obtener evidencia automáticamente
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEndpoint ? "Editar Endpoint" : "Nuevo Endpoint de Evidencia"}
              </DialogTitle>
              <DialogDescription>
                Configura dónde obtener la evidencia para disputas
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Evidencia</Label>
                <Select
                  value={formData.evidence_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, evidence_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>URL del Endpoint</Label>
                <Input
                  value={formData.endpoint_url}
                  onChange={(e) =>
                    setFormData({ ...formData, endpoint_url: e.target.value })
                  }
                  placeholder="https://api.tuempresa.com/evidence/{customerId}"
                />
                <p className="text-xs text-muted-foreground">
                  Usa {"{customerId}"} o {"{chargeId}"} como placeholders
                </p>
              </div>

              <div className="space-y-2">
                <Label>Autenticación</Label>
                <Select
                  value={formData.auth_type}
                  onValueChange={(value: "none" | "api_key" | "bearer" | "basic") =>
                    setFormData({ ...formData, auth_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin autenticación</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.auth_type === "api_key" && (
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) =>
                      setFormData({ ...formData, api_key: e.target.value })
                    }
                    placeholder="tu-api-key"
                  />
                </div>
              )}

              {formData.auth_type === "bearer" && (
                <div className="space-y-2">
                  <Label>Bearer Token</Label>
                  <Input
                    type="password"
                    value={formData.bearer_token}
                    onChange={(e) =>
                      setFormData({ ...formData, bearer_token: e.target.value })
                    }
                    placeholder="tu-token"
                  />
                </div>
              )}

              {formData.auth_type === "basic" && (
                <>
                  <div className="space-y-2">
                    <Label>Usuario</Label>
                    <Input
                      value={formData.basic_user}
                      onChange={(e) =>
                        setFormData({ ...formData, basic_user: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contraseña</Label>
                    <Input
                      type="password"
                      value={formData.basic_pass}
                      onChange={(e) =>
                        setFormData({ ...formData, basic_pass: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingEndpoint ? "Guardar Cambios" : "Crear Endpoint"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Evidence Types Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {evidenceTypes.map((type) => {
          const endpoint = endpoints.find((e) => e.evidence_type === type.id);
          const Icon = type.icon;

          return (
            <Card key={type.id} className={endpoint ? "" : "border-dashed"}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon className={`h-6 w-6 ${endpoint ? "text-primary" : "text-muted-foreground"}`} />
                  {endpoint && (
                    <Badge variant={endpoint.enabled ? "default" : "secondary"}>
                      {endpoint.enabled ? "Activo" : "Inactivo"}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{type.name}</CardTitle>
                <CardDescription>{type.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {endpoint ? (
                  <div className="space-y-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">URL:</span>
                      <p className="font-mono text-xs truncate">{endpoint.endpoint_url}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditDialog(endpoint)}
                      >
                        <Edit className="mr-2 h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleEnabled(endpoint)}
                      >
                        {endpoint.enabled ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500"
                        onClick={() => handleDelete(endpoint.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setFormData({ ...formData, evidence_type: type.id });
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Configurar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle>¿Cómo Funciona?</CardTitle>
          <CardDescription>
            Cuando recibas una disputa, el sistema obtendrá la evidencia automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">1. Se recibe una disputa</h4>
                <p className="text-sm text-muted-foreground">
                  Stripe envía un webhook cuando un cliente abre una disputa
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <LinkIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">2. Consultamos tus endpoints</h4>
                <p className="text-sm text-muted-foreground">
                  Llamamos a los endpoints configurados para obtener la evidencia
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">3. Respondemos la disputa</h4>
                <p className="text-sm text-muted-foreground">
                  Enviamos la evidencia a Stripe automáticamente según tus reglas
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
