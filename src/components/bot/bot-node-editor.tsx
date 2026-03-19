"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    MessageSquare,
    HelpCircle,
    Webhook,
    CreditCard,
    CircleOff,
    Plus,
    Trash2,
    X,
    GripVertical,
} from "lucide-react";

export interface BotNode {
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

interface BotNodeEditorProps {
    node: BotNode;
    allNodes: Record<string, BotNode>;
    onChange: (node: BotNode) => void;
    onClose: () => void;
    onDelete: (id: string) => void;
}

const nodeTypeConfig = {
    message: { label: "Mensaje", icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
    question: { label: "Pregunta", icon: HelpCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    api_call: { label: "API Call", icon: Webhook, color: "text-purple-500", bg: "bg-purple-500/10" },
    stripe_action: { label: "Acción Stripe", icon: CreditCard, color: "text-orange-500", bg: "bg-orange-500/10" },
    end: { label: "Fin", icon: CircleOff, color: "text-gray-500", bg: "bg-gray-500/10" },
};

export function BotNodeEditor({ node, allNodes, onChange, onClose, onDelete }: BotNodeEditorProps) {
    const [localNode, setLocalNode] = useState<BotNode>({ ...node });
    const config = nodeTypeConfig[localNode.type];
    const Icon = config.icon;

    function updateNode(updates: Partial<BotNode>) {
        const updated = { ...localNode, ...updates };
        setLocalNode(updated);
        onChange(updated);
    }

    function handleTypeChange(type: BotNode["type"]) {
        const updated: BotNode = {
            ...localNode,
            type,
            options: type === "question" ? (localNode.options || [{ id: crypto.randomUUID(), label: "Opción 1", next: "" }]) : undefined,
            api_config: type === "api_call" ? (localNode.api_config || { url: "", method: "GET" }) : undefined,
            stripe_action: type === "stripe_action" ? (localNode.stripe_action || { type: "cancel_subscription" }) : undefined,
            next: type !== "question" ? (localNode.next || "") : undefined,
        };
        setLocalNode(updated);
        onChange(updated);
    }

    function addOption() {
        const options = [...(localNode.options || []), { id: crypto.randomUUID(), label: `Opción ${(localNode.options?.length || 0) + 1}`, next: "" }];
        updateNode({ options });
    }

    function updateOption(index: number, updates: Partial<{ label: string; next: string }>) {
        const options = [...(localNode.options || [])];
        options[index] = { ...options[index], ...updates };
        updateNode({ options });
    }

    function removeOption(index: number) {
        const options = (localNode.options || []).filter((_, i) => i !== index);
        updateNode({ options });
    }

    const otherNodeIds = Object.keys(allNodes).filter((id) => id !== localNode.id);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <h3 className="font-semibold text-sm">Editar Nodo</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Node ID */}
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">ID del Nodo</Label>
                    <code className="block text-xs bg-muted px-2 py-1.5 rounded font-mono">{localNode.id}</code>
                </div>

                {/* Type */}
                <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de Nodo</Label>
                    <Select value={localNode.type} onValueChange={(v) => handleTypeChange(v as BotNode["type"])}>
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(nodeTypeConfig).map(([key, cfg]) => (
                                <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                        <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                                        {cfg.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Separator />

                {/* Content */}
                <div className="space-y-1.5">
                    <Label className="text-xs">Contenido / Mensaje</Label>
                    <textarea
                        value={localNode.content || ""}
                        onChange={(e) => updateNode({ content: e.target.value })}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                        placeholder="Escribe el mensaje del bot..."
                    />
                </div>

                {/* Question Options */}
                {localNode.type === "question" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Opciones de Respuesta</Label>
                            <Button variant="outline" size="sm" onClick={addOption} className="h-7 text-xs gap-1">
                                <Plus className="h-3 w-3" />
                                Agregar
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {(localNode.options || []).map((option, idx) => (
                                <div key={option.id} className="group border rounded-lg p-3 space-y-2 bg-muted/30">
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                                        <Input
                                            value={option.label}
                                            onChange={(e) => updateOption(idx, { label: e.target.value })}
                                            placeholder="Texto del botón"
                                            className="h-8 text-sm flex-1"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeOption(idx)}
                                            className="h-7 w-7 p-0 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="pl-5">
                                        <Select value={option.next || "_none"} onValueChange={(v) => updateOption(idx, { next: v === "_none" ? "" : v })}>
                                            <SelectTrigger className="h-7 text-xs">
                                                <SelectValue placeholder="→ Siguiente nodo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="_none">
                                                    <span className="text-muted-foreground">Sin conexión</span>
                                                </SelectItem>
                                                {otherNodeIds.map((id) => (
                                                    <SelectItem key={id} value={id}>
                                                        <span className="font-mono text-xs">{id}</span>
                                                        <span className="text-muted-foreground ml-1 text-xs">
                                                            ({nodeTypeConfig[allNodes[id].type]?.label})
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Next node (for non-question types) */}
                {localNode.type !== "question" && localNode.type !== "end" && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">Siguiente Nodo</Label>
                        <Select value={localNode.next || "_none"} onValueChange={(v) => updateNode({ next: v === "_none" ? "" : v })}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="→ Siguiente nodo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none">
                                    <span className="text-muted-foreground">Sin conexión</span>
                                </SelectItem>
                                {otherNodeIds.map((id) => (
                                    <SelectItem key={id} value={id}>
                                        <span className="font-mono text-xs">{id}</span>
                                        <span className="text-muted-foreground ml-1 text-xs">
                                            ({nodeTypeConfig[allNodes[id].type]?.label})
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* API Config */}
                {localNode.type === "api_call" && (
                    <div className="space-y-3">
                        <Separator />
                        <Label className="text-xs font-medium">Configuración API</Label>
                        <div className="flex gap-2">
                            <Select
                                value={localNode.api_config?.method || "GET"}
                                onValueChange={(v) => updateNode({ api_config: { ...localNode.api_config!, method: v as "GET" | "POST" } })}
                            >
                                <SelectTrigger className="h-9 w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                value={localNode.api_config?.url || ""}
                                onChange={(e) => updateNode({ api_config: { ...localNode.api_config!, url: e.target.value } })}
                                placeholder="https://api.example.com/endpoint"
                                className="h-9 flex-1 font-mono text-xs"
                            />
                        </div>
                    </div>
                )}

                {/* Stripe Action */}
                {localNode.type === "stripe_action" && (
                    <div className="space-y-3">
                        <Separator />
                        <Label className="text-xs font-medium">Acción de Stripe</Label>
                        <Select
                            value={localNode.stripe_action?.type || "cancel_subscription"}
                            onValueChange={(v) => updateNode({ stripe_action: { ...localNode.stripe_action!, type: v as "cancel_subscription" | "pause_subscription" | "refund" } })}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cancel_subscription">Cancelar Suscripción</SelectItem>
                                <SelectItem value="pause_subscription">Pausar Suscripción</SelectItem>
                                <SelectItem value="refund">Emitir Refund</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t p-4">
                <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => onDelete(localNode.id)}
                    disabled={localNode.id === "welcome" || localNode.id === "end"}
                >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Eliminar Nodo
                </Button>
                {(localNode.id === "welcome" || localNode.id === "end") && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                        No se pueden eliminar los nodos inicio y fin
                    </p>
                )}
            </div>
        </div>
    );
}

export { nodeTypeConfig };
