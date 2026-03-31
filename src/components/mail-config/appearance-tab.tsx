"use client";

import { useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import type { EmailConfig } from "./types";

interface AppearanceTabProps {
  config: EmailConfig;
  onUpdate: (partial: Partial<EmailConfig>) => void;
  onSave: (partial?: Partial<EmailConfig>) => Promise<void>;
  setConfig: React.Dispatch<React.SetStateAction<EmailConfig>>;
}

export function AppearanceTab({ config, onUpdate, onSave, setConfig }: AppearanceTabProps) {
  const [logo, setLogo] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identidad del Remitente</CardTitle>
            <CardDescription>Cómo te verán tus clientes cuando reciban tus correos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del Remitente</Label>
              <Input
                value={config.sender_name ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, sender_name: e.target.value }))}
                onBlur={() => onSave()}
                placeholder="Ej: Soporte de TuEmpresa"
              />
            </div>
            <div className="space-y-2">
              <Label>Email de Respuesta (reply-to)</Label>
              <Input
                value={config.reply_to_email ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, reply_to_email: e.target.value }))}
                onBlur={() => onSave()}
                placeholder="soporte@tuempresa.com"
              />
              <p className="text-xs text-muted-foreground">A donde llegan las respuestas de tus clientes.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estilo y Marca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-md border border-dashed flex items-center justify-center bg-muted/50">
                  {logo ? (
                    <Image src={logo} alt="Logo" width={48} height={48} className="h-full w-full object-contain" unoptimized />
                  ) : (
                    <span className="text-xs text-muted-foreground">Logo</span>
                  )}
                </div>
                <Input type="file" accept="image/*" className="max-w-[250px]" onChange={handleLogoChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color de Acento</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.accent_color ?? "#fbbf24"}
                  onChange={(e) => setConfig((c) => ({ ...c, accent_color: e.target.value }))}
                  onBlur={() => onSave()}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={config.accent_color ?? "#fbbf24"}
                  onChange={(e) => setConfig((c) => ({ ...c, accent_color: e.target.value }))}
                  onBlur={() => onSave()}
                  className="flex-1 font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Firma del Correo</Label>
              <textarea
                className="w-full min-h-[100px] p-3 border rounded-md bg-background text-sm resize-y"
                value={config.signature ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, signature: e.target.value }))}
                onBlur={() => onSave()}
              />
            </div>

            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <Label>Footer del Correo</Label>
                <Switch
                  checked={config.show_footer ?? true}
                  onCheckedChange={(v) => onUpdate({ show_footer: v })}
                />
              </div>
              {config.show_footer && (
                <textarea
                  className="w-full min-h-[70px] p-3 border rounded-md bg-background text-xs resize-y text-muted-foreground"
                  value={config.footer_text ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, footer_text: e.target.value }))}
                  onBlur={() => onSave()}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-6 h-fit">
        <Card className="overflow-hidden border-2 shadow-lg">
          <div className="bg-muted/50 border-b p-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="mx-auto text-xs text-muted-foreground font-medium bg-background px-3 py-1 rounded-md shadow-sm border">
              Vista Previa
            </div>
          </div>
          <CardContent className="p-0">
            <div className="bg-white min-h-[450px] text-zinc-900 font-sans p-8">
              <div className="max-w-md mx-auto">
                {logo && <Image src={logo} alt="Logo" width={64} height={64} className="h-14 w-auto mx-auto mb-4 object-contain" unoptimized />}
                <h2 className="text-lg font-bold text-center mb-4" style={{ color: "#111827" }}>
                  Asunto del email de ejemplo
                </h2>
                <p className="text-[15px] text-zinc-700 leading-relaxed">
                  Hola <strong>Cliente</strong><br /><br />
                  Este es el cuerpo del email. Aquí va el contenido principal del mensaje.
                </p>
                <div className="mt-6 py-4 text-center">
                  <a
                    href="#"
                    className="inline-block px-6 py-3 rounded-full text-white font-semibold text-sm"
                    style={{ backgroundColor: config.accent_color ?? "#fbbf24", color: "#111" }}
                  >
                    Botón de acción
                  </a>
                </div>
                {config.signature && (
                  <div className="mt-6 pt-4 border-t border-zinc-100 text-zinc-600 text-sm whitespace-pre-wrap">
                    {config.signature}
                  </div>
                )}
                {config.show_footer && config.footer_text && (
                  <div className="mt-4 text-xs text-zinc-400 text-center whitespace-pre-wrap">
                    {config.footer_text}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
