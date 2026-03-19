"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
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
  Bot,
  Plus,
  Trash2,
  Edit,
  MessageSquare,
  HelpCircle,
  Webhook,
  CreditCard,
  Loader2,
  Code,
} from "lucide-react";

interface BotNode {
  id: string;
  type: "message" | "question" | "api_call" | "stripe_action" | "end";
  content?: string;
  options?: { id: string; label: string; next: string }[];
  api_config?: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  stripe_action?: {
    type: "cancel_subscription" | "pause_subscription" | "refund";
    params?: Record<string, unknown>;
  };
  next?: string;
}

interface BotConfig {
  id: string;
  name: string;
  tree_config: { nodes: Record<string, BotNode>; startNode: string };
  styles: {
    primary_color: string;
    secondary_color: string;
    text_color: string;
    background_color: string;
    logo_url?: string;
    position: "bottom-right" | "bottom-left";
    welcome_message: string;
  };
  enabled: boolean;
}

const defaultBotTemplates = [
  {
    name: "Cancelación",
    description: "Flujo para manejar cancelaciones de suscripción",
    tree_config: {
      startNode: "welcome",
      nodes: {
        welcome: {
          id: "welcome",
          type: "message" as const,
          content: "¡Hola! Lamento que estés considerando cancelar. ¿Puedo ayudarte con algo?",
          next: "reason",
        },
        reason: {
          id: "reason",
          type: "question" as const,
          content: "¿Cuál es el motivo de tu cancelación?",
          options: [
            { id: "price", label: "Muy caro", next: "offer_discount" },
            { id: "no_use", label: "No lo uso suficiente", next: "offer_pause" },
            { id: "other", label: "Otro motivo", next: "confirm_cancel" },
          ],
        },
        offer_discount: {
          id: "offer_discount",
          type: "question" as const,
          content: "¿Te interesaría un 20% de descuento por los próximos 3 meses?",
          options: [
            { id: "yes", label: "Sí, me interesa", next: "apply_discount" },
            { id: "no", label: "No, quiero cancelar", next: "confirm_cancel" },
          ],
        },
        offer_pause: {
          id: "offer_pause",
          type: "question" as const,
          content: "¿Preferirías pausar tu suscripción por un tiempo?",
          options: [
            { id: "yes", label: "Sí, pausar", next: "pause_subscription" },
            { id: "no", label: "No, cancelar", next: "confirm_cancel" },
          ],
        },
        apply_discount: {
          id: "apply_discount",
          type: "stripe_action" as const,
          content: "Aplicando descuento...",
          stripe_action: { type: "pause_subscription" as const },
          next: "discount_applied",
        },
        discount_applied: {
          id: "discount_applied",
          type: "message" as const,
          content: "¡Listo! Te aplicamos un 20% de descuento. Gracias por quedarte con nosotros.",
          next: "end",
        },
        pause_subscription: {
          id: "pause_subscription",
          type: "stripe_action" as const,
          content: "Pausando suscripción...",
          stripe_action: { type: "pause_subscription" as const },
          next: "paused",
        },
        paused: {
          id: "paused",
          type: "message" as const,
          content: "Tu suscripción ha sido pausada. Puedes reactivarla cuando quieras.",
          next: "end",
        },
        confirm_cancel: {
          id: "confirm_cancel",
          type: "question" as const,
          content: "¿Estás seguro de que querés cancelar?",
          options: [
            { id: "yes", label: "Sí, cancelar", next: "cancel_subscription" },
            { id: "no", label: "No, volver atrás", next: "welcome" },
          ],
        },
        cancel_subscription: {
          id: "cancel_subscription",
          type: "stripe_action" as const,
          content: "Cancelando suscripción...",
          stripe_action: { type: "cancel_subscription" as const },
          next: "cancelled",
        },
        cancelled: {
          id: "cancelled",
          type: "message" as const,
          content: "Tu suscripción ha sido cancelada. Esperamos verte pronto.",
          next: "end",
        },
        end: {
          id: "end",
          type: "end" as const,
          content: "¿Hay algo más en lo que pueda ayudarte?",
        },
      },
    },
  },
  {
    name: "Soporte General",
    description: "Flujo básico para consultas de soporte",
    tree_config: {
      startNode: "welcome",
      nodes: {
        welcome: {
          id: "welcome",
          type: "message" as const,
          content: "¡Hola! Soy el asistente de soporte. ¿En qué puedo ayudarte?",
          next: "main_menu",
        },
        main_menu: {
          id: "main_menu",
          type: "question" as const,
          content: "Selecciona una opción:",
          options: [
            { id: "billing", label: "Facturación", next: "billing" },
            { id: "technical", label: "Soporte técnico", next: "technical" },
            { id: "other", label: "Otro", next: "contact_human" },
          ],
        },
        billing: {
          id: "billing",
          type: "message" as const,
          content: "Para consultas de facturación, puedes revisar tu historial de pagos en tu cuenta o contactarnos por email.",
          next: "end",
        },
        technical: {
          id: "technical",
          type: "message" as const,
          content: "Para soporte técnico, te recomendamos revisar nuestra wiki de ayuda. Si el problema persiste, crea un ticket.",
          next: "end",
        },
        contact_human: {
          id: "contact_human",
          type: "message" as const,
          content: "Un agente te contactará pronto. Por favor, deja tu email para que podamos comunicarnos contigo.",
          next: "end",
        },
        end: {
          id: "end",
          type: "end" as const,
          content: "¿Hay algo más en lo que pueda ayudarte?",
        },
      },
    },
  },
];

export default function BotPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    welcome_message: "¡Hola! ¿En qué puedo ayudarte?",
    primary_color: "#0070f3",
    position: "bottom-right" as "bottom-right" | "bottom-left",
    template: "",
  });

  const supabase = createClient();

  const loadBots = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("bot_configs")
      .select("*")
      .eq("org_id", orgId);

    if (error) {
      console.error(error);
      toast.error("Error al cargar bots");
    } else {
      setBots(data || []);
    }
    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  async function handleCreateBot() {
    if (!orgId) return;

    const template = defaultBotTemplates.find((t) => t.name === formData.template);
    const tree_config = template?.tree_config || {
      startNode: "welcome",
      nodes: {
        welcome: {
          id: "welcome",
          type: "message" as const,
          content: formData.welcome_message,
          next: "end",
        },
        end: {
          id: "end",
          type: "end" as const,
          content: "¿Hay algo más en lo que pueda ayudarte?",
        },
      },
    };

    const { error } = await supabase.from("bot_configs").insert({
      org_id: orgId,
      name: formData.name,
      tree_config,
      styles: {
        primary_color: formData.primary_color,
        secondary_color: "#ffffff",
        text_color: "#1a1a1a",
        background_color: "#ffffff",
        position: formData.position,
        welcome_message: formData.welcome_message,
      },
      enabled: true,
    });

    if (error) {
      toast.error("Error al crear bot");
      return;
    }

    toast.success("Bot creado correctamente");
    setIsDialogOpen(false);
    setFormData({
      name: "",
      welcome_message: "¡Hola! ¿En qué puedo ayudarte?",
      primary_color: "#0070f3",
      position: "bottom-right",
      template: "",
    });
    loadBots();
  }

  async function toggleBotEnabled(bot: BotConfig) {
    const { error } = await supabase
      .from("bot_configs")
      .update({ enabled: !bot.enabled })
      .eq("id", bot.id);

    if (error) {
      toast.error("Error al actualizar bot");
      return;
    }

    loadBots();
  }

  async function handleDeleteBot(id: string) {
    if (!confirm("¿Estás seguro de eliminar este bot?")) return;

    const { error } = await supabase.from("bot_configs").delete().eq("id", id);

    if (error) {
      toast.error("Error al eliminar bot");
      return;
    }

    toast.success("Bot eliminado");
    loadBots();
  }

  function copyEmbedCode(bot: BotConfig) {
    const code = `<script src="${process.env.NEXT_PUBLIC_APP_URL || "https://tu-dominio.com"}/embed/${orgId}/bot.js" data-bot-id="${bot.id}"></script>`;
    navigator.clipboard.writeText(code);
    toast.success("Código copiado al portapapeles");
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Bot Builder</h1>
          <p className="text-muted-foreground">
            Crea bots con árboles de decisión para automatizar el soporte
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Bot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Bot</DialogTitle>
              <DialogDescription>
                Configura tu bot de soporte
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Bot</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Bot de Cancelación"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template">Template Base</Label>
                <Select
                  value={formData.template}
                  onValueChange={(value) =>
                    setFormData({ ...formData, template: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empty">Vacío</SelectItem>
                    {defaultBotTemplates.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcome">Mensaje de Bienvenida</Label>
                <Input
                  id="welcome"
                  value={formData.welcome_message}
                  onChange={(e) =>
                    setFormData({ ...formData, welcome_message: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color Principal</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData({ ...formData, primary_color: e.target.value })
                    }
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData({ ...formData, primary_color: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Posición</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value: "bottom-right" | "bottom-left") =>
                    setFormData({ ...formData, position: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Abajo Derecha</SelectItem>
                    <SelectItem value="bottom-left">Abajo Izquierda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateBot}>Crear Bot</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates Disponibles</CardTitle>
          <CardDescription>
            Usa estos templates pre-armados como base para tus bots
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {defaultBotTemplates.map((template) => (
              <div
                key={template.name}
                className="border rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <h4 className="font-medium">{template.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {template.description}
                </p>
                <Badge variant="outline">
                  {Object.keys(template.tree_config.nodes).length} nodos
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bot List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Tus Bots</h2>
        {bots.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bots.map((bot) => (
              <Card key={bot.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Bot
                      className="h-8 w-8"
                      style={{ color: bot.styles?.primary_color }}
                    />
                    <Badge variant={bot.enabled ? "default" : "secondary"}>
                      {bot.enabled ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <CardTitle>{bot.name}</CardTitle>
                  <CardDescription>
                    {Object.keys(bot.tree_config?.nodes || {}).length} nodos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/soporte/bot/${bot.id}`)}
                    >
                      <Edit className="mr-2 h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleBotEnabled(bot)}
                    >
                      {bot.enabled ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => copyEmbedCode(bot)}
                    >
                      <Code className="mr-2 h-3 w-3" />
                      Código
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500"
                      onClick={() => handleDeleteBot(bot.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay bots</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Crea tu primer bot para automatizar el soporte a tus clientes
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Primer Bot
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Node Types Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Nodos</CardTitle>
          <CardDescription>
            Los bots se construyen con estos tipos de nodos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Mensaje</h4>
                <p className="text-sm text-muted-foreground">
                  Muestra un mensaje al usuario
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Pregunta</h4>
                <p className="text-sm text-muted-foreground">
                  Muestra opciones para elegir
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Webhook className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <h4 className="font-medium">API Call</h4>
                <p className="text-sm text-muted-foreground">
                  Llama a un endpoint externo
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Acción Stripe</h4>
                <p className="text-sm text-muted-foreground">
                  Cancelar, pausar o refund
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
