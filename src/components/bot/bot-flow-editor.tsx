"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BotNodeEditor, nodeTypeConfig } from "./bot-node-editor";
import type { BotNode } from "./bot-node-editor";
import {
    Plus,
    ArrowDown,
    MousePointer,
    Sparkles,
} from "lucide-react";

interface BotFlowEditorProps {
    treeConfig: { nodes: Record<string, BotNode>; startNode: string };
    onChange: (treeConfig: { nodes: Record<string, BotNode>; startNode: string }) => void;
}

export function BotFlowEditor({ treeConfig, onChange }: BotFlowEditorProps) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const updateNode = useCallback((node: BotNode) => {
        const newNodes = { ...treeConfig.nodes, [node.id]: node };
        onChange({ ...treeConfig, nodes: newNodes });
    }, [treeConfig, onChange]);

    const deleteNode = useCallback((id: string) => {
        if (id === treeConfig.startNode || id === "end") return;

        const newNodes = { ...treeConfig.nodes };
        delete newNodes[id];

        // Clean up references to this node
        Object.values(newNodes).forEach((node) => {
            if (node.next === id) {
                node.next = "";
            }
            if (node.options) {
                node.options = node.options.map((opt) =>
                    opt.next === id ? { ...opt, next: "" } : opt
                );
            }
        });

        onChange({ ...treeConfig, nodes: newNodes });
        setSelectedNodeId(null);
    }, [treeConfig, onChange]);

    const addNode = useCallback(() => {
        const nodeCount = Object.keys(treeConfig.nodes).length;
        const id = `node_${nodeCount}_${Date.now().toString(36)}`;
        const newNode: BotNode = {
            id,
            type: "message",
            content: "Nuevo mensaje",
            next: "",
        };

        const newNodes = { ...treeConfig.nodes, [id]: newNode };
        onChange({ ...treeConfig, nodes: newNodes });
        setSelectedNodeId(id);
    }, [treeConfig, onChange]);

    // Build ordered list from the tree
    const orderedNodes = useMemo(() => {
        const visited = new Set<string>();
        const ordered: BotNode[] = [];

        function walk(nodeId: string) {
            if (!nodeId || visited.has(nodeId) || !treeConfig.nodes[nodeId]) return;
            visited.add(nodeId);
            const node = treeConfig.nodes[nodeId];
            ordered.push(node);

            if (node.type === "question" && node.options) {
                node.options.forEach((opt) => walk(opt.next));
            } else if (node.next) {
                walk(node.next);
            }
        }

        walk(treeConfig.startNode);

        // Add any orphaned nodes
        Object.keys(treeConfig.nodes).forEach((id) => {
            if (!visited.has(id)) {
                ordered.push(treeConfig.nodes[id]);
            }
        });

        return ordered;
    }, [treeConfig]);

    // Find which nodes point to a given node
    const getIncomingConnections = useCallback((nodeId: string) => {
        const incoming: string[] = [];
        Object.values(treeConfig.nodes).forEach((node) => {
            if (node.next === nodeId) incoming.push(node.id);
            if (node.options?.some((opt) => opt.next === nodeId)) incoming.push(node.id);
        });
        return incoming;
    }, [treeConfig]);

    const selectedNode = selectedNodeId ? treeConfig.nodes[selectedNodeId] : null;

    return (
        <div className="h-full flex">
            {/* Flow Canvas */}
            <div className="flex-1 overflow-y-auto">
                {/* Toolbar */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Editor de Flujo</span>
                        <Badge variant="outline" className="text-xs">
                            {Object.keys(treeConfig.nodes).length} nodos
                        </Badge>
                    </div>
                    <Button onClick={addNode} size="sm" className="h-8 gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        Agregar Nodo
                    </Button>
                </div>

                {/* Node List */}
                <div className="p-6">
                    <div className="max-w-lg mx-auto space-y-1">
                        {orderedNodes.map((node, index) => {
                            const config = nodeTypeConfig[node.type];
                            const Icon = config.icon;
                            const isSelected = selectedNodeId === node.id;
                            const isStart = node.id === treeConfig.startNode;
                            const isOrphaned = !isStart && getIncomingConnections(node.id).length === 0;

                            return (
                                <div key={node.id}>
                                    {/* Connection Line */}
                                    {index > 0 && (
                                        <div className="flex justify-center py-1">
                                            <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
                                        </div>
                                    )}

                                    {/* Node Card */}
                                    <button
                                        onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                                        className={`w-full text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${isSelected
                                            ? "border-primary shadow-md ring-2 ring-primary/20"
                                            : isOrphaned
                                                ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                                                : "border-border hover:border-primary/30"
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
                                                <Icon className={`h-4 w-4 ${config.color}`} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-xs text-muted-foreground">
                                                        {node.id}
                                                    </span>
                                                    {/* Incoming connections indicator */}
                                                    {getIncomingConnections(node.id).length > 0 && (
                                                        <div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded-md bg-muted/50 text-[10px] text-muted-foreground border border-border/50" title={`Incoming from: ${getIncomingConnections(node.id).join(", ")}`}>
                                                            <span className="opacity-70">↳</span>
                                                            <span className="truncate max-w-[80px]">
                                                                {getIncomingConnections(node.id).length > 2
                                                                    ? `${getIncomingConnections(node.id).length} links`
                                                                    : getIncomingConnections(node.id).join(", ")}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                        {config.label}
                                                    </Badge>
                                                    {isStart && (
                                                        <Badge className="text-[10px] px-1.5 py-0 bg-green-500">
                                                            Inicio
                                                        </Badge>
                                                    )}
                                                    {isOrphaned && (
                                                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                                            Sin conexión
                                                        </Badge>
                                                    )}
                                                </div>

                                                <p className="text-sm truncate" title={node.content}>
                                                    {node.content || <span className="text-muted-foreground italic">Sin contenido</span>}
                                                </p>

                                                {/* Options preview */}
                                                {node.type === "question" && node.options && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {node.options.map((opt) => (
                                                            <span
                                                                key={opt.id}
                                                                className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${opt.next ? "bg-muted" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600"
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                                {opt.next && (
                                                                    <span className="ml-1 text-muted-foreground">→ {opt.next}</span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Next preview (non-question) */}
                                                {node.type !== "question" && node.type !== "end" && (
                                                    <div className="mt-1">
                                                        {node.next ? (
                                                            <span className="text-[11px] text-muted-foreground">
                                                                → {node.next}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-red-500">
                                                                ⚠ Sin nodo siguiente
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Stripe action badge */}
                                                {node.type === "stripe_action" && node.stripe_action && (
                                                    <Badge variant="outline" className="mt-1 text-[10px]">
                                                        {node.stripe_action.type.replace(/_/g, " ")}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Selection indicator */}
                                            <MousePointer
                                                className={`h-3.5 w-3.5 shrink-0 transition-opacity ${isSelected ? "opacity-100 text-primary" : "opacity-0"
                                                    }`}
                                            />
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Node Editor Panel */}
            {selectedNode && (
                <div className="w-80 border-l bg-background shrink-0 overflow-hidden">
                    <BotNodeEditor
                        key={selectedNode.id}
                        node={selectedNode}
                        allNodes={treeConfig.nodes}
                        onChange={updateNode}
                        onClose={() => setSelectedNodeId(null)}
                        onDelete={deleteNode}
                    />
                </div>
            )}
        </div>
    );
}
