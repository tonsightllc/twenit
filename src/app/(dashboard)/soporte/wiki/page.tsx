"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye, Search, BookOpen, Loader2 } from "lucide-react";

interface WikiArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export default function WikiPage() {
  const { orgId } = useOrg();
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<WikiArticle | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "",
    published: false,
  });

  const supabase = createClient();

  const loadArticles = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("wiki_articles")
      .select("*")
      .eq("org_id", orgId)
      .order("order", { ascending: true });

    if (error) {
      console.error(error);
      toast.error("Error al cargar artículos");
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  async function handleSave() {
    if (!orgId) return;

    const slug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (editingArticle) {
      const { error } = await supabase
        .from("wiki_articles")
        .update({
          title: formData.title,
          content: formData.content,
          category: formData.category,
          published: formData.published,
          slug,
        })
        .eq("id", editingArticle.id);

      if (error) {
        toast.error("Error al actualizar artículo");
        return;
      }
      toast.success("Artículo actualizado");
    } else {
      const { error } = await supabase.from("wiki_articles").insert({
        org_id: orgId,
        title: formData.title,
        content: formData.content,
        category: formData.category,
        published: formData.published,
        slug,
        order: articles.length,
      });

      if (error) {
        toast.error("Error al crear artículo");
        return;
      }
      toast.success("Artículo creado");
    }

    setIsDialogOpen(false);
    setEditingArticle(null);
    setFormData({ title: "", content: "", category: "", published: false });
    loadArticles();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar este artículo?")) return;

    const { error } = await supabase.from("wiki_articles").delete().eq("id", id);

    if (error) {
      toast.error("Error al eliminar artículo");
      return;
    }

    toast.success("Artículo eliminado");
    loadArticles();
  }

  function openEditDialog(article: WikiArticle) {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      category: article.category || "",
      published: article.published,
    });
    setIsDialogOpen(true);
  }

  function openNewDialog() {
    setEditingArticle(null);
    setFormData({ title: "", content: "", category: "", published: false });
    setIsDialogOpen(true);
  }

  const filteredArticles = articles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (article.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(articles.map((a) => a.category).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wiki de Soporte</h1>
          <p className="text-muted-foreground">
            Crea y gestiona artículos de ayuda para tus clientes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Artículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingArticle ? "Editar Artículo" : "Nuevo Artículo"}
              </DialogTitle>
              <DialogDescription>
                {editingArticle
                  ? "Modifica el contenido del artículo"
                  : "Crea un nuevo artículo de ayuda"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="¿Cómo puedo cancelar mi suscripción?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  placeholder="Facturación"
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Contenido (Markdown)</Label>
                <textarea
                  id="content"
                  className="w-full min-h-[200px] p-3 border rounded-md bg-background"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="Escribe el contenido del artículo usando Markdown..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="published"
                  checked={formData.published}
                  onChange={(e) =>
                    setFormData({ ...formData, published: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="published">Publicado</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingArticle ? "Guardar Cambios" : "Crear Artículo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar artículos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Articles Grid */}
      {filteredArticles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <Card key={article.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <Badge variant={article.published ? "default" : "secondary"}>
                    {article.published ? "Publicado" : "Borrador"}
                  </Badge>
                </div>
                <CardTitle className="line-clamp-2">{article.title}</CardTitle>
                {article.category && (
                  <Badge variant="outline">{article.category}</Badge>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {article.content.substring(0, 150)}...
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(article)}
                  >
                    <Edit className="mr-2 h-3 w-3" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(article.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay artículos</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {searchQuery
                ? "No se encontraron artículos con ese término"
                : "Crea tu primer artículo de ayuda para tus clientes"}
            </p>
            {!searchQuery && (
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Primer Artículo
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
