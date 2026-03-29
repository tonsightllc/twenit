"use client";

import { useState, useEffect } from "react";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, AlertTriangle, DollarSign, ShieldAlert, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

interface UnsubscriptionRules {
  id?: string;
  org_id?: string;
  immediate_cancel: boolean;
  offer_benefit_first: boolean;
  benefit_type: string | null;
  benefit_config: Record<string, unknown>;
  refund_rules: {
    auto_refund_below: number | null;
    require_approval_above: number | null;
    max_refund_days: number;
  };
  efw_rules: {
    action: string;
    mark_fraudulent: boolean;
  };
  dispute_rules: {
    action: string;
    min_amount_to_dispute: number;
  };
}

export default function ReglasPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [rules, setRules] = useState<UnsubscriptionRules>({
    immediate_cancel: true,
    offer_benefit_first: false,
    benefit_type: null,
    benefit_config: {},
    refund_rules: {
      auto_refund_below: null,
      require_approval_above: null,
      max_refund_days: 30,
    },
    efw_rules: {
      action: "review",
      mark_fraudulent: false,
    },
    dispute_rules: {
      action: "review",
      min_amount_to_dispute: 0,
    },
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadRules() {
      if (!orgId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("unsubscription_rules")
        .select("*")
        .eq("org_id", orgId)
        .single();

      if (data) {
        setRules(data);
      }
      setLoading(false);
    }

    loadRules();
  }, [orgId, supabase]);

  const autoSaveRules = async (rulesToSave: UnsubscriptionRules) => {
    if (!orgId) return;
    setSaveStatus("saving");
    try {
      const { error } = await supabase
        .from("unsubscription_rules")
        .upsert({ ...rulesToSave, org_id: orgId });

      if (error) throw error;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      toast.error("Error al guardar preferencia");
    }
  };

  const handleUpdate = (updater: (prev: UnsubscriptionRules) => UnsubscriptionRules) => {
    setRules((prev) => {
      const next = updater(prev);
      autoSaveRules(next);
      return next;
    });
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Política de Retención y Disputas</h1>
          <p className="text-muted-foreground mt-1">
            Configurá cómo debe reaccionar el sistema ante pedidos de baja y alertas de Stripe.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium mr-4">
          {saveStatus === "saving" && <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Guardando...</span></>}
          {saveStatus === "saved" && <><CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /><span className="text-green-600 dark:text-green-500">Guardado</span></>}
          {saveStatus === "error" && <><XCircle className="h-4 w-4 text-red-600 dark:text-red-500" /><span className="text-red-600 dark:text-red-500">Error</span></>}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="font-semibold mb-1">Estado de las reglas automáticas</p>
          <p>
            Para desactivar cualquier regla y evitar que Twenit tome decisiones por vos en Stripe, simplemente seleccioná la opción <strong>&quot;Revisar manualmente&quot;</strong>. Por defecto, todas las alertas de fraude y disputas están en este modo seguro (inactivo).
          </p>
        </div>
      </div>

      <Tabs defaultValue="cancelacion">
        <TabsList>
          <TabsTrigger value="cancelacion">Cancelación</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="efw">Early Fraud Warning</TabsTrigger>
          <TabsTrigger value="disputas">Disputas</TabsTrigger>
        </TabsList>

        <TabsContent value="cancelacion" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Flujo del
                <Link 
                  href="/desuscripcion" 
                  className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-0.5 rounded-md text-sm transition-colors"
                >
                  Portal de Cancelación <ExternalLink className="h-3 w-3" />
                </Link>
              </CardTitle>
              <CardDescription>
                Define qué pasa cuando un cliente intenta darse de baja mediante el portal de retención de Twenit. Estas reglas se aplican exclusivamente allí.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cancelación Directa</Label>
                  <p className="text-sm text-muted-foreground">
                    Si el cliente pide la baja, cancelar su suscripción en Stripe sin fricción (recomendado). Si lo desactivás, requerirá revisión tuya.
                  </p>
                </div>
                <Switch
                  checked={rules.immediate_cancel}
                  onCheckedChange={(checked) =>
                    handleUpdate((prev) => ({ ...prev, immediate_cancel: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ofrecer Beneficio Antes</Label>
                  <p className="text-sm text-muted-foreground">
                    Mostrar una oferta antes de confirmar la cancelación
                  </p>
                </div>
                <Switch
                  checked={rules.offer_benefit_first}
                  onCheckedChange={(checked) =>
                    handleUpdate((prev) => ({ ...prev, offer_benefit_first: checked }))
                  }
                />
              </div>

              {rules.offer_benefit_first && (
                <div className="space-y-4 pl-4 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>Tipo de Beneficio</Label>
                    <Select
                      value={rules.benefit_type || ""}
                      onValueChange={(value) =>
                        handleUpdate((prev) => ({ ...prev, benefit_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discount">Descuento</SelectItem>
                        <SelectItem value="pause">Pausar suscripción</SelectItem>
                        <SelectItem value="downgrade">Bajar de plan</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {rules.benefit_type === "discount" && (
                    <div className="space-y-2">
                      <Label>Porcentaje de Descuento</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="20"
                        value={(rules.benefit_config.discount_percent as number) || ""}
                        onChange={(e) =>
                          setRules({
                            ...rules,
                            benefit_config: { ...rules.benefit_config, discount_percent: parseInt(e.target.value) || 0 },
                          })
                        }
                        onBlur={() => autoSaveRules(rules)}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refunds" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <CardTitle>Reglas de Refund</CardTitle>
              </div>
              <CardDescription>
                Configura cuándo procesar devoluciones automáticamente. <strong className="text-foreground">Aplica cuando un cliente solicita un reembolso a través del Bot de Soporte o el Portal de Cancelación.</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Auto-refund para montos menores a ($)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Sin límite"
                  value={rules.refund_rules.auto_refund_below || ""}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      refund_rules: { ...rules.refund_rules, auto_refund_below: e.target.value ? parseInt(e.target.value) : null },
                    })
                  }
                  onBlur={() => autoSaveRules(rules)}
                />
                <p className="text-sm text-muted-foreground">
                  Los refunds por debajo de este monto se aprobarán automáticamente
                </p>
              </div>

              <div className="space-y-2">
                <Label>Requerir aprobación para montos mayores a ($)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Sin límite"
                  value={rules.refund_rules.require_approval_above || ""}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      refund_rules: { ...rules.refund_rules, require_approval_above: e.target.value ? parseInt(e.target.value) : null },
                    })
                  }
                  onBlur={() => autoSaveRules(rules)}
                />
              </div>

              <div className="space-y-2">
                <Label>Días máximos para refund</Label>
                <Input
                  type="number"
                  min="1"
                  value={rules.refund_rules.max_refund_days}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      refund_rules: { ...rules.refund_rules, max_refund_days: parseInt(e.target.value) || 30 },
                    })
                  }
                  onBlur={() => autoSaveRules(rules)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efw" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <CardTitle>Early Fraud Warning (EFW)</CardTitle>
              </div>
              <CardDescription>
                Siempre que Stripe nos informe un posible fraude mediante webhook, aplicaremos esta regla automáticamente para proteger tu cuenta y evitar disputas (chargebacks).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Acción automática ante EFW</Label>
                <Select
                  value={rules.efw_rules.action}
                  onValueChange={(value) =>
                    handleUpdate((prev) => ({ ...prev, efw_rules: { ...prev.efw_rules, action: value } }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refund_always">Refund siempre</SelectItem>
                    <SelectItem value="review">Revisar manualmente</SelectItem>
                    <SelectItem value="ignore">Ignorar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Marcar como Fraudulento</Label>
                  <p className="text-sm text-muted-foreground">
                    Marcar al cliente como fraudulento en tu sistema
                  </p>
                </div>
                <Switch
                  checked={rules.efw_rules.mark_fraudulent}
                  onCheckedChange={(checked) =>
                    handleUpdate((prev) => ({ ...prev, efw_rules: { ...prev.efw_rules, mark_fraudulent: checked } }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputas" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle>Reglas de Disputas</CardTitle>
              </div>
              <CardDescription>
                Configura cómo manejar las disputas de Stripe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Estrategia de Disputas</Label>
                <Select
                  value={rules.dispute_rules.action}
                  onValueChange={(value) =>
                    handleUpdate((prev) => ({ ...prev, dispute_rules: { ...prev.dispute_rules, action: value } }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always_dispute">Disputar siempre</SelectItem>
                    <SelectItem value="never_dispute">Nunca disputar</SelectItem>
                    <SelectItem value="smart">Inteligente (según monto)</SelectItem>
                    <SelectItem value="review">Revisar manualmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {rules.dispute_rules.action === "smart" && (
                <div className="space-y-2">
                  <Label>Monto mínimo para disputar ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={rules.dispute_rules.min_amount_to_dispute}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        dispute_rules: { ...rules.dispute_rules, min_amount_to_dispute: parseInt(e.target.value) || 0 },
                      })
                    }
                    onBlur={() => autoSaveRules(rules)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Solo disputar cargos por encima de este monto
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
