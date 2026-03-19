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
import { Loader2, Save, AlertTriangle, DollarSign, ShieldAlert } from "lucide-react";

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
  const [saving, setSaving] = useState(false);
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

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("unsubscription_rules")
        .upsert({
          ...rules,
          org_id: orgId,
        });

      if (error) throw error;

      toast.success("Reglas guardadas correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar las reglas");
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Reglas de Desuscripción</h1>
          <p className="text-muted-foreground">
            Configura cómo manejar cancelaciones, refunds y disputas
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar Cambios
        </Button>
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
              <CardTitle>Comportamiento de Cancelación</CardTitle>
              <CardDescription>
                Define cómo se procesan las cancelaciones de suscripción
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cancelación Inmediata</Label>
                  <p className="text-sm text-muted-foreground">
                    Cancelar la suscripción inmediatamente sin ofrecer alternativas
                  </p>
                </div>
                <Switch
                  checked={rules.immediate_cancel}
                  onCheckedChange={(checked) =>
                    setRules({ ...rules, immediate_cancel: checked })
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
                    setRules({ ...rules, offer_benefit_first: checked })
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
                        setRules({ ...rules, benefit_type: value })
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
                            benefit_config: {
                              ...rules.benefit_config,
                              discount_percent: parseInt(e.target.value) || 0,
                            },
                          })
                        }
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
                Configura cuándo procesar refunds automáticamente
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
                      refund_rules: {
                        ...rules.refund_rules,
                        auto_refund_below: e.target.value ? parseInt(e.target.value) : null,
                      },
                    })
                  }
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
                      refund_rules: {
                        ...rules.refund_rules,
                        require_approval_above: e.target.value ? parseInt(e.target.value) : null,
                      },
                    })
                  }
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
                      refund_rules: {
                        ...rules.refund_rules,
                        max_refund_days: parseInt(e.target.value) || 30,
                      },
                    })
                  }
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
                Configura cómo responder a alertas de fraude tempranas de Stripe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Acción ante EFW</Label>
                <Select
                  value={rules.efw_rules.action}
                  onValueChange={(value) =>
                    setRules({
                      ...rules,
                      efw_rules: { ...rules.efw_rules, action: value },
                    })
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
                    setRules({
                      ...rules,
                      efw_rules: { ...rules.efw_rules, mark_fraudulent: checked },
                    })
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
                    setRules({
                      ...rules,
                      dispute_rules: { ...rules.dispute_rules, action: value },
                    })
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
                        dispute_rules: {
                          ...rules.dispute_rules,
                          min_amount_to_dispute: parseInt(e.target.value) || 0,
                        },
                      })
                    }
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
