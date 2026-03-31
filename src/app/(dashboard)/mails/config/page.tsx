"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ConnectionTab } from "@/components/mail-config/connection-tab";
import { AppearanceTab } from "@/components/mail-config/appearance-tab";
import { ClassificationTab } from "@/components/mail-config/classification-tab";
import { AutomationTab } from "@/components/mail-config/automation-tab";
import { DEFAULT_CONFIG, type EmailConfig } from "@/components/mail-config/types";

export default function MailConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saving = saveStatus === "saving";
  const [config, setConfig] = useState<EmailConfig>(DEFAULT_CONFIG);
  const [generatedInboundAddress, setGeneratedInboundAddress] = useState<string | null>(null);
  const inboundAddress = config.inbound_address ?? generatedInboundAddress;

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emails/config");
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        if (data.generatedInboundAddress) setGeneratedInboundAddress(data.generatedInboundAddress);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = useCallback(async (partial?: Partial<EmailConfig>) => {
    setSaveStatus("saving");
    try {
      const payload = { ...config, ...partial };
      const res = await fetch("/api/emails/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const { config: saved } = await res.json();
        setConfig(saved);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        const { error } = await res.json();
        toast.error(error ?? "Error al guardar");
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    } catch {
      toast.error("Error al guardar");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }, [config]);

  const handleUpdate = useCallback((partial: Partial<EmailConfig>) => {
    setConfig(c => ({ ...c, ...partial }));
    saveConfig(partial);
  }, [saveConfig]);

  const connectionStatus = () => {
    const method = config.connection_method ?? "none";
    if (method === "resend_client") {
      return { label: "Resend conectado", sub: `Enviando y recibiendo como ${config.email_address}`, color: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400" };
    }
    if (method === "forwarding") {
      return { label: "Reenvío automático activo", sub: `Recibiendo emails en ${config.inbound_address}`, color: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400" };
    }
    if (method === "imap") {
      return { label: "Casilla conectada", sub: `Sincronizando ${config.email_address}`, color: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400" };
    }
    if (method === "smtp_only") {
      return { label: "Solo envío configurado", sub: `Enviando desde ${config.email_address}`, color: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400" };
    }
    return { label: "Sin configurar", sub: "Configurá tu email para recibir y responder desde la plataforma", color: "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = connectionStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración de Mails</h1>
          <p className="text-muted-foreground">Configurá cómo recibís y respondés los emails de tus clientes</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium mr-4">
          {saveStatus === "saving" && <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Guardando...</span></>}
          {saveStatus === "saved" && <><CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /><span className="text-green-600 dark:text-green-500">Guardado</span></>}
          {saveStatus === "error" && <><XCircle className="h-4 w-4 text-red-600 dark:text-red-500" /><span className="text-red-600 dark:text-red-500">Error</span></>}
        </div>
      </div>

      {/* Status bar */}
      <div className={`rounded-lg border p-3 ${status.color}`}>
        <div className="flex items-center gap-2 text-sm font-medium">{status.label}</div>
        <p className="text-xs mt-0.5 opacity-80">{status.sub}</p>
      </div>

      <Tabs defaultValue="connection">
        <TabsList>
          <TabsTrigger value="connection">Conexión</TabsTrigger>
          <TabsTrigger value="appearance">Personalización</TabsTrigger>
          <TabsTrigger value="classification">Clasificación IA</TabsTrigger>
          <TabsTrigger value="automation">Automatización</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="mt-6 space-y-6">
          <ConnectionTab
            config={config}
            inboundAddress={inboundAddress}
            saving={saving}
            onUpdate={handleUpdate}
            onSave={saveConfig}
          />
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <AppearanceTab
            config={config}
            onUpdate={handleUpdate}
            onSave={saveConfig}
            setConfig={setConfig}
          />
        </TabsContent>

        <TabsContent value="classification" className="mt-6 space-y-6">
          <ClassificationTab config={config} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="automation" className="mt-6 space-y-6">
          <AutomationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
