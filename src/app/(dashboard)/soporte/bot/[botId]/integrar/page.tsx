"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    ArrowLeft,
    Copy,
    Check,
    Globe,
    Blocks,
    Loader2,
    ExternalLink,
    Zap,
} from "lucide-react";

export default function BotIntegrarPage() {
    const params = useParams();
    const router = useRouter();
    const { orgId } = useOrg();
    const botId = params.botId as string;

    const [botName, setBotName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [copiedMethod, setCopiedMethod] = useState<string | null>(null);

    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tu-dominio.com";

    const loadBot = useCallback(async () => {
        const { data, error } = await supabase
            .from("bot_configs")
            .select("name")
            .eq("id", botId)
            .eq("org_id", orgId)
            .single();

        if (error || !data) {
            toast.error("Bot no encontrado");
            router.push("/soporte/bot");
            return;
        }

        setBotName(data.name);
        setLoading(false);
    }, [botId, orgId, supabase, router]);

    useEffect(() => {
        if (orgId && botId) loadBot();
    }, [orgId, botId, loadBot]);

    function copyToClipboard(text: string, method: string) {
        navigator.clipboard.writeText(text);
        setCopiedMethod(method);
        toast.success("Código copiado al portapapeles");
        setTimeout(() => setCopiedMethod(null), 2000);
    }

    const scriptSnippet = `<!-- Bot Widget - ${botName} -->
<script
  src="${appUrl}/embed/bot-loader.js"
  data-org-id="${orgId}"
  data-bot-id="${botId}"
  defer>
</script>`;

    const iframeSnippet = `<!-- Bot Widget - ${botName} -->
<iframe
  src="${appUrl}/embed/${orgId}?botId=${botId}"
  style="
    position: fixed;
    bottom: 0;
    right: 0;
    width: 400px;
    height: 600px;
    border: none;
    z-index: 9999;
  "
  allow="clipboard-write"
  title="${botName}">
</iframe>`;

    const reactSnippet = `// Componente React para embeber el bot
function BotWidget() {
  return (
    <iframe
      src="${appUrl}/embed/${orgId}?botId=${botId}"
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: 400,
        height: 600,
        border: 'none',
        zIndex: 9999,
      }}
      allow="clipboard-write"
      title="${botName}"
    />
  );
}

// Uso: <BotWidget />`;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/soporte/bot/${botId}`)}
                    className="gap-1"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Volver al Editor
                </Button>
                <div className="h-6 w-px bg-border" />
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Integrar Bot</h1>
                    <p className="text-sm text-muted-foreground">
                        Agrega <strong>{botName}</strong> a tu sitio web con cualquiera de estos métodos
                    </p>
                </div>
            </div>

            {/* Quick Preview Link */}
            <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <ExternalLink className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">Probar el bot en vivo</p>
                            <p className="text-xs text-muted-foreground">
                                Abre el widget en una pestaña nueva para ver cómo queda
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`${appUrl}/embed/${orgId}?botId=${botId}`, "_blank")}
                        className="gap-1"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                    </Button>
                </CardContent>
            </Card>

            {/* Integration Methods */}
            <Tabs defaultValue="script">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="script" className="gap-1.5">
                        <Zap className="h-3.5 w-3.5" />
                        Script Tag
                    </TabsTrigger>
                    <TabsTrigger value="iframe" className="gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        Iframe
                    </TabsTrigger>
                    <TabsTrigger value="react" className="gap-1.5">
                        <Blocks className="h-3.5 w-3.5" />
                        React
                    </TabsTrigger>
                </TabsList>

                {/* Script Tag */}
                <TabsContent value="script">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base">Script Tag</CardTitle>
                                <Badge className="bg-green-500 text-xs">Recomendado</Badge>
                            </div>
                            <CardDescription>
                                La forma más sencilla de integrar el bot. Pega este código antes del cierre del{" "}
                                <code className="bg-muted px-1 py-0.5 rounded text-xs">&lt;/body&gt;</code> de tu sitio.
                                El script carga el widget automáticamente y lo posiciona en la esquina configurada.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <pre className="bg-slate-950 text-slate-50 rounded-xl p-5 text-sm font-mono overflow-x-auto leading-relaxed">
                                    <code>{scriptSnippet}</code>
                                </pre>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="absolute top-3 right-3 gap-1 text-xs"
                                    onClick={() => copyToClipboard(scriptSnippet, "script")}
                                >
                                    {copiedMethod === "script" ? (
                                        <>
                                            <Check className="h-3 w-3" />
                                            Copiado
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3 w-3" />
                                            Copiar
                                        </>
                                    )}
                                </Button>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-medium">✅ Ventajas</p>
                                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Una sola línea de código</li>
                                    <li>Se carga de forma asíncrona (no bloquea tu página)</li>
                                    <li>Se actualiza automáticamente con los cambios que hagas al bot</li>
                                    <li>Compatible con cualquier sitio web (WordPress, Shopify, HTML estático, etc.)</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Iframe */}
                <TabsContent value="iframe">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Iframe</CardTitle>
                            <CardDescription>
                                Embebe el bot directamente con un iframe. Útil si necesitas más control sobre el
                                posicionamiento o si tu plataforma no permite scripts externos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <pre className="bg-slate-950 text-slate-50 rounded-xl p-5 text-sm font-mono overflow-x-auto leading-relaxed">
                                    <code>{iframeSnippet}</code>
                                </pre>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="absolute top-3 right-3 gap-1 text-xs"
                                    onClick={() => copyToClipboard(iframeSnippet, "iframe")}
                                >
                                    {copiedMethod === "iframe" ? (
                                        <>
                                            <Check className="h-3 w-3" />
                                            Copiado
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3 w-3" />
                                            Copiar
                                        </>
                                    )}
                                </Button>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-medium">💡 Cuándo usar iframe</p>
                                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Tu plataforma no permite scripts externos (ej: algunas configuraciones de WordPress)</li>
                                    <li>Querés posicionar el widget en un lugar personalizado</li>
                                    <li>Necesitás ajustar las dimensiones exactas</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* React */}
                <TabsContent value="react">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Componente React</CardTitle>
                            <CardDescription>
                                Si tu sitio está construido con React, Next.js o frameworks similares, usá este
                                componente directamente en tu código.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <pre className="bg-slate-950 text-slate-50 rounded-xl p-5 text-sm font-mono overflow-x-auto leading-relaxed">
                                    <code>{reactSnippet}</code>
                                </pre>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="absolute top-3 right-3 gap-1 text-xs"
                                    onClick={() => copyToClipboard(reactSnippet, "react")}
                                >
                                    {copiedMethod === "react" ? (
                                        <>
                                            <Check className="h-3 w-3" />
                                            Copiado
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3 w-3" />
                                            Copiar
                                        </>
                                    )}
                                </Button>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-medium">⚛️ Uso en React</p>
                                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Agregá el componente en tu layout principal o en las páginas donde lo necesites</li>
                                    <li>Se renderiza como un iframe fixed — no afecta tu layout</li>
                                    <li>Podés condicionar su aparición con lógica de React</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
