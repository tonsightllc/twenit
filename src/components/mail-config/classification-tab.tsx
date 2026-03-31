"use client";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bot, Plus, X } from "lucide-react";
import type { EmailConfig } from "./types";

interface ClassificationTabProps {
  config: EmailConfig;
  onUpdate: (partial: Partial<EmailConfig>) => void;
}

export function ClassificationTab({ config, onUpdate }: ClassificationTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <CardTitle>Clasificación con IA</CardTitle>
        </div>
        <CardDescription>
          Clasificá automáticamente los emails entrantes por categoría e intención usando OpenAI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Clasificación Automática</Label>
            <p className="text-sm text-muted-foreground">Se activa al recibir cada email (requiere OPENAI_API_KEY)</p>
          </div>
          <Switch
            checked={config.auto_classify ?? false}
            onCheckedChange={(v) => onUpdate({ auto_classify: v })}
          />
        </div>

        {config.auto_classify && (
          <div className="space-y-4 pl-4 border-l-2 border-muted">
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <Select
                value={config.ai_model ?? "gpt-4o-mini"}
                onValueChange={(v) => onUpdate({ ai_model: v })}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (rápido)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (preciso)</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (económico)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categorías</Label>
              <div className="flex flex-wrap gap-2">
                {(config.ai_categories ?? []).map((cat) => (
                  <Badge key={cat} variant="outline" className="gap-1">
                    {cat}
                    <button onClick={() => {
                      const newCats = (config.ai_categories ?? []).filter((x) => x !== cat);
                      onUpdate({ ai_categories: newCats });
                    }}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    const cat = prompt("Nueva categoría:");
                    if (cat) {
                      const newCats = [...(config.ai_categories ?? []), cat];
                      onUpdate({ ai_categories: newCats });
                    }
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
