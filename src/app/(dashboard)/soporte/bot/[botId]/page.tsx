"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { BotFlowEditor } from "@/components/bot/bot-flow-editor";
import { BotPreview } from "@/components/bot/bot-preview";
import type { BotNode } from "@/components/bot/bot-node-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    ArrowLeft,
    Save,
    Loader2,
    Code,
    Paintbrush,
    GitBranch,
    RotateCcw,
} from "lucide-react";

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

export default function BotEditorPage() {
    const params = useParams();
    const router = useRouter();
    const { orgId } = useOrg();
    const botId = params.botId as string;

    const [bot, setBot] = useState<BotConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const [activeTab, setActiveTab] = useState<string>("flow");

    const supabase = createClient();

    const loadBot = useCallback(async () => {
        const { data, error } = await supabase
            .from("bot_configs")
            .select("*")
            .eq("id", botId)
            .eq("org_id", orgId)
            .single();

        if (error || !data) {
            toast.error("Bot no encontrado");
            router.push("/soporte/bot");
            return;
        }

        setBot(data as BotConfig);
        setLoading(false);
    }, [botId, orgId, supabase, router]);

    useEffect(() => {
        if (orgId && botId) loadBot();
    }, [orgId, botId, loadBot]);

    const handleTreeChange = useCallback((treeConfig: { nodes: Record<string, BotNode>; startNode: string }) => {
        if (!bot) return;
        setBot({ ...bot, tree_config: treeConfig });
        setHasChanges(true);
    }, [bot]);

    function handleStyleChange(updates: Partial<BotConfig["styles"]>) {
        if (!bot) return;
        setBot({ ...bot, styles: { ...bot.styles, ...updates } });
        setHasChanges(true);
    }

    async function handleSave() {
        if (!bot || !orgId) return;
        setSaving(true);

        const { error } = await supabase
            .from("bot_configs")
            .update({
                name: bot.name,
                tree_config: bot.tree_config,
                styles: bot.styles,
            })
            .eq("id", bot.id)
            .eq("org_id", orgId);

        if (error) {
            toast.error("Error al guardar: " + error.message);
        } else {
            toast.success("Bot guardado correctamente");
            setHasChanges(false);
        }
        setSaving(false);
    }

    function refreshPreview() {
        setPreviewKey((k) => k + 1);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!bot) return null;

    return (
        <div className="h-[calc(100vh-7rem)] flex flex-col">
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b px-4 py-3 bg-background shrink-0">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/soporte/bot")}
                        className="gap-1"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <div className="flex items-center gap-2">
                        <Input
                            value={bot.name}
                            onChange={(e) => {
                                setBot({ ...bot, name: e.target.value });
                                setHasChanges(true);
                            }}
                            className="h-8 w-56 font-semibold text-sm border-transparent hover:border-input focus:border-input transition-colors"
                        />
                        {hasChanges && (
                            <Badge variant="secondary" className="text-xs animate-in fade-in-50">
                                Sin guardar
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshPreview}
                        className="gap-1"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Refresh Preview
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/soporte/bot/${botId}/integrar`)}
                        className="gap-1"
                    >
                        <Code className="h-3.5 w-3.5" />
                        Integración
                    </Button>
                    <Button
                        onClick={handleSave}
                        size="sm"
                        disabled={saving || !hasChanges}
                        className="gap-1"
                    >
                        {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        Guardar
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0">
                {/* Left: Editor */}
                <div className="flex-1 flex flex-col min-w-0 border-r h-full overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                        <div className="border-b px-4">
                            <TabsList className="h-10 bg-transparent">
                                <TabsTrigger value="flow" className="gap-1.5 text-xs data-[state=active]:bg-muted">
                                    <GitBranch className="h-3.5 w-3.5" />
                                    Flujo
                                </TabsTrigger>
                                <TabsTrigger value="styles" className="gap-1.5 text-xs data-[state=active]:bg-muted">
                                    <Paintbrush className="h-3.5 w-3.5" />
                                    Estilos
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="flow" className="flex-1 m-0 overflow-hidden flex flex-col h-full">
                            <BotFlowEditor
                                treeConfig={bot.tree_config}
                                onChange={handleTreeChange}
                            />
                        </TabsContent>

                        <TabsContent value="styles" className="flex-1 m-0 overflow-y-auto p-6">
                            <div className="max-w-md mx-auto space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Apariencia del Widget</h3>
                                    <p className="text-sm text-muted-foreground mb-6">
                                        Personaliza los colores y la posición del bot embebido
                                    </p>
                                </div>

                                {/* Welcome Message */}
                                <div className="space-y-2">
                                    <Label>Mensaje de Bienvenida</Label>
                                    <Input
                                        value={bot.styles.welcome_message}
                                        onChange={(e) => handleStyleChange({ welcome_message: e.target.value })}
                                        placeholder="¡Hola! ¿En qué puedo ayudarte?"
                                    />
                                </div>

                                {/* Colors */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Color Principal</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={bot.styles.primary_color}
                                                onChange={(e) => handleStyleChange({ primary_color: e.target.value })}
                                                className="w-12 h-9 p-1 cursor-pointer"
                                            />
                                            <Input
                                                value={bot.styles.primary_color}
                                                onChange={(e) => handleStyleChange({ primary_color: e.target.value })}
                                                className="flex-1 font-mono text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Color Secundario</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={bot.styles.secondary_color}
                                                onChange={(e) => handleStyleChange({ secondary_color: e.target.value })}
                                                className="w-12 h-9 p-1 cursor-pointer"
                                            />
                                            <Input
                                                value={bot.styles.secondary_color}
                                                onChange={(e) => handleStyleChange({ secondary_color: e.target.value })}
                                                className="flex-1 font-mono text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Color de Texto</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={bot.styles.text_color}
                                                onChange={(e) => handleStyleChange({ text_color: e.target.value })}
                                                className="w-12 h-9 p-1 cursor-pointer"
                                            />
                                            <Input
                                                value={bot.styles.text_color}
                                                onChange={(e) => handleStyleChange({ text_color: e.target.value })}
                                                className="flex-1 font-mono text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Color de Fondo</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={bot.styles.background_color}
                                                onChange={(e) => handleStyleChange({ background_color: e.target.value })}
                                                className="w-12 h-9 p-1 cursor-pointer"
                                            />
                                            <Input
                                                value={bot.styles.background_color}
                                                onChange={(e) => handleStyleChange({ background_color: e.target.value })}
                                                className="flex-1 font-mono text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Position */}
                                <div className="space-y-2">
                                    <Label>Posición del Widget</Label>
                                    <Select
                                        value={bot.styles.position}
                                        onValueChange={(v: "bottom-right" | "bottom-left") => handleStyleChange({ position: v })}
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

                                {/* Logo URL */}
                                <div className="space-y-2">
                                    <Label>URL del Logo (opcional)</Label>
                                    <Input
                                        value={bot.styles.logo_url || ""}
                                        onChange={(e) => handleStyleChange({ logo_url: e.target.value || undefined })}
                                        placeholder="https://ejemplo.com/logo.png"
                                        className="font-mono text-xs"
                                    />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right: Preview */}
                <div className="w-[420px] shrink-0 flex flex-col bg-muted/10">
                    <BotPreview
                        key={previewKey}
                        treeConfig={bot.tree_config}
                        styles={bot.styles}
                        botName={bot.name}
                    />
                </div>
            </div>
        </div>
    );
}
