"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  Gavel,
  UserMinus,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useOrg } from "@/components/providers/org-provider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface UnsubscriptionRules {
  id: string;
  immediate_cancel: boolean;
  offer_benefit_first: boolean;
  efw_rules: { action: string; mark_fraudulent: boolean };
  dispute_rules: { action: string; min_amount_to_dispute: number };
}

export default function StripeOnboardingPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<UnsubscriptionRules | null>(null);

  // Defaults
  const [efwAction, setEfwAction] = useState("review"); // review, refund_always, ignore
  const [disputeAction, setDisputeAction] = useState("smart"); // smart, always_dispute, never_dispute, review
  const [immediateCancel, setImmediateCancel] = useState(true);
  const [offerBenefit, setOfferBenefit] = useState(false);

  useEffect(() => {
    async function loadRules() {
      if (!orgId) return;

      const { data, error } = await supabase
        .from("unsubscription_rules")
        .select("*")
        .eq("org_id", orgId)
        .single();

      if (!error && data) {
        setRules(data);
        if (data.efw_rules?.action) setEfwAction(data.efw_rules.action);
        if (data.dispute_rules?.action) setDisputeAction(data.dispute_rules.action);
        setImmediateCancel(data.immediate_cancel ?? true);
        setOfferBenefit(data.offer_benefit_first ?? false);
      }
      setLoading(false);
    }

    loadRules();
  }, [orgId, supabase]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);

    try {
      const updatePayload = {
        immediate_cancel: immediateCancel,
        offer_benefit_first: offerBenefit,
        efw_rules: {
          action: efwAction,
          mark_fraudulent: efwAction === "refund_always" ? true : false,
        },
        dispute_rules: {
          action: disputeAction,
          min_amount_to_dispute: 15, // Default $15
        },
      };

      if (rules?.id) {
        await supabase
          .from("unsubscription_rules")
          .update(updatePayload)
          .eq("id", rules.id);
      } else {
        await supabase.from("unsubscription_rules").insert({
          org_id: orgId,
          ...updatePayload,
        });
      }

      toast.success("¡Configuración guardada exitosamente!");
      router.push("/settings/stripe?success=stripe_connected");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">
            Sincronizando con Stripe...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/10 dark:border-white/5 p-8 md:p-12 text-center shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-violet-600/20 blur-3xl rounded-full" />
        
        <div className="relative z-10">
          <Badge className="mb-6 bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25 border-green-500/20 px-4 py-1.5 text-sm">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            ¡Conexión Exitosa!
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-gray-300">
            Piloto Automático Activado
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tus clientes, suscripciones y webhooks ya están sincronizados. Antes de ir a tu panel, configuremos cómo quieres que nuestro sistema actúe frente a eventos críticos de Stripe.
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-1">
        
        {/* Early Fraud Warning */}
        <Card className="overflow-hidden border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-6 group-hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-xl text-red-600 dark:text-red-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Early Fraud Warnings (EFW)</CardTitle>
                <CardDescription className="mt-1">
                  Alertas tempranas emitidas por los bancos cuando sospechan de fraude.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <SelectionOption
                title="Reembolso Automático"
                description="Reembolsa el cargo inmediatamente para evitar una disputa (Recomendado)."
                selected={efwAction === "refund_always"}
                onClick={() => setEfwAction("refund_always")}
                badge="Prevención 🛡️"
              />
              <SelectionOption
                title="Revisión Manual"
                description="Genera un ticket de soporte para que tu equipo decida."
                selected={efwAction === "review"}
                onClick={() => setEfwAction("review")}
              />
              <SelectionOption
                title="Ignorar"
                description="No hacer nada, asumes el riesgo de disputa."
                selected={efwAction === "ignore"}
                onClick={() => setEfwAction("ignore")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Disputes */}
        <Card className="overflow-hidden border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-6 group-hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400">
                <Gavel className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Gestión de Disputas (Chargebacks)</CardTitle>
                <CardDescription className="mt-1">
                  Cuando un cliente desconoce un cargo directamente con su banco.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SelectionOption
                title="Inteligente"
                description="Solo pelea disputas mayores a $15 USD agrupando evidencia."
                selected={disputeAction === "smart"}
                onClick={() => setDisputeAction("smart")}
                badge="Eficiente 🧠"
              />
              <SelectionOption
                title="Pelear Siempre"
                description="Envía evidencia automáticamente a Stripe sin importar el monto."
                selected={disputeAction === "always_dispute"}
                onClick={() => setDisputeAction("always_dispute")}
              />
              <SelectionOption
                title="Aceptar Siempre"
                description="Darle la razón al cliente. Cierra la disputa inmediatamente."
                selected={disputeAction === "never_dispute"}
                onClick={() => setDisputeAction("never_dispute")}
              />
              <SelectionOption
                title="Revisar"
                description="Agrupa evidencia en un ticket y espera tu confirmación manual."
                selected={disputeAction === "review"}
                onClick={() => setDisputeAction("review")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Unsubscriptions */}
        <Card className="overflow-hidden border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-6 group-hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                <UserMinus className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Flujo de Desuscripciones</CardTitle>
                <CardDescription className="mt-1">
                  Reglas para cuando los clientes solicitan cancelar su servicio.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background hover:bg-muted/30 transition-colors">
              <div className="space-y-1">
                <Label htmlFor="immediate-cancel" className="text-base font-semibold">
                  Cancelación Directa
                </Label>
                <p className="text-sm text-muted-foreground w-11/12">
                  Permite cancelar la suscripción con un solo clic, o pausa la recolección al final del ciclo mensual automáticamente.
                </p>
              </div>
              <Switch
                id="immediate-cancel"
                checked={immediateCancel}
                onCheckedChange={setImmediateCancel}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background hover:bg-muted/30 transition-colors">
              <div className="space-y-1">
                <Label htmlFor="offer-benefit" className="text-base font-semibold flex items-center gap-2">
                  Retención Inteligente
                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">Recomendado <Sparkles className="w-3 h-3 ml-1"/></Badge>
                </Label>
                <p className="text-sm text-muted-foreground w-11/12">
                  El bot interceptará la solicitud y ofrecerá beneficios (descuentos, pausa temporal) antes de ejecutar la cancelación real.
                </p>
              </div>
              <Switch
                id="offer-benefit"
                checked={offerBenefit}
                onCheckedChange={setOfferBenefit}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          size="lg" 
          onClick={handleSave} 
          disabled={saving}
          className="gap-2 h-12 px-8 rounded-full shadow-lg hover:shadow-primary/25 transition-all text-base font-semibold"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Guardar y Finalizar
              <ChevronRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SelectionOption({
  title,
  description,
  selected,
  onClick,
  badge,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-xl p-5 border-2 transition-all duration-200 flex flex-col h-full
        ${
          selected
            ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
            : "border-border/60 hover:border-primary/50 hover:bg-muted/30 hover:scale-[1.01]"
        }
      `}
    >
      {badge && (
        <span className="absolute top-0 right-0 -mt-2.5 -mr-2.5 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-md shadow-sm z-10">
          {badge}
        </span>
      )}
      <div className="flex items-start justify-between mb-2">
        <h4 className={`font-semibold ${selected ? "text-primary" : "text-foreground"}`}>
          {title}
        </h4>
        <div
          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-colors ${
            selected ? "border-primary" : "border-muted-foreground/30"
          }`}
        >
          {selected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-auto leading-relaxed">
        {description}
      </p>
    </div>
  );
}
