"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, Trash2, Mail, FileText, Eye, Save, X, ArrowLeft, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { TemplateEditor } from "./template-editor";
import type { EmailBlock } from "@/emails/components/types";

interface EmailTemplate {
  id: string;
  name: string;
  template_type: string;
  subject: string;
  blocks: EmailBlock[];
  is_predefined: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  cancellation: "Cancelación",
  welcome: "Bienvenida",
  generic: "Genérico",
  reply: "Respuesta",
  custom: "Personalizado",
};

const TYPE_COLORS: Record<string, string> = {
  cancellation: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  welcome: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  generic: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  reply: "bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-400",
  custom: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
};

export function TemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBlocks, setEditBlocks] = useState<EmailBlock[]>([]);
  const [saving, setSaving] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>();
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emails/templates");
      if (res.ok) {
        const { templates: list } = await res.json();
        setTemplates(list ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const fetchPreview = useCallback(async (blocks: EmailBlock[], subject?: string) => {
    try {
      const res = await fetch("/api/emails/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, subject }),
      });
      if (res.ok) {
        const html = await res.text();
        setPreviewHtml(html);
      }
    } catch { /* silent */ }
  }, []);

  const handleBlocksChange = useCallback((blocks: EmailBlock[]) => {
    setEditBlocks(blocks);
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => fetchPreview(blocks, editSubject), 800);
  }, [fetchPreview, editSubject]);

  const openEditor = (template: EmailTemplate) => {
    setEditing(template);
    setCreating(false);
    setEditName(template.name);
    setEditSubject(template.subject);
    setEditBlocks(template.blocks);
    setPreviewHtml(null);
    fetchPreview(template.blocks, template.subject);
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setEditName("");
    setEditSubject("");
    setEditBlocks([]);
    setPreviewHtml(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
    setPreviewHtml(null);
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch("/api/emails/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            name: editName,
            subject: editSubject,
            blocks: editBlocks,
          }),
        });
        if (res.ok) {
          const { template } = await res.json();
          setTemplates((t) => t.map((x) => (x.id === template.id ? template : x)));
          toast.success("Template guardado");
          closeEditor();
        } else {
          const { error } = await res.json();
          toast.error(error ?? "Error al guardar");
        }
      } else {
        const res = await fetch("/api/emails/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName,
            subject: editSubject,
            blocks: editBlocks,
            template_type: "custom",
          }),
        });
        if (res.ok) {
          const { template } = await res.json();
          setTemplates((t) => [...t, template]);
          toast.success("Template creado");
          closeEditor();
        } else {
          const { error } = await res.json();
          toast.error(error ?? "Error al crear");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/emails/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (res.ok) {
        const { blocks } = await res.json();
        setEditBlocks(blocks);
        fetchPreview(blocks, editSubject);
        toast.success("Contenido generado con IA");
        setAiPrompt("");
      } else {
        const { error } = await res.json();
        toast.error(error ?? "Error al generar");
      }
    } catch {
      toast.error("Error al generar con IA");
    } finally {
      setAiGenerating(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/emails/templates?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((t) => t.filter((x) => x.id !== id));
      toast.success("Template eliminado");
    } else {
      const { error } = await res.json();
      toast.error(error ?? "Error al eliminar");
    }
  };

  if (editing || creating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeEditor}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">
            {editing ? `Editar: ${editing.name}` : "Nuevo Template"}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-sm">Nombre del template</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ej: Cancelación de suscripción"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Asunto del email</Label>
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="Ej: Tu suscripción ha sido cancelada"
            />
          </div>
        </div>

        {/* AI generation */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500 shrink-0" />
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describí el email que querés generar... (ej: email de bienvenida para nuevo cliente)"
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && generateWithAI()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={generateWithAI}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="shrink-0"
              >
                {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generar con IA"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Edit className="h-4 w-4" /> Editor
            </Label>
            <TemplateEditor
              initialBlocks={editBlocks}
              onChange={handleBlocksChange}
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" /> Vista previa
            </Label>
            <Card className="overflow-hidden">
              <div className="bg-muted/50 border-b p-2 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-xs text-muted-foreground ml-auto">Preview</span>
              </div>
              <div className="h-[500px] overflow-auto">
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    title="Email preview"
                    sandbox=""
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Escribí algo para ver la vista previa
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={closeEditor}>
            <X className="h-4 w-4 mr-2" /> Cancelar
          </Button>
          <Button onClick={saveTemplate} disabled={saving || !editName}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear template"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Templates de Email</CardTitle>
            <CardDescription>
              Creá y editá templates con formato para tus emails
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No hay templates creados</p>
            <p className="text-xs mt-1">Creá tu primer template para enviar emails con formato</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="rounded-lg bg-muted p-2 shrink-0">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{tpl.name}</p>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${TYPE_COLORS[tpl.template_type] ?? ""}`}>
                        {TYPE_LABELS[tpl.template_type] ?? tpl.template_type}
                      </Badge>
                      {tpl.is_predefined && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">Predefinido</Badge>
                      )}
                    </div>
                    {tpl.subject && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        Asunto: {tpl.subject}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(tpl)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  {!tpl.is_predefined && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteTemplate(tpl.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
