"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MessageSquare, X, Loader2 } from "lucide-react";

interface BotNode {
  id: string;
  type: "message" | "question" | "api_call" | "stripe_action" | "end";
  content?: string;
  options?: { id: string; label: string; next: string }[];
  api_config?: {
    url: string;
    method: "GET" | "POST";
  };
  stripe_action?: {
    type: string;
  };
  next?: string;
}

interface BotConfig {
  id: string;
  name: string;
  tree_config: { nodes: Record<string, BotNode>; startNode: string };
  styles: {
    primary_color: string;
    secondary_color: string;
    text_color: string;
    background_color: string;
    position: "bottom-right" | "bottom-left";
    welcome_message: string;
  };
}

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  options?: { id: string; label: string; next: string }[];
}

export default function BotWidgetPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const botId = searchParams.get("botId");

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [, setCurrentNode] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadBot = useCallback(async () => {
    try {
      const response = await fetch(`/api/bot?orgId=${orgId}${botId ? `&botId=${botId}` : ""}`);
      const data = await response.json();
      
      if (data) {
        setBotConfig(data);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading bot:", error);
      setLoading(false);
    }
  }, [orgId, botId]);

  useEffect(() => {
    loadBot();
  }, [loadBot]);

  function startConversation() {
    if (!botConfig?.tree_config) return;
    
    const startNode = botConfig.tree_config.startNode;
    const node = botConfig.tree_config.nodes[startNode];
    
    if (node) {
      processNode(node);
    }
  }

  function processNode(node: BotNode) {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      type: "bot",
      content: node.content || "",
      options: node.type === "question" ? node.options : undefined,
    };

    setMessages((prev) => [...prev, newMessage]);
    setCurrentNode(node.id);

    if (node.type === "message" && node.next) {
      // Delay before showing next message
      setTimeout(() => {
        const nextNode = botConfig?.tree_config.nodes[node.next!];
        if (nextNode) {
          processNode(nextNode);
        }
      }, 1000);
    }

    if (node.type === "api_call" && node.api_config) {
      handleApiCall(node);
    }

    if (node.type === "stripe_action" && node.stripe_action) {
      handleStripeAction(node);
    }
  }

  async function handleApiCall(node: BotNode) {
    setProcessing(true);
    try {
      const response = await fetch(node.api_config!.url, {
        method: node.api_config!.method,
      });
      const data = await response.json();
      
      // Add result message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "bot",
          content: `Resultado: ${JSON.stringify(data)}`,
        },
      ]);

      if (node.next) {
        const nextNode = botConfig?.tree_config.nodes[node.next];
        if (nextNode) {
          processNode(nextNode);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "bot",
          content: "Hubo un error al procesar la solicitud.",
        },
      ]);
    }
    setProcessing(false);
  }

  async function handleStripeAction(node: BotNode) {
    setProcessing(true);
    // In production, this would call the Stripe API via our backend
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "bot",
          content: `Acción "${node.stripe_action?.type}" procesada.`,
        },
      ]);
      
      if (node.next) {
        const nextNode = botConfig?.tree_config.nodes[node.next];
        if (nextNode) {
          processNode(nextNode);
        }
      }
      setProcessing(false);
    }, 1500);
  }

  function handleOptionClick(option: { id: string; label: string; next: string }) {
    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "user",
        content: option.label,
      },
    ]);

    // Process next node
    const nextNode = botConfig?.tree_config.nodes[option.next];
    if (nextNode) {
      setTimeout(() => {
        processNode(nextNode);
      }, 500);
    }
  }

  function handleOpen() {
    setIsOpen(true);
    if (messages.length === 0) {
      startConversation();
    }
  }

  function handleClose() {
    setIsOpen(false);
  }

  function handleReset() {
    setMessages([]);
    setCurrentNode(null);
    startConversation();
  }

  if (loading) {
    return null;
  }

  if (!botConfig) {
    return null;
  }

  const styles = botConfig.styles || {
    primary_color: "#0070f3",
    background_color: "#ffffff",
    text_color: "#1a1a1a",
    position: "bottom-right",
  };

  return (
    <div className="fixed bottom-4 z-50" style={{ [styles.position === "bottom-left" ? "left" : "right"]: "16px" }}>
      {/* Chat Window */}
      {isOpen && (
        <div
          className="mb-4 rounded-xl shadow-2xl overflow-hidden"
          style={{
            width: "360px",
            maxHeight: "500px",
            backgroundColor: styles.background_color,
          }}
        >
          {/* Header */}
          <div
            className="p-4 flex items-center justify-between"
            style={{ backgroundColor: styles.primary_color }}
          >
            <div className="flex items-center gap-2 text-white">
              <MessageSquare className="h-5 w-5" />
              <span className="font-medium">{botConfig.name}</span>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="p-4 overflow-y-auto"
            style={{ height: "350px", color: styles.text_color }}
          >
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.type === "user"
                        ? "text-white"
                        : "bg-gray-100"
                    }`}
                    style={{
                      backgroundColor: message.type === "user" ? styles.primary_color : undefined,
                    }}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.options && (
                      <div className="mt-3 space-y-2">
                        {message.options.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => handleOptionClick(option)}
                            className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors border hover:bg-gray-200"
                            style={{
                              borderColor: styles.primary_color,
                              color: styles.primary_color,
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
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t flex justify-between items-center">
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Reiniciar conversación
            </button>
            <span className="text-xs text-gray-400">
              Powered by Twenit
            </span>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={isOpen ? handleClose : handleOpen}
        className="rounded-full p-4 shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: styles.primary_color }}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageSquare className="h-6 w-6 text-white" />
        )}
      </button>
    </div>
  );
}
