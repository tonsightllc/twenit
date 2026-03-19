"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Inbox,
  Send,
  Archive,
  Trash2,
  Star,
  Search,
  Forward,
  Mail,
  Clock,
  User,
  Bot,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

interface InboundEmail {
  id: string;
  from_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_read: boolean;
  classification: string | null;
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
  category: string;
  intent: string;
  customerId: string | null;
}

const categories = [
  { id: "all", name: "Todos" },
  { id: "support", name: "Soporte" },
  { id: "sales", name: "Ventas" },
  { id: "billing", name: "Facturación" },
  { id: "other", name: "Otro" },
];

const intentColors: Record<string, string> = {
  problema_acceso: "bg-yellow-500",
  cancelar_suscripcion: "bg-red-500",
  solicitar_refund: "bg-orange-500",
  upgrade: "bg-green-500",
};

function mapDbEmail(dbEmail: InboundEmail): MappedEmail {
  return {
    id: dbEmail.id,
    from: dbEmail.from_email,
    fromName: dbEmail.from_email.split('<')[0].replace(/"/g, '').trim() || dbEmail.from_email,
    subject: dbEmail.subject,
    preview: dbEmail.body_text ? dbEmail.body_text.substring(0, 100) + "..." : "",
    content: dbEmail.body_text || dbEmail.body_html || "",
    date: dbEmail.received_at,
    read: dbEmail.is_read,
    starred: false,
    category: dbEmail.classification || "Unclassified",
    intent: "general",
    customerId: null,
  };
}

export default function InboxPage() {
  const [emails, setEmails] = useState<MappedEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MappedEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inbound_emails')
        .select('*')
        .order('received_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setEmails(data.map(mapDbEmail));
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
      // Fallback to empty or toast error
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchEmails();

    // Subscribe to new emails
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbound_emails',
        },
        (payload) => {
          const newEmail = mapDbEmail(payload.new as InboundEmail);
          setEmails((current) => [newEmail, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEmails, supabase]);

  const updateEmailStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('inbound_emails')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // Optimistic update
      setEmails((current) => current.filter((e) => e.id !== id));
      if (selectedEmail?.id === id) {
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error("Error updating email status:", error);
    }
  };

  const filteredEmails = emails.filter((email) => {
    const matchesSearch =
      email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.fromName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.preview?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" ||
      (selectedCategory === "Unclassified" ? !email.category : email.category?.toLowerCase() === selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
      return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground">
            Gestiona los emails de tus clientes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchEmails}>
            Refresh
          </Button>
          <Button>
            <Mail className="mr-2 h-4 w-4" />
            Configurar Email
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 h-[calc(100vh-200px)]">
        {/* Email List */}
        <div className="lg:col-span-1 space-y-4 flex flex-col h-full">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Email List */}
          <div className="space-y-2 overflow-y-auto flex-1 pr-2">
            {loading ? (
              <div className="text-center p-4 text-muted-foreground">Cargando...</div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center p-4 text-muted-foreground">No hay emails</div>
            ) : (
              filteredEmails.map((email) => (
                <Card
                  key={email.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedEmail?.id === email.id ? "border-primary" : ""
                    } ${!email.read ? "bg-primary/5" : ""}`}
                  onClick={() => setSelectedEmail(email)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium truncate ${!email.read ? "font-semibold" : ""}`}>
                            {email.fromName}
                          </span>
                          {email.starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <p className={`text-sm truncate ${!email.read ? "font-medium" : "text-muted-foreground"}`}>
                          {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {email.preview}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(email.date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {email.category && (
                        <Badge variant="outline" className="text-xs">
                          {email.category}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        <div className={`h-2 w-2 rounded-full ${intentColors[email.intent] || "bg-gray-500"}`} />
                        <span className="text-xs text-muted-foreground">
                          {email.intent.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="lg:col-span-2 h-full overflow-y-auto">
          {selectedEmail ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedEmail.subject}</CardTitle>
                    <CardDescription className="mt-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{selectedEmail.fromName}</span>
                          <span className="text-xs">({selectedEmail.from})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{new Date(selectedEmail.date).toLocaleString("es-AR")}</span>
                        </div>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => updateEmailStatus(selectedEmail.id, 'archived')}>
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => updateEmailStatus(selectedEmail.id, 'deleted')}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* AI Classification */}
                <div className="flex items-center gap-4 mt-4 p-3 bg-muted rounded-lg">
                  <Bot className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Clasificación IA</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge>{selectedEmail.category}</Badge>
                      <Badge variant="outline">{selectedEmail.intent.replace("_", " ")}</Badge>
                      {selectedEmail.customerId && (
                        <Badge variant="secondary">Cliente: {selectedEmail.customerId}</Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Acción automática
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex-1 overflow-y-auto">
                {/* Email Content */}
                <div className="prose prose-sm max-w-none mb-8">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {selectedEmail.content}
                  </pre>
                </div>

                {/* Reply Section */}
                <div className="border-t pt-6 mt-auto">
                  <h3 className="font-medium mb-4">Responder</h3>
                  <textarea
                    className="w-full min-h-[150px] p-3 border rounded-md bg-background"
                    placeholder="Escribe tu respuesta..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                  />
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Bot className="mr-2 h-4 w-4" />
                        Sugerir respuesta
                      </Button>
                      <Button variant="outline" size="sm">
                        Usar template
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline">
                        <Forward className="mr-2 h-4 w-4" />
                        Reenviar
                      </Button>
                      <Button>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-full">
                <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Selecciona un email</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Selecciona un email de la lista para ver su contenido y responder
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

