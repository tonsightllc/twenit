"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bot, Plus, Edit, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ACTION_LABELS, CONDITION_LABELS, type AutomationRule } from "./types";

export function AutomationTab() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    triggerKey: "classification",
    triggerValue: "soporte",
    action_type: "create_ticket",
    actionBody: "",
  });

  const fetchRules = useCallback(async () => {
    const res = await fetch("/api/emails/automation");
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules ?? []);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const resetForm = () => {
    setForm({ name: "", triggerKey: "classification", triggerValue: "soporte", action_type: "create_ticket", actionBody: "" });
    setEditingRule(null);
  };

  const openModal = (rule?: AutomationRule) => {
    if (rule) {
      setEditingRule(rule);
      const [condKey, condVal] = Object.entries(rule.trigger_condition)[0] ?? ["classification", "soporte"];
      setForm({
        name: rule.name,
        triggerKey: condKey,
        triggerValue: condVal,
        action_type: rule.action_type,
        actionBody: (rule.action_config as { body?: string })?.body ?? "",
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const saveRule = async () => {
    const payload = {
      name: form.name,
      trigger_condition: { [form.triggerKey]: form.triggerValue },
      action_type: form.action_type,
      action_config: form.actionBody ? { body: form.actionBody } : {},
      enabled: true,
    };

    if (editingRule) {
      const res = await fetch("/api/emails/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingRule.id, ...payload }),
      });
      if (res.ok) {
        const { rule } = await res.json();
        setRules((r) => r.map((x) => (x.id === rule.id ? rule : x)));
        toast.success("Regla actualizada");
      }
    } else {
      const res = await fetch("/api/emails/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const { rule } = await res.json();
        setRules((r) => [...r, rule]);
        toast.success("Regla creada");
      }
    }
    setShowModal(false);
    resetForm();
  };

  const toggleRule = async (rule: AutomationRule) => {
    const res = await fetch("/api/emails/automation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
    });
    if (res.ok) {
      setRules((r) => r.map((x) => (x.id === rule.id ? { ...x, enabled: !x.enabled } : x)));
    }
  };

  const deleteRule = async (id: string) => {
    await fetch(`/api/emails/automation?id=${id}`, { method: "DELETE" });
    setRules((r) => r.filter((x) => x.id !== id));
    toast.success("Regla eliminada");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reglas de Automatización</CardTitle>
              <CardDescription>Acciones automáticas que se ejecutan al recibir emails</CardDescription>
            </div>
            <Button onClick={() => openModal()}>
              <Plus className="mr-2 h-4 w-4" /> Nueva Regla
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No hay reglas configuradas</p>
              <p className="text-xs mt-1">Creá una regla para automatizar acciones</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{rule.name}</p>
                      <Badge variant={rule.enabled ? "default" : "secondary"} className="text-xs">
                        {rule.enabled ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>Si: {Object.entries(rule.trigger_condition).map(([k, v]) => `${CONDITION_LABELS[k] ?? k} = ${v}`).join(", ")}</span>
                      <span>→</span>
                      <span>Acción: {ACTION_LABELS[rule.action_type] ?? rule.action_type}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openModal(rule)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{editingRule ? "Editar Regla" : "Nueva Regla"}</CardTitle>
                <button onClick={() => setShowModal(false)}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  placeholder="Ej: Auto-ticket soporte"
                  value={form.name}
                  onChange={(e) => setForm((r) => ({ ...r, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Condición (Cuando...)</Label>
                <div className="flex gap-2">
                  <Select value={form.triggerKey} onValueChange={(v) => setForm((r) => ({ ...r, triggerKey: v }))}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="soporte"
                    value={form.triggerValue}
                    onChange={(e) => setForm((r) => ({ ...r, triggerValue: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Acción</Label>
                <Select value={form.action_type} onValueChange={(v) => setForm((r) => ({ ...r, action_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(form.action_type === "auto_reply" || form.action_type === "forward") && (
                <div className="space-y-2">
                  <Label>{form.action_type === "auto_reply" ? "Texto de respuesta automática" : "Email destino"}</Label>
                  <textarea
                    className="w-full min-h-[80px] p-3 text-sm border rounded-md bg-background resize-none"
                    value={form.actionBody}
                    onChange={(e) => setForm((r) => ({ ...r, actionBody: e.target.value }))}
                    placeholder={form.action_type === "auto_reply" ? "Gracias por contactarnos, te respondemos pronto..." : "equipo@empresa.com"}
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button onClick={saveRule} disabled={!form.name || !form.triggerValue}>
                  {editingRule ? "Actualizar" : "Crear"} Regla
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
