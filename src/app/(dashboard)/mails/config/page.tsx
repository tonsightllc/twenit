"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Bot,
  Save,
  Plus,
  Edit,
  Clock,
  ExternalLink,
} from "lucide-react";
import Image from "next/image";

export default function MailConfigPage() {
  const [autoClassify, setAutoClassify] = useState(true);
  const [autoRespond, setAutoRespond] = useState(false);

  // Connection State
  const [provider, setProvider] = useState<"resend" | "smtp">("resend");
  const [domain, setDomain] = useState("");
  const [domainConfigured, setDomainConfigured] = useState(false);

  // Customization State
  const [senderName, setSenderName] = useState("Soporte - Tu Empresa");
  const [replyTo, setReplyTo] = useState("soporte@tuempresa.com");
  const [signature, setSignature] = useState("Saludos,\n\nEl equipo de Soporte\nTu Empresa");
  const [primaryColor, setPrimaryColor] = useState("#fbbf24"); // Amber 400
  const [logo, setLogo] = useState<string | null>(null);
  const [showFooter, setShowFooter] = useState(true);
  const [footerText, setFooterText] = useState("© 2024 Tu Empresa. Todos los derechos reservados.\n123 Calle Principal, Ciudad, País");
  const [customCSS, setCustomCSS] = useState(`/* Estilos tipo ejemplo */
.email-wrapper {
  background-color: #f9fafb;
  padding: 40px 20px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}
.email-container {
  max-width: 600px;
  margin: 0 auto;
  background-color: #ffffff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
.email-header {
  text-align: center;
  margin-bottom: 2rem;
}
.email-body {
  color: #374151;
  line-height: 1.6;
  font-size: 16px;
}
.cta-button {
  display: inline-block;
  background-color: #fbbf24; /* Fallback */
  color: #111827;
  font-weight: 700;
  padding: 16px 32px;
  border-radius: 9999px;
  text-decoration: none;
  margin: 20px 0;
  text-align: center;
  width: 100%;
}
.email-footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}
h2 {
  color: #111827;
  font-weight: 800;
  font-size: 24px;
  margin-bottom: 24px;
  text-align: center;
}
strong {
  color: #111827;
  font-weight: 700;
}`);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración de Mails</h1>
          <p className="text-muted-foreground">
            Configura las opciones de gestión de correo electrónico
          </p>
        </div>
        <Button>
          <Save className="mr-2 h-4 w-4" />
          Guardar Cambios
        </Button>
      </div>

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance">Personalización</TabsTrigger>
          <TabsTrigger value="general">Conexión</TabsTrigger>
          <TabsTrigger value="classification">Clasificación IA</TabsTrigger>
          <TabsTrigger value="automation">Automatización</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          {/* Resend: Domain Configuration (default view) */}
          {provider === "resend" && (
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Dominio</CardTitle>
                <CardDescription>
                  Configura tu dominio para enviar y recibir emails desde tu marca
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!domainConfigured ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="domain">Dominio</Label>
                      <div className="flex gap-2">
                        <Input
                          id="domain"
                          placeholder="ejemplo.com"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => domain && setDomainConfigured(true)}
                          disabled={!domain}
                        >
                          Configurar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        El dominio desde el cual enviarás emails (sin &quot;www&quot;). Por ejemplo: tuempresa.com
                      </p>
                    </div>

                    <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                      <div className="flex gap-3">
                        <div className="text-blue-600">ℹ️</div>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-blue-900">¿No puedes configurar DNS?</p>
                          <p className="text-blue-800">
                            Si no tienes acceso a configurar registros DNS, puedes usar SMTP.{" "}
                            <button
                              onClick={() => setProvider("smtp")}
                              className="underline font-medium cursor-pointer"
                            >
                              Usar SMTP en su lugar →
                            </button>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="rounded-lg border p-4 bg-muted/50 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Mail className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-medium">{domain}</p>
                            <p className="text-sm text-muted-foreground">Resend (Inbound + Outbound)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-200">
                            <Clock className="h-3 w-3" />
                            Verificando DNS
                          </Badge>
                          <Button variant="outline" size="sm">
                            Re-verificar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDomainConfigured(false);
                              setDomain("");
                            }}
                          >
                            Cambiar
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Registros DNS Requeridos</h3>
                      <p className="text-sm text-muted-foreground">
                        Agrega estos registros en tu proveedor de dominio (GoDaddy, Namecheap, Cloudflare, etc.)
                      </p>

                      <div className="rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="h-10 px-4 text-left font-medium">Tipo</th>
                              <th className="h-10 px-4 text-left font-medium">Nombre</th>
                              <th className="h-10 px-4 text-left font-medium">Valor</th>
                              <th className="h-10 px-4 text-left font-medium">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-4 font-mono">MX</td>
                              <td className="p-4 font-mono">@</td>
                              <td className="p-4 font-mono">inbound.resend.com (Prioridad 10)</td>
                              <td className="p-4">
                                <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                                  Pendiente
                                </Badge>
                              </td>
                            </tr>
                            <tr>
                              <td className="p-4 font-mono">TXT</td>
                              <td className="p-4 font-mono">@</td>
                              <td className="p-4 font-mono">v=spf1 include:resend.com ~all</td>
                              <td className="p-4">
                                <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                                  Pendiente
                                </Badge>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <a
                        href="https://resend.com/docs/dashboard/domains/introduction"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Ver guía completa de configuración DNS <ExternalLink className="h-3 w-3" />
                      </a>

                      <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                        <div className="flex gap-3">
                          <div className="text-blue-600">ℹ️</div>
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-blue-900">¿No puedes configurar DNS?</p>
                            <p className="text-blue-800">
                              Si no tienes acceso a configurar registros DNS, puedes usar SMTP.{" "}
                              <button
                                onClick={() => setProvider("smtp")}
                                className="underline font-medium cursor-pointer"
                              >
                                Usar SMTP en su lugar →
                              </button>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SMTP Configuration */}
          {provider === "smtp" && (
            <Card>
              <CardHeader>
                <CardTitle>Configuración SMTP</CardTitle>
                <CardDescription>
                  Conecta tu propio servidor SMTP para enviar emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">Host SMTP</Label>
                    <Input id="smtp-host" placeholder="smtp.gmail.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">Puerto</Label>
                    <Input id="smtp-port" type="number" placeholder="587" defaultValue="587" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-username">Usuario SMTP</Label>
                  <Input id="smtp-username" placeholder="usuario@ejemplo.com" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-password">Contraseña SMTP</Label>
                  <Input id="smtp-password" type="password" placeholder="••••••••" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-from">Email &quot;From&quot;</Label>
                  <Input id="smtp-from" placeholder="noreply@ejemplo.com" />
                </div>

                <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                  <div className="flex gap-3">
                    <div className="text-blue-600">📚</div>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-blue-900">¿Necesitas ayuda con SMTP?</p>
                      <p className="text-blue-800">
                        Tenemos guías para Gmail, Outlook y otros proveedores.
                        <a href="/wiki" className="underline ml-1">Ver instructivos →</a>
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="link"
                  className="p-0 h-auto text-sm"
                  onClick={() => setProvider("resend")}
                >
                  ← Volver a configuración por dominio (DNS)
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Editor Column */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Identidad del Remitente</CardTitle>
                  <CardDescription>
                    Cómo te verán tus clientes cuando reciban tus correos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre del Remitente</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Ej: Juan de TuEmpresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email de Respuesta</Label>
                    <Input
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="soporte@tuempresa.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      A donde llegarán las respuestas de tus clientes.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estilo y Marca</CardTitle>
                  <CardDescription>
                    Define los colores y firma de tus correos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-md border border-dashed flex items-center justify-center bg-muted/50">
                        {logo ? <Image src={logo} alt="Logo" width={48} height={48} className="h-full w-full object-contain" unoptimized /> : <div className="text-xs text-muted-foreground">Logo</div>}
                      </div>
                      <Input type="file" accept="image/*" className="max-w-[250px]" onChange={handleLogoChange} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Color de Acento</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Firma del Correo</Label>
                    <textarea
                      className="w-full min-h-[120px] p-3 border rounded-md bg-background text-sm resize-y"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Soporta texto plano.
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Label>Footer del Correo</Label>
                      <Switch checked={showFooter} onCheckedChange={setShowFooter} />
                    </div>

                    {showFooter && (
                      <div className="space-y-2">
                        <textarea
                          className="w-full min-h-[80px] p-3 border rounded-md bg-background text-sm resize-y text-xs text-muted-foreground"
                          value={footerText}
                          onChange={(e) => setFooterText(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Avanzado</CardTitle>
                  <CardDescription>
                    Personalización técnica para desarrolladores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>CSS Personalizado</Label>
                    <textarea
                      className="w-full min-h-[250px] p-3 border rounded-md bg-zinc-950 text-zinc-50 font-mono text-xs resize-y"
                      placeholder=".email-body { font-family: 'Arial', sans-serif; }"
                      value={customCSS}
                      onChange={(e) => setCustomCSS(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Este CSS se inyectará en el &lt;head&gt; del correo. Usa las clases <code>.email-container</code>, <code>.email-header</code>, <code>.email-body</code>, <code>.cta-button</code>.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview Column */}
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
                  <div className="bg-white min-h-[500px] text-zinc-900 font-sans">
                    <div className="email-wrapper h-full">
                      <div className="email-container">
                        {/* Headers */}
                        <div className="email-header">
                          {logo && <Image src={logo} alt="Logo" width={64} height={64} className="h-16 w-auto mx-auto mb-4 object-contain" unoptimized />}
                          {!logo && <div className="h-16 w-16 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center text-muted-foreground text-xs">Logo</div>}
                          <h2 className="text-xl font-bold text-zinc-900">Bienvenido a Tu App!</h2>
                        </div>

                        {/* Email Body */}
                        <div className="space-y-4 text-[15px] leading-relaxed text-zinc-700 email-body">
                          <p>Hola <strong>Rodrigo</strong> 👋</p>
                          <p>
                            Gracias por suscribirte a <strong>Tu Empresa</strong>. Tu viaje hacia una mejor gestión comienza hoy.
                          </p>
                          <p>
                            Ahora tienes acceso a todas nuestras herramientas premium, diseñadas para tí con simplicidad en mente.
                          </p>

                          <div className="py-6 text-center">
                            <a
                              href="#"
                              className="cta-button"
                              style={{ backgroundColor: primaryColor }}
                            >
                              Comenzar Ahora
                            </a>
                          </div>

                          <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400 text-sm text-yellow-800 my-6">
                            <p className="font-medium">Nota Importante:</p>
                            <p>Si decides cancelar tu suscripción en cualquier momento, puedes hacerlo fácilmente desde tu panel.</p>
                          </div>

                          <p>
                            Estamos aquí para ayudarte. Si tienes preguntas, simplemente responde a este correo.
                          </p>

                          <div className="mt-8 pt-6 border-t border-zinc-100 text-zinc-600 whitespace-pre-wrap email-signature">
                            {signature}
                          </div>

                          {showFooter && (
                            <div className="mt-6 text-xs text-zinc-400 text-center whitespace-pre-wrap email-footer">
                              {footerText}
                            </div>
                          )}

                          {customCSS && (
                            <style dangerouslySetInnerHTML={{ __html: customCSS }} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="classification" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <CardTitle>Clasificación con IA</CardTitle>
              </div>
              <CardDescription>
                Usa inteligencia artificial para clasificar los emails entrantes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clasificación Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Clasificar automáticamente los emails por categoría e intención
                  </p>
                </div>
                <Switch checked={autoClassify} onCheckedChange={setAutoClassify} />
              </div>

              {autoClassify && (
                <div className="space-y-4 pl-4 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>Categorías</Label>
                    <div className="flex flex-wrap gap-2">
                      {["Soporte", "Facturación", "Cancelación", "Ventas", "Otro"].map((cat) => (
                        <Badge key={cat} variant="outline">
                          {cat}
                        </Badge>
                      ))}
                      <Button variant="outline" size="sm">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Intenciones Detectadas</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Problema de acceso",
                        "Cancelar suscripción",
                        "Solicitar refund",
                        "Upgrade",
                        "Pregunta general",
                      ].map((intent) => (
                        <Badge key={intent} variant="secondary">
                          {intent}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo de IA</Label>
                    <Select defaultValue="gpt-4">
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5">GPT-3.5 Turbo</SelectItem>
                        <SelectItem value="claude">Claude</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Respuestas Automáticas</CardTitle>
              <CardDescription>
                Configura respuestas automáticas basadas en la clasificación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar Respuestas Automáticas</Label>
                  <p className="text-sm text-muted-foreground">
                    Responder automáticamente según las reglas configuradas
                  </p>
                </div>
                <Switch checked={autoRespond} onCheckedChange={setAutoRespond} />
              </div>

              {autoRespond && (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">Problema de acceso</p>
                        <p className="text-sm text-muted-foreground">
                          Enviar instrucciones de recuperación de contraseña
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="default">Activa</Badge>
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">Cancelar suscripción</p>
                        <p className="text-sm text-muted-foreground">
                          Ofrecer descuento antes de cancelar
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="default">Activa</Badge>
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">Solicitar refund</p>
                        <p className="text-sm text-muted-foreground">
                          Crear ticket de soporte automáticamente
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">Inactiva</Badge>
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Regla
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones Automáticas</CardTitle>
              <CardDescription>
                Ejecutar acciones en Stripe basadas en el contenido del email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Procesar refunds automáticamente</p>
                    <p className="text-sm text-muted-foreground">
                      Para montos menores a $50 USD
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Cancelar suscripciones</p>
                    <p className="text-sm text-muted-foreground">
                      Cuando se detecta intención clara de cancelación
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Vincular cliente de Stripe</p>
                    <p className="text-sm text-muted-foreground">
                      Buscar automáticamente el cliente en Stripe por email
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
