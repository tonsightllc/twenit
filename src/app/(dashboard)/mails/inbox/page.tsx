"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Inbox, Send, Archive, Trash2, Star, Search, Forward, Mail, Clock,
  User, Bot, RefreshCw, Sparkles, Tag, ExternalLink, CreditCard,
  PauseCircle, AlertCircle, CheckCircle2, X, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface InboundEmail {
  id: string;
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_read: boolean;
  starred: boolean;
  classification: string | null;
  intent: string | null;
  ai_summary: string | null;
  status: string;
  labels: string[];
  customer_id: string | null;
  thread_id: string | null;
}

interface Customer {
  id: string;
  name: string | null;
  email: string;
  stripe_customer_id: string;
  activation_status: string;
}

interface EmailReply {
  id: string;
  to_email: string;
  subject: string;
  body_text: string;
  sent_by: string;
  is_auto_reply: boolean;
  sent_at: string;
}

interface EmailLabel {
  id: string;
  name: string;
  color: string;
}

interface MappedEmail {
  id: string;
  from: string;
  fromName: string;
  subject: string | null;
  preview: string;
  content: string;
  date: string;
  read: boolean;
  starred: boolean;
  classification: string | null;
  intent: string | null;
  aiSummary: string | null;
  status: string;
  labels: string[];
  customerId: string | null;
}

const categories = [
  { id: "all", name: "Todos" },
  { id: "soporte", name: "Soporte" },
  { id: "ventas", name: "Ventas" },
  { id: "facturación", name: "Facturación" },
  { id: "cancelación", name: "Cancelación" },
];

const classificationColors: Record<string, string> = {
  soporte: "bg-blue-500/10 text-blue-600 border-blue-200",
  ventas: "bg-green-500/10 text-green-600 border-green-200",
  "facturación": "bg-orange-500/10 text-orange-600 border-orange-200",
  "cancelación": "bg-red-500/10 text-red-600 border-red-200",
  otro: "bg-gray-500/10 text-gray-600 border-gray-200",
};

const intentLabels: Record<string, string> = {
  problema_acceso: "Acceso",
  cancelar_suscripcion: "Cancelar",
  solicitar_refund: "Refund",
  upgrade: "Upgrade",
  pregunta_general: "Consulta",
  queja: "Queja",
  otro: "Otro",
};

function mapDbEmail(dbEmail: InboundEmail): MappedEmail {
  const rawName = dbEmail.from_email.split("<")[0].replace(/"/g, "").trim();
  return {
    id: dbEmail.id,
    from: dbEmail.from_email,
    fromName: rawName || dbEmail.from_email,
    subject: dbEmail.subject,
    preview: dbEmail.body_text ? dbEmail.body_text.substring(0, 120) + "…" : "",
    content: dbEmail.body_text || dbEmail.body_html || "",
    date: dbEmail.received_at,
    read: dbEmail.is_read,
    starred: dbEmail.starred ?? false,
    classification: dbEmail.classification,
    intent: dbEmail.intent,
    aiSummary: dbEmail.ai_summary,
    status: dbEmail.status,
    labels: dbEmail.labels ?? [],
    customerId: dbEmail.customer_id,
  };
}

export default function InboxPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<MappedEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MappedEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [labels, setLabels] = useState<EmailLabel[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [replies, setReplies] = useState<EmailReply[]>([]);
  const [hasSmtp, setHasSmtp] = useState<boolean | null>(null);

  const supabase = createClient();

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("*")
        .not("status", "eq", "deleted")
        .order("received_at", { ascending: false });

      if (error) throw error;
      if (data) setEmails(data.map(mapDbEmail));
    } catch (error) {
      console.error("Error fetching emails:", error);
      toast.error("Error al cargar emails");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchLabels = useCallback(async () => {
    const res = await fetch("/api/emails/labels");
    if (res.ok) {
      const { labels } = await res.json();
      setLabels(labels ?? []);
    }
  }, []);

  const fetchEmailConfig = useCallback(async () => {
    const res = await fetch("/api/emails/config");
    if (res.ok) {
      const { config } = await res.json();
      const creds = config?.credentials;
      setHasSmtp(!!(creds?.smtp_host && creds?.smtp_user && creds?.smtp_pass));
    }
  }, []);

  useEffect(() => {
    fetchEmails();
    fetchLabels();
    fetchEmailConfig();

    const channel = supabase
      .channel("inbox-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "inbound_emails",
      }, (payload) => {
        const newEmail = mapDbEmail(payload.new as InboundEmail);
        setEmails((current) => [newEmail, ...current]);
        toast.success(`Nuevo email de ${newEmail.fromName}`);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchEmails, fetchLabels, supabase]);

  // Fetch customer when email selected
  const fetchCustomer = useCallback(async (email: MappedEmail) => {
    setCustomer(null);
    if (email.customerId) {
      const { data } = await supabase
        .from("customers")
        .select("id, name, email, stripe_customer_id, activation_status")
        .eq("id", email.customerId)
        .single();
      if (data) setCustomer(data);
      return;
    }

    // Try to match by from_email
    const senderEmail = email.from.replace(/.*<(.+)>/, "$1").trim();
    const { data } = await supabase
      .from("customers")
      .select("id, name, email, stripe_customer_id, activation_status")
      .eq("email", senderEmail)
      .maybeSingle();
    if (data) setCustomer(data);
  }, [supabase]);

  const fetchReplies = useCallback(async (emailId: string) => {
    const { data } = await supabase
      .from("email_replies")
      .select("id, to_email, subject, body_text, sent_by, is_auto_reply, sent_at")
      .eq("inbound_email_id", emailId)
      .order("sent_at", { ascending: true });
    setReplies(data ?? []);
  }, [supabase]);

  const selectEmail = useCallback(async (email: MappedEmail) => {
    setSelectedEmail(email);
    setReplyContent("");
    setReplies([]);
    fetchCustomer(email);
    fetchReplies(email.id);

    // Mark as read
    if (!email.read) {
      await fetch("/api/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: email.id, is_read: true }),
      });
      setEmails((current) =>
        current.map((e) => (e.id === email.id ? { ...e, read: true } : e))
      );
    }
  }, [fetchCustomer]);

  const toggleStar = async (email: MappedEmail, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !email.starred;
    setEmails((current) =>
      current.map((em) => (em.id === email.id ? { ...em, starred: newValue } : em))
    );
    if (selectedEmail?.id === email.id) {
      setSelectedEmail((prev) => prev ? { ...prev, starred: newValue } : prev);
    }
    await fetch("/api/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: email.id, starred: newValue }),
    });
  };

  const archiveEmail = async (emailId: string) => {
    await fetch("/api/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: emailId, status: "archived" }),
    });
    setEmails((current) => current.filter((e) => e.id !== emailId));
    if (selectedEmail?.id === emailId) setSelectedEmail(null);
    toast.success("Email archivado");
  };

  const deleteEmail = async (emailId: string) => {
    await fetch("/api/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: emailId, status: "deleted" }),
    });
    setEmails((current) => current.filter((e) => e.id !== emailId));
    if (selectedEmail?.id === emailId) setSelectedEmail(null);
    toast.success("Email eliminado");
  };

  const handleReply = async () => {
    if (!selectedEmail || !replyContent.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/emails/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: selectedEmail.id, body: replyContent }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Respuesta enviada`);
        setReplyContent("");
        if (data.reply) {
          setReplies((prev) => [...prev, data.reply]);
        }
      } else {
        toast.error(data.error ?? "Error al enviar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSending(false);
    }
  };

  const handleClassify = async () => {
    if (!selectedEmail) return;
    setClassifying(true);
    try {
      const res = await fetch("/api/emails/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: selectedEmail.id }),
      });
      const data = await res.json();
      if (res.ok) {
        const { classification } = data;
        setSelectedEmail((prev) =>
          prev
            ? {
                ...prev,
                classification: classification.classification,
                intent: classification.intent,
                aiSummary: classification.summary,
              }
            : prev
        );
        setEmails((current) =>
          current.map((e) =>
            e.id === selectedEmail.id
              ? { ...e, classification: classification.classification, intent: classification.intent }
              : e
          )
        );
        toast.success("Email clasificado con IA");
      } else {
        toast.error(data.error ?? "Error al clasificar");
      }
    } finally {
      setClassifying(false);
    }
  };

  const handleSuggestReply = async () => {
    if (!selectedEmail) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/emails/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: selectedEmail.id }),
      });
      const data = await res.json();
      if (res.ok && data.available) {
        setReplyContent(data.suggestion);
        toast.success("Sugerencia generada por IA");
      } else {
        toast.error(data.error ?? "IA no disponible");
      }
    } finally {
      setSuggesting(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    if (!selectedEmail) return;
    setActionLoading(action);
    try {
      const res = await fetch("/api/emails/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: selectedEmail.id, action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (action === "view_stripe" && data.url) {
          window.open(data.url, "_blank");
        } else {
          toast.success(data.message ?? "Acción ejecutada");
        }
      } else {
        toast.error(data.error ?? "Error al ejecutar acción");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const toggleLabel = async (label: string) => {
    if (!selectedEmail) return;
    const currentLabels = selectedEmail.labels ?? [];
    const newLabels = currentLabels.includes(label)
      ? currentLabels.filter((l) => l !== label)
      : [...currentLabels, label];

    await fetch("/api/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedEmail.id, labels: newLabels }),
    });
    setSelectedEmail((prev) => prev ? { ...prev, labels: newLabels } : prev);
    setEmails((current) =>
      current.map((e) => (e.id === selectedEmail.id ? { ...e, labels: newLabels } : e))
    );
  };

  const filteredEmails = emails.filter((email) => {
    const matchesSearch =
      email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.fromName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.preview?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" ||
      email.classification?.toLowerCase() === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const unreadCount = emails.filter((e) => !e.read).length;

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Inbox
            {unreadCount > 0 && (
              <Badge className="text-sm">{unreadCount} nuevos</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Gestiona los emails de tus clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchEmails} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button onClick={() => router.push("/mails/config")}>
            <Mail className="mr-2 h-4 w-4" />
            Configurar Email
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-3 flex-1 min-h-0">
        {/* Left: email list */}
        <div className="lg:col-span-1 flex flex-col min-h-0 space-y-3">
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Email list */}
          <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
            {loading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Cargando...
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <Inbox className="h-10 w-10 mb-3 opacity-30" />
                <p>No hay emails</p>
              </div>
            ) : (
              filteredEmails.map((email) => (
                <Card
                  key={email.id}
                  className={`cursor-pointer transition-all hover:shadow-sm ${
                    selectedEmail?.id === email.id ? "border-primary shadow-sm" : ""
                  } ${!email.read ? "border-l-4 border-l-primary" : ""}`}
                  onClick={() => selectEmail(email)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm truncate ${!email.read ? "font-semibold" : "font-medium"}`}>
                            {email.fromName}
                          </span>
                          <button
                            onClick={(e) => toggleStar(email, e)}
                            className="shrink-0 text-muted-foreground hover:text-yellow-500 transition-colors"
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${email.starred ? "text-yellow-500 fill-yellow-500" : ""}`}
                            />
                          </button>
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${!email.read ? "text-foreground" : "text-muted-foreground"}`}>
                          {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {email.preview}
                        </p>
                        {/* Labels + classification */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {email.classification && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${classificationColors[email.classification] ?? ""}`}
                            >
                              {email.classification}
                            </Badge>
                          )}
                          {email.labels?.map((label) => (
                            <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 shrink-0">
                        {formatDate(email.date)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right: email detail */}
        <div className="lg:col-span-2 min-h-0 overflow-hidden">
          {selectedEmail ? (
            <Card className="h-full flex flex-col overflow-hidden">
              {/* Email header */}
              <CardHeader className="border-b shrink-0 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg leading-tight">{selectedEmail.subject}</CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium">{selectedEmail.fromName}</span>
                        <span className="text-xs opacity-70">{selectedEmail.from}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{new Date(selectedEmail.date).toLocaleString("es-AR")}</span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleStar(selectedEmail, { stopPropagation: () => {} } as React.MouseEvent)}
                    >
                      <Star className={`h-4 w-4 ${selectedEmail.starred ? "text-yellow-500 fill-yellow-500" : ""}`} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      title="Archivar"
                      onClick={() => archiveEmail(selectedEmail.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Eliminar"
                      onClick={() => deleteEmail(selectedEmail.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* AI Classification bar */}
                <div className="flex items-center gap-3 mt-3 p-3 bg-muted/50 rounded-lg">
                  <Bot className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    {selectedEmail.classification ? (
                      <>
                        <Badge variant="outline" className={classificationColors[selectedEmail.classification]}>
                          {selectedEmail.classification}
                        </Badge>
                        {selectedEmail.intent && (
                          <Badge variant="secondary">{intentLabels[selectedEmail.intent] ?? selectedEmail.intent}</Badge>
                        )}
                        {selectedEmail.aiSummary && (
                          <span className="text-xs text-muted-foreground italic">{selectedEmail.aiSummary}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin clasificar</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={handleClassify}
                    disabled={classifying}
                  >
                    {classifying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    Clasificar
                  </Button>
                </div>

                {/* Labels row */}
                <div className="flex items-center gap-2 mt-2 relative">
                  <div className="flex flex-wrap gap-1 flex-1">
                    {selectedEmail.labels?.map((label) => (
                      <Badge key={label} variant="secondary" className="gap-1 text-xs">
                        {label}
                        <button onClick={() => toggleLabel(label)} className="hover:opacity-70">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowLabelPicker((v) => !v)}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    Etiquetar
                  </Button>
                  {showLabelPicker && labels.length > 0 && (
                    <div className="absolute top-8 right-0 z-10 bg-popover border rounded-lg shadow-lg p-2 min-w-[160px]">
                      {labels.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => { toggleLabel(l.name); setShowLabelPicker(false); }}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted"
                        >
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>

              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Conversation thread + reply */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Original inbound email */}
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                        {selectedEmail.fromName[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium">{selectedEmail.fromName}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(selectedEmail.date).toLocaleString("es-AR")}
                          </span>
                        </div>
                        <div className="mt-1.5 p-3 rounded-lg bg-muted/50 border">
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {selectedEmail.content}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {replies.map((reply) => (
                      <div key={reply.id} className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Send className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium text-primary">
                              {reply.is_auto_reply ? "Respuesta automática" : "Tú"}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(reply.sent_at).toLocaleString("es-AR")}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              → {reply.to_email}
                            </span>
                          </div>
                          <div className="mt-1.5 p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                              {reply.body_text}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply input */}
                  <div className="border-t p-4 shrink-0 space-y-3">
                    {hasSmtp === false && (
                      <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Las respuestas se envían desde twenit.com. Para enviar desde tu propio email,{" "}
                          <a href="/mails/config" className="font-medium underline hover:no-underline">
                            configurá tu conexión SMTP
                          </a>.
                        </span>
                      </div>
                    )}
                    <textarea
                      className="w-full min-h-[90px] p-3 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Escribí tu respuesta..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={handleSuggestReply}
                          disabled={suggesting}
                        >
                          {suggesting
                            ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            : <Sparkles className="h-3 w-3 mr-1" />}
                          Sugerir con IA
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Forward className="mr-1.5 h-3.5 w-3.5" />
                          Reenviar
                        </Button>
                        <Button size="sm" onClick={handleReply} disabled={sending || !replyContent.trim()}>
                          {sending
                            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            : <Send className="mr-1.5 h-3.5 w-3.5" />}
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer sidebar */}
                <div className="w-56 border-l bg-muted/20 flex flex-col shrink-0 overflow-y-auto">
                  <div className="p-4 space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</p>
                    {customer ? (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                              {(customer.name ?? customer.email)[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{customer.name ?? "Sin nombre"}</p>
                              <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              {customer.activation_status === "activated" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              ) : (
                                <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                              )}
                              <span className="capitalize">{customer.activation_status}</span>
                            </div>
                            <p className="text-muted-foreground font-mono text-[10px] truncate">
                              {customer.stripe_customer_id}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Acciones rápidas</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs justify-start h-8"
                            onClick={() => handleQuickAction("view_stripe")}
                            disabled={actionLoading === "view_stripe"}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-2 shrink-0" />
                            Ver en Stripe
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs justify-start h-8 text-orange-600 border-orange-200 hover:bg-orange-50"
                            onClick={() => handleQuickAction("refund")}
                            disabled={actionLoading === "refund"}
                          >
                            {actionLoading === "refund"
                              ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              : <CreditCard className="h-3.5 w-3.5 mr-2 shrink-0" />}
                            Reembolsar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs justify-start h-8 text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                            onClick={() => handleQuickAction("pause")}
                            disabled={actionLoading === "pause"}
                          >
                            {actionLoading === "pause"
                              ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              : <PauseCircle className="h-3.5 w-3.5 mr-2 shrink-0" />}
                            Pausar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs justify-start h-8 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleQuickAction("unsubscribe")}
                            disabled={actionLoading === "unsubscribe"}
                          >
                            {actionLoading === "unsubscribe"
                              ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              : <X className="h-3.5 w-3.5 mr-2 shrink-0" />}
                            Desuscribir
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">No encontrado en Stripe</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Inbox className="h-14 w-14 opacity-20" />
                <div className="text-center">
                  <h3 className="font-semibold text-lg text-foreground/70">Seleccioná un email</h3>
                  <p className="text-sm mt-1">
                    {emails.length === 0
                      ? "Tu inbox está vacío. Configurá tu dominio para recibir emails."
                      : "Hacé click en un email para leerlo y responderlo."}
                  </p>
                </div>
                {emails.length === 0 && (
                  <Button onClick={() => router.push("/mails/config")} className="mt-2">
                    <Mail className="mr-2 h-4 w-4" />
                    Configurar Email
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
