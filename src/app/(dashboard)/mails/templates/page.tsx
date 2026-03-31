"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Edit, Trash2, Mail, FileText, Eye, Save, X, ArrowLeft,
  Sparkles, Loader2, Code, Braces, ChevronDown, ChevronUp,
  PenLine, Settings2, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { TemplateEditor } from "@/components/mail-config/template-editor";
import type { EmailBlock } from "@/emails/components/types";
import { PREDEFINED_TEMPLATES, type PredefinedTemplate } from "@/lib/emails/predefined-templates";

/* ---------- Types ---------- */

interface TemplateBranding {
  showHeader?: boolean;
  logoUrl?: string;
  senderName?: string;
  accentColor?: string;
  showSignature?: boolean;
  signature?: string;
  showFooter?: boolean;
  footerText?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  template_type: string;
  subject: string;
  blocks: EmailBlock[];
  custom_html?: string | null;
  branding?: TemplateBranding;
  is_predefined: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface AISettings {
  language: string;
  tone: string;
  length: string;
  customInstructions: string;
}

const DEFAULT_AI_SETTINGS: AISettings = {
  language: "es_ar",
  tone: "professional",
  length: "medium",
  customInstructions: "",
};

const AI_LANGUAGES = [
  { value: "es_ar", label: "Español (Argentina)" },
  { value: "es", label: "Español neutro" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const AI_TONES = [
  { value: "professional", label: "Profesional" },
  { value: "formal", label: "Formal / Corporativo" },
  { value: "friendly", label: "Amigable / Cercano" },
  { value: "casual", label: "Casual / Relajado" },
  { value: "urgent", label: "Urgente / Directo" },
];

const AI_LENGTHS = [
  { value: "short", label: "Corto (4-5 bloques)" },
  { value: "medium", label: "Medio (6-8 bloques)" },
  { value: "long", label: "Largo (8-12 bloques)" },
];

/* ---------- Constants ---------- */

const AVAILABLE_VARIABLES = [
  { key: "customerName", label: "Nombre del cliente", group: "Cliente" },
  { key: "customerEmail", label: "Email del cliente", group: "Cliente" },
  { key: "productName", label: "Nombre del producto", group: "Producto" },
  { key: "amount", label: "Precio / Monto", group: "Producto" },
  { key: "unsubscribeUrl", label: "Link de cancelación", group: "Links" },
  { key: "refundUrl", label: "Link de reembolso", group: "Links" },
  { key: "companyName", label: "Nombre de tu empresa", group: "Empresa" },
  { key: "supportEmail", label: "Email de soporte", group: "Empresa" },
];

const TYPE_LABELS: Record<string, string> = {
  cancellation: "Cancelación", welcome: "Bienvenida", generic: "Genérico",
  reply: "Respuesta", custom: "Personalizado", new_sale: "Nueva Venta",
  new_subscription: "Nueva Suscripción", activation_reminder: "Activación",
  unsubscribe_confirmation: "Cancelación", refund_confirmation: "Reembolso",
};

const TYPE_COLORS: Record<string, string> = {
  cancellation: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  welcome: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  generic: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  reply: "bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-400",
  custom: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  new_sale: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  new_subscription: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  activation_reminder: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  unsubscribe_confirmation: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  refund_confirmation: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
};

/* ---------- Variable Inserter ---------- */

function VariableInserter({ onInsert }: { onInsert: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const groups = AVAILABLE_VARIABLES.reduce<Record<string, typeof AVAILABLE_VARIABLES>>((acc, v) => {
    (acc[v.group] ??= []).push(v);
    return acc;
  }, {});

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Braces className="h-3.5 w-3.5" />
          Variables
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="p-2 border-b">
          <p className="text-xs text-muted-foreground">Hacé clic en una variable para insertarla</p>
        </div>
        <div className="max-h-60 overflow-auto p-1">
          {Object.entries(groups).map(([group, vars]) => (
            <div key={group}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 mt-1">{group}</p>
              {vars.map((v) => (
                <button
                  key={v.key}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors"
                  onClick={() => { onInsert(`{{${v.key}}}`); setOpen(false); }}
                >
                  <span>{v.label}</span>
                  <code className="text-[10px] bg-muted px-1 rounded text-muted-foreground">{`{{${v.key}}}`}</code>
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Branding Controls ---------- */

function BrandingControls({ branding, onChange }: { branding: TemplateBranding; onChange: (b: TemplateBranding) => void }) {
  const [expanded, setExpanded] = useState(false);
  const update = (partial: Partial<TemplateBranding>) => onChange({ ...branding, ...partial });

  return (
    <Card>
      <CardContent className="py-3">
        <button className="flex items-center justify-between w-full text-sm font-medium" onClick={() => setExpanded(!expanded)}>
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Personalizar encabezado, firma y pie
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expanded && (
          <div className="mt-4 space-y-5">
            <div className="space-y-3 p-3 rounded-lg bg-muted/40 border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Encabezado</Label>
                <Switch checked={branding.showHeader !== false} onCheckedChange={(v) => update({ showHeader: v })} />
              </div>
              {branding.showHeader !== false && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">URL del logo</Label>
                    <Input value={branding.logoUrl ?? ""} onChange={(e) => update({ logoUrl: e.target.value || undefined })} placeholder="https://miempresa.com/logo.png" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nombre (si no hay logo)</Label>
                    <Input value={branding.senderName ?? ""} onChange={(e) => update({ senderName: e.target.value || undefined })} placeholder="Mi Empresa" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Color de acento</Label>
                    <div className="flex gap-2">
                      <Input type="color" value={branding.accentColor ?? "#fbbf24"} onChange={(e) => update({ accentColor: e.target.value })} className="w-10 h-9 p-1 cursor-pointer" />
                      <Input value={branding.accentColor ?? "#fbbf24"} onChange={(e) => update({ accentColor: e.target.value })} className="text-sm font-mono" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3 p-3 rounded-lg bg-muted/40 border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Firma</Label>
                <Switch checked={branding.showSignature !== false} onCheckedChange={(v) => update({ showSignature: v })} />
              </div>
              {branding.showSignature !== false && (
                <Textarea value={branding.signature ?? ""} onChange={(e) => update({ signature: e.target.value || undefined })} placeholder="Saludos,&#10;El equipo de Soporte" rows={2} className="text-sm resize-none" />
              )}
            </div>
            <div className="space-y-3 p-3 rounded-lg bg-muted/40 border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Pie de email</Label>
                <Switch checked={branding.showFooter !== false} onCheckedChange={(v) => update({ showFooter: v })} />
              </div>
              {branding.showFooter !== false && (
                <Input value={branding.footerText ?? ""} onChange={(e) => update({ footerText: e.target.value || undefined })} placeholder="© 2026 Mi Empresa. Todos los derechos reservados." className="text-sm" />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Starter Gallery ---------- */

function StarterGallery({ onSelect, onBack }: { onSelect: (t: PredefinedTemplate) => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Elegí un template para empezar</h1>
          <p className="text-sm text-muted-foreground">
            Seleccioná una base y personalizala a tu gusto
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PREDEFINED_TEMPLATES.map((tpl) => (
          <button
            key={tpl.slug}
            className="text-left group"
            onClick={() => onSelect(tpl)}
          >
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{tpl.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {tpl.description}
                    </p>
                    {tpl.subject && (
                      <p className="text-[10px] text-muted-foreground/70 mt-2 truncate font-mono">
                        Asunto: {tpl.subject}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================= Main Page ============================= */

type View = "list" | "gallery" | "editor";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBlocks, setEditBlocks] = useState<EmailBlock[]>([]);
  const [editBranding, setEditBranding] = useState<TemplateBranding>({});
  const [editCustomHtml, setEditCustomHtml] = useState("");
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [editTemplateType, setEditTemplateType] = useState("custom");
  const [saving, setSaving] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>();

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);

  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);

  /* ---------- Fetch ---------- */

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

  /* ---------- Preview ---------- */

  const fetchPreview = useCallback(async (
    blocks: EmailBlock[], subject?: string, customHtml?: string, branding?: TemplateBranding,
  ) => {
    try {
      const res = await fetch("/api/emails/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: customHtml ? undefined : blocks,
          subject,
          custom_html: customHtml || undefined,
          branding,
        }),
      });
      if (res.ok) setPreviewHtml(await res.text());
    } catch { /* silent */ }
  }, []);

  const scheduledPreview = useCallback((
    blocks: EmailBlock[], subject: string, customHtml: string, branding: TemplateBranding, mode: "visual" | "html",
  ) => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      if (mode === "html") fetchPreview([], subject, customHtml, branding);
      else fetchPreview(blocks, subject, undefined, branding);
    }, 800);
  }, [fetchPreview]);

  const handleBlocksChange = useCallback((blocks: EmailBlock[]) => {
    setEditBlocks(blocks);
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => fetchPreview(blocks, editSubject, undefined, editBranding), 800);
  }, [fetchPreview, editSubject, editBranding]);

  const handleBrandingChange = useCallback((branding: TemplateBranding) => {
    setEditBranding(branding);
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      if (editorMode === "html") fetchPreview([], editSubject, editCustomHtml, branding);
      else fetchPreview(editBlocks, editSubject, undefined, branding);
    }, 600);
  }, [fetchPreview, editSubject, editBlocks, editCustomHtml, editorMode]);

  const handleHtmlChange = useCallback((html: string) => {
    setEditCustomHtml(html);
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => fetchPreview([], editSubject, html, editBranding), 800);
  }, [fetchPreview, editSubject, editBranding]);

  /* ---------- Variable inserter ---------- */

  const insertVariableInEditor = useCallback((variable: string) => {
    if (editorMode === "html" && htmlTextareaRef.current) {
      const ta = htmlTextareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = editCustomHtml.slice(0, start) + variable + editCustomHtml.slice(end);
      setEditCustomHtml(newValue);
      setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + variable.length; }, 0);
      clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => fetchPreview([], editSubject, newValue, editBranding), 800);
    }
  }, [editorMode, editCustomHtml, fetchPreview, editSubject, editBranding]);

  /* ---------- Open / Close ---------- */

  const openEditorWith = (opts: {
    template?: EmailTemplate;
    starter?: PredefinedTemplate;
  }) => {
    const { template, starter } = opts;
    if (template) {
      setEditing(template);
      setEditName(template.name);
      setEditSubject(template.subject);
      setEditBlocks(template.blocks ?? []);
      setEditBranding(template.branding ?? {});
      setEditCustomHtml(template.custom_html ?? "");
      setEditorMode(template.custom_html ? "html" : "visual");
      setEditTemplateType(template.template_type);
      setPreviewHtml(null);
      if (template.custom_html) fetchPreview([], template.subject, template.custom_html, template.branding);
      else if (template.blocks?.length) fetchPreview(template.blocks, template.subject, undefined, template.branding);
    } else if (starter) {
      setEditing(null);
      setEditName(starter.name);
      setEditSubject(starter.subject);
      setEditBlocks(starter.blocks);
      setEditBranding({});
      setEditCustomHtml("");
      setEditorMode("visual");
      setEditTemplateType(starter.template_type);
      setPreviewHtml(null);
      if (starter.blocks.length) fetchPreview(starter.blocks, starter.subject);
    } else {
      setEditing(null);
      setEditName("");
      setEditSubject("");
      setEditBlocks([]);
      setEditBranding({});
      setEditCustomHtml("");
      setEditorMode("visual");
      setEditTemplateType("custom");
      setPreviewHtml(null);
    }
    setView("editor");
  };

  const closeEditor = () => {
    setEditing(null);
    setView("list");
    setPreviewHtml(null);
  };

  /* ---------- Save ---------- */

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const payload = {
        name: editName,
        subject: editSubject,
        blocks: editorMode === "visual" ? editBlocks : [],
        custom_html: editorMode === "html" ? editCustomHtml || null : null,
        branding: editBranding,
      };

      if (editing) {
        const res = await fetch("/api/emails/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...payload }),
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
          body: JSON.stringify({ ...payload, template_type: editTemplateType }),
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

  /* ---------- AI ---------- */

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/emails/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, aiSettings }),
      });
      if (res.ok) {
        const { blocks } = await res.json();
        setEditBlocks(blocks);
        setEditorMode("visual");
        fetchPreview(blocks, editSubject, undefined, editBranding);
        toast.success("Contenido generado con IA");
        setAiPrompt("");
      } else {
        const { error } = await res.json();
        toast.error(error ?? "Error al generar");
      }
    } catch { toast.error("Error al generar con IA"); }
    finally { setAiGenerating(false); }
  };

  /* ===================== GALLERY VIEW ===================== */

  if (view === "gallery") {
    return (
      <StarterGallery
        onSelect={(starter) => openEditorWith({ starter })}
        onBack={() => setView("list")}
      />
    );
  }

  /* ===================== EDITOR VIEW ===================== */

  if (view === "editor") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeEditor}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {editing ? `Editar: ${editing.name}` : "Nuevo Template"}
            </h1>
            <p className="text-sm text-muted-foreground">Usá el editor visual o pegá tu HTML personalizado</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-sm">Nombre del template</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ej: Cancelación de suscripción" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Asunto del email</Label>
            <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Ej: Tu suscripción ha sido cancelada" />
          </div>
        </div>

        <BrandingControls branding={editBranding} onChange={handleBrandingChange} />

        <Card>
          <CardContent className="py-3 space-y-3">
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
                variant="ghost"
                onClick={() => setAiSettingsOpen(!aiSettingsOpen)}
                className={`shrink-0 ${aiSettingsOpen ? "bg-muted" : ""}`}
                title="Configurar IA"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={generateWithAI} disabled={aiGenerating || !aiPrompt.trim()} className="shrink-0">
                {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generar con IA"}
              </Button>
            </div>

            {aiSettingsOpen && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Configuración de la IA
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Idioma</Label>
                    <Select value={aiSettings.language} onValueChange={(v) => setAiSettings({ ...aiSettings, language: v })}>
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_LANGUAGES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tono</Label>
                    <Select value={aiSettings.tone} onValueChange={(v) => setAiSettings({ ...aiSettings, tone: v })}>
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_TONES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Longitud</Label>
                    <Select value={aiSettings.length} onValueChange={(v) => setAiSettings({ ...aiSettings, length: v })}>
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_LENGTHS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Instrucciones adicionales (opcional)</Label>
                  <Input
                    value={aiSettings.customInstructions}
                    onChange={(e) => setAiSettings({ ...aiSettings, customInstructions: e.target.value })}
                    placeholder="Ej: Mencioná que ofrecemos soporte 24/7, incluí un código de descuento..."
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/30 p-0.5">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${editorMode === "visual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setEditorMode("visual"); scheduledPreview(editBlocks, editSubject, editCustomHtml, editBranding, "visual"); }}
            >
              <PenLine className="h-3.5 w-3.5" /> Editor visual
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${editorMode === "html" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setEditorMode("html"); scheduledPreview(editBlocks, editSubject, editCustomHtml, editBranding, "html"); }}
            >
              <Code className="h-3.5 w-3.5" /> HTML personalizado
            </button>
          </div>
          <VariableInserter onInsert={insertVariableInEditor} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              {editorMode === "visual" ? <><Edit className="h-4 w-4" /> Editor visual</> : <><Code className="h-4 w-4" /> HTML personalizado</>}
            </Label>
            {editorMode === "visual" ? (
              <TemplateEditor key={editing?.id ?? `new-${editTemplateType}`} initialBlocks={editBlocks} onChange={handleBlocksChange} />
            ) : (
              <div className="rounded-lg border bg-muted/10 p-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Pegá tu HTML. Podés usar variables como <code className="bg-muted px-1 rounded text-[10px]">{"{{customerName}}"}</code>.
                </p>
                <Textarea
                  ref={htmlTextareaRef}
                  value={editCustomHtml}
                  onChange={(e) => handleHtmlChange(e.target.value)}
                  placeholder={`<h1>Hola {{customerName}}</h1>\n<p>Gracias por tu compra de {{productName}}.</p>`}
                  rows={18}
                  className="font-mono text-xs resize-none"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4" /> Vista previa</Label>
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
                  <iframe srcDoc={previewHtml} className="w-full h-full border-0" title="Email preview" sandbox="" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Escribí algo para ver la vista previa</div>
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={closeEditor}><X className="h-4 w-4 mr-2" /> Cancelar</Button>
          <Button onClick={saveTemplate} disabled={saving || !editName}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear template"}
          </Button>
        </div>
      </div>
    );
  }

  /* ===================== LIST VIEW ===================== */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates de Email</h1>
          <p className="text-muted-foreground">Creá y editá templates con formato para tus emails</p>
        </div>
        <Button onClick={() => setView("gallery")}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Template
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        /* Empty state with starters */
        <div className="space-y-6">
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-medium">No tenés templates creados todavía</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Elegí uno de estos modelos como base y personalizalo
              </p>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold mb-3">Empezá con un modelo</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PREDEFINED_TEMPLATES.map((tpl) => (
                <button key={tpl.slug} className="text-left group" onClick={() => openEditorWith({ starter: tpl })}>
                  <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{tpl.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Existing templates */
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Mail className="h-8 w-8 text-primary" />
                    <div className="flex items-center gap-1.5">
                      {tpl.custom_html && <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600">HTML</Badge>}
                      <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[tpl.template_type] ?? TYPE_COLORS.custom}`}>
                        {TYPE_LABELS[tpl.template_type] ?? tpl.template_type}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="mt-4">{tpl.name}</CardTitle>
                  {tpl.subject && <CardDescription className="truncate">Asunto: {tpl.subject}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditorWith({ template: tpl })}>
                      <Edit className="mr-2 h-3 w-3" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditorWith({ template: tpl })}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    {!tpl.is_predefined && (
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteTemplate(tpl.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Starter suggestion */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Agregar desde un modelo</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {PREDEFINED_TEMPLATES.filter((p) => p.slug !== "blank").slice(0, 4).map((tpl) => (
                <button key={tpl.slug} className="text-left" onClick={() => openEditorWith({ starter: tpl })}>
                  <Card className="transition-all hover:shadow-sm hover:border-primary/30">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{tpl.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-xs">{tpl.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{tpl.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Variables Disponibles</CardTitle>
          <CardDescription>Usá estas variables en tus templates para personalizar los emails</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(
              AVAILABLE_VARIABLES.reduce<Record<string, typeof AVAILABLE_VARIABLES>>((acc, v) => { (acc[v.group] ??= []).push(v); return acc; }, {})
            ).map(([group, vars]) => (
              <div key={group} className="space-y-2">
                <Label>{group}</Label>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {vars.map((v) => (
                    <p key={v.key}><code className="bg-muted px-1 rounded">{`{{${v.key}}}`}</code> - {v.label}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
