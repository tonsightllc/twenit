"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, RotateCcw } from "lucide-react";
import type { BotNode } from "./bot-node-editor";

interface BotPreviewProps {
    treeConfig: { nodes: Record<string, BotNode>; startNode: string };
    styles: {
        primary_color: string;
        secondary_color: string;
        text_color: string;
        background_color: string;
        position: "bottom-right" | "bottom-left";
        welcome_message: string;
    };
    botName: string;
}

interface PreviewMessage {
    id: string;
    type: "bot" | "user";
    content: string;
    options?: { id: string; label: string; next: string }[];
}

export function BotPreview({ treeConfig, styles, botName }: BotPreviewProps) {
    const [messages, setMessages] = useState<PreviewMessage[]>([]);
    const [processing, setProcessing] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasStartedRef = useRef(false);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({
                    behavior: "smooth",
                    block: "end",
                });
            }
        }, 100);
    }, [messages, processing]);

    const processNode = useCallback((node: BotNode, currentMessages: PreviewMessage[]) => {
        const newMessage: PreviewMessage = {
            id: crypto.randomUUID(),
            type: "bot",
            content: node.content || "",
            options: node.type === "question" ? node.options : undefined,
        };

        const updatedMessages = [...currentMessages, newMessage];
        setMessages(updatedMessages);

        // For message type, auto-advance to next
        if (node.type === "message" && node.next && treeConfig.nodes[node.next]) {
            setProcessing(true);
            setTimeout(() => {
                setProcessing(false);
                processNode(treeConfig.nodes[node.next!], updatedMessages);
            }, 800);
        }

        // For stripe_action or api_call, simulate processing
        if ((node.type === "stripe_action" || node.type === "api_call") && node.next && treeConfig.nodes[node.next]) {
            setProcessing(true);
            setTimeout(() => {
                const resultMsg: PreviewMessage = {
                    id: crypto.randomUUID(),
                    type: "bot",
                    content: node.type === "stripe_action"
                        ? `✓ Acción "${node.stripe_action?.type}" procesada (simulación)`
                        : `✓ API call completado (simulación)`,
                };
                const withResult = [...updatedMessages, resultMsg];
                setMessages(withResult);
                setProcessing(false);

                if (node.next && treeConfig.nodes[node.next]) {
                    setTimeout(() => processNode(treeConfig.nodes[node.next!], withResult), 500);
                }
            }, 1200);
        }
    }, [treeConfig]);

    const startConversation = useCallback(() => {
        setMessages([]);
        setProcessing(false);

        const startNode = treeConfig.nodes[treeConfig.startNode];
        if (startNode) {
            setTimeout(() => processNode(startNode, []), 300);
        }
    }, [treeConfig, processNode]);

    // Start conversation when the component mounts or tree changes
    useEffect(() => {
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            startConversation();
        }
    }, [startConversation]);

    function handleOptionClick(option: { id: string; label: string; next: string }) {
        const userMsg: PreviewMessage = {
            id: crypto.randomUUID(),
            type: "user",
            content: option.label,
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);

        if (option.next && treeConfig.nodes[option.next]) {
            setTimeout(() => {
                processNode(treeConfig.nodes[option.next], updatedMessages);
            }, 500);
        }
    }

    function handleReset() {
        hasStartedRef.current = false;
        setMessages([]);
        setProcessing(false);
        setTimeout(() => {
            hasStartedRef.current = true;
            startConversation();
        }, 100);
    }

    const primaryColor = styles.primary_color || "#0070f3";
    const bgColor = styles.background_color || "#ffffff";
    const textColor = styles.text_color || "#1a1a1a";

    return (
        <div className="h-full flex flex-col">
            {/* Preview label */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Preview en Vivo
                </span>
                <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <RotateCcw className="h-3 w-3" />
                    Reiniciar
                </button>
            </div>

            {/* Simulated webpage background */}
            <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                {/* Fake page content */}
                <div className="p-6 opacity-30 select-none pointer-events-none">
                    <div className="h-6 w-48 bg-slate-300 dark:bg-slate-600 rounded mb-4" />
                    <div className="h-3 w-full bg-slate-300/70 dark:bg-slate-600/70 rounded mb-2" />
                    <div className="h-3 w-4/5 bg-slate-300/70 dark:bg-slate-600/70 rounded mb-2" />
                    <div className="h-3 w-3/5 bg-slate-300/70 dark:bg-slate-600/70 rounded mb-6" />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="h-24 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg" />
                        <div className="h-24 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg" />
                    </div>
                </div>

                {/* Chat Widget */}
                <div
                    className="absolute bottom-4 z-10"
                    style={{ [styles.position === "bottom-left" ? "left" : "right"]: "16px" }}
                >
                    {isOpen && (
                        <div
                            className="mb-3 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
                            style={{ width: "320px", backgroundColor: bgColor }}
                        >
                            {/* Widget Header */}
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <div className="flex items-center gap-2 text-white">
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="font-medium text-sm">{botName || "Bot"}</span>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-white/70 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Widget Messages */}
                            <div
                                className="px-3 py-3 overflow-y-auto"
                                style={{ height: "300px", color: textColor }}
                            >
                                <div className="space-y-3">
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"} animate-in fade-in-50 duration-200`}
                                        >
                                            <div
                                                className={`max-w-[85%] rounded-xl px-3.5 py-2 text-[13px] leading-relaxed ${message.type === "user"
                                                    ? "text-white rounded-br-sm"
                                                    : "bg-gray-100 dark:bg-gray-800 rounded-bl-sm"
                                                    }`}
                                                style={{
                                                    backgroundColor: message.type === "user" ? primaryColor : undefined,
                                                }}
                                            >
                                                <p>{message.content}</p>
                                                {message.options && (
                                                    <div className="mt-2.5 space-y-1.5">
                                                        {message.options.map((option) => (
                                                            <button
                                                                key={option.id}
                                                                onClick={() => handleOptionClick(option)}
                                                                className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] transition-all border hover:scale-[1.02] active:scale-[0.98]"
                                                                style={{
                                                                    borderColor: primaryColor,
                                                                    color: primaryColor,
                                                                }}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {processing && (
                                        <div className="flex justify-start animate-in fade-in-50">
                                            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2.5">
                                                <div className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* Widget Footer */}
                            <div className="px-3 py-2 border-t flex justify-between items-center">
                                <button
                                    onClick={handleReset}
                                    className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    Reiniciar conversación
                                </button>
                                <span className="text-[10px] text-gray-300">Powered by Twenit</span>
                            </div>
                        </div>
                    )}

                    {/* Toggle Button */}
                    <button
                        onClick={() => {
                            setIsOpen(!isOpen);
                            if (!isOpen && messages.length === 0) {
                                setTimeout(() => startConversation(), 300);
                            }
                        }}
                        className="rounded-full p-3.5 shadow-lg transition-all hover:scale-110 active:scale-95"
                        style={{ backgroundColor: primaryColor }}
                    >
                        {isOpen ? (
                            <X className="h-5 w-5 text-white" />
                        ) : (
                            <MessageSquare className="h-5 w-5 text-white" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
