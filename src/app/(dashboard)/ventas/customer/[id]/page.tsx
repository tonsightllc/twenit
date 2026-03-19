"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Pause,
  Play,
  RotateCcw,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface StripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
  current_period_start: number;
  items: {
    data: Array<{
      price: {
        id: string;
        unit_amount: number | null;
        currency: string;
        recurring: { interval: string } | null;
      };
      quantity: number;
    }>;
  };
  pause_collection: { behavior: string } | null;
}

interface StripeInvoice {
  id: string;
  status: string | null;
  amount_paid: number;
  amount_due: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  number: string | null;
}

interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  refunded: boolean;
  amount_refunded: number;
  payment_intent: string | null;
  description: string | null;
}

interface CustomerData {
  customer: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    metadata: Record<string, string>;
    created: number;
    currency: string | null;
    balance: number;
    delinquent: boolean;
  };
  subscriptions: StripeSubscription[];
  invoices: StripeInvoice[];
  charges: StripeCharge[];
}

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dbCustomer, setDbCustomer] = useState<{
    stripe_customer_id: string;
    activation_status: string;
  } | null>(null);

  // Refund dialog state
  const [refundDialog, setRefundDialog] = useState<{
    open: boolean;
    chargeId: string;
    paymentIntentId: string | null;
    maxAmount: number;
    currency: string;
  }>({ open: false, chargeId: "", paymentIntentId: null, maxAmount: 0, currency: "usd" });
  const [refundAmount, setRefundAmount] = useState("");

  const supabase = createClient();

  const loadCustomerData = useCallback(async () => {
    // Get DB customer to find stripe_customer_id
    const { data: customer } = await supabase
      .from("customers")
      .select("stripe_customer_id, activation_status")
      .eq("id", customerId)
      .single();

    if (!customer) {
      setLoading(false);
      return;
    }

    setDbCustomer(customer);

    // Fetch from Stripe API
    const response = await fetch(
      `/api/stripe/customers?customerId=${customer.stripe_customer_id}`
    );
    if (response.ok) {
      const result = await response.json();
      setData(result);
    }
    setLoading(false);
  }, [customerId, supabase]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  async function executeAction(
    action: string,
    params: Record<string, unknown>
  ) {
    setActionLoading(action);
    try {
      const response = await fetch("/api/stripe/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        // Reload data
        await loadCustomerData();
      } else {
        toast.error(result.error || "Error al ejecutar acción");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefund() {
    const amountCents = refundAmount
      ? Math.round(parseFloat(refundAmount) * 100)
      : undefined;
    await executeAction("refund", {
      chargeId: refundDialog.chargeId,
      paymentIntentId: refundDialog.paymentIntentId,
      amount: amountCents,
    });
    setRefundDialog({ open: false, chargeId: "", paymentIntentId: null, maxAmount: 0, currency: "usd" });
    setRefundAmount("");
  }

  function formatCurrency(amount: number, currency: string = "usd") {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trialing: "outline",
      past_due: "destructive",
      canceled: "secondary",
      unpaid: "destructive",
      paid: "default",
      open: "outline",
      draft: "secondary",
      void: "secondary",
      succeeded: "default",
      failed: "destructive",
      pending: "outline",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data || !dbCustomer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/ventas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No se pudo cargar la información del cliente.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { customer, subscriptions, invoices, charges } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/ventas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {customer.name || customer.email || "Cliente"}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-3 w-3" />
              {customer.email}
              {customer.phone && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  {customer.phone}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              dbCustomer.activation_status === "activated"
                ? "default"
                : "secondary"
            }
          >
            {dbCustomer.activation_status}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://dashboard.stripe.com/customers/${customer.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-3 w-3" />
              Ver en Stripe
            </a>
          </Button>
        </div>
      </div>

      {/* Customer Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cliente Desde
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDate(customer.created)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Suscripciones
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
            <p className="text-xs text-muted-foreground">
              {subscriptions.filter((s) => s.status === "active").length}{" "}
              activas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(customer.balance, customer.currency || "usd")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={customer.delinquent ? "destructive" : "default"}>
              {customer.delinquent ? "Moroso" : "Al día"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">
            Suscripciones ({subscriptions.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Facturas ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="charges">
            Cobros ({charges.length})
          </TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="mt-4">
          {subscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Este cliente no tiene suscripciones
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => {
                const price = sub.items.data[0]?.price;
                const isPaused = !!sub.pause_collection;
                return (
                  <Card key={sub.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {price
                              ? `${formatCurrency(price.unit_amount || 0, price.currency)}/${price.recurring?.interval || "mes"}`
                              : sub.id}
                          </CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {sub.id}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPaused && (
                            <Badge variant="outline">Pausada</Badge>
                          )}
                          {sub.cancel_at_period_end && (
                            <Badge variant="outline">
                              Cancela al final del período
                            </Badge>
                          )}
                          {statusBadge(sub.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          <p>
                            Período actual:{" "}
                            {formatDate(sub.current_period_start)} -{" "}
                            {formatDate(sub.current_period_end)}
                          </p>
                        </div>
                        {sub.status === "active" && (
                          <div className="flex gap-2">
                            {isPaused ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  executeAction("resume_subscription", {
                                    subscriptionId: sub.id,
                                  })
                                }
                                disabled={!!actionLoading}
                              >
                                {actionLoading === "resume_subscription" ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="mr-2 h-3 w-3" />
                                )}
                                Reanudar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  executeAction("pause_subscription", {
                                    subscriptionId: sub.id,
                                  })
                                }
                                disabled={!!actionLoading}
                              >
                                {actionLoading === "pause_subscription" ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <Pause className="mr-2 h-3 w-3" />
                                )}
                                Pausar
                              </Button>
                            )}
                            {!sub.cancel_at_period_end && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-500"
                                onClick={() =>
                                  executeAction("cancel_subscription", {
                                    subscriptionId: sub.id,
                                    immediate: false,
                                  })
                                }
                                disabled={!!actionLoading}
                              >
                                {actionLoading === "cancel_subscription" ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <XCircle className="mr-2 h-3 w-3" />
                                )}
                                Cancelar
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Facturas</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay facturas
                </p>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium font-mono text-sm">
                          {inv.number || inv.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(inv.created)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold">
                          {formatCurrency(inv.amount_paid, inv.currency)}
                        </p>
                        {statusBadge(inv.status || "unknown")}
                        {inv.hosted_invoice_url && (
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charges Tab */}
        <TabsContent value="charges" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Cobros</CardTitle>
              <CardDescription>
                Cobros realizados al cliente. Puedes hacer refunds desde aquí.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {charges.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay cobros
                </p>
              ) : (
                <div className="space-y-3">
                  {charges.map((charge) => (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium font-mono text-sm">
                          {charge.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(charge.created)}
                          {charge.description && ` - ${charge.description}`}
                        </p>
                        {charge.refunded && (
                          <p className="text-xs text-orange-500">
                            Reembolsado:{" "}
                            {formatCurrency(
                              charge.amount_refunded,
                              charge.currency
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold">
                          {formatCurrency(charge.amount, charge.currency)}
                        </p>
                        {statusBadge(charge.status)}
                        {charge.status === "succeeded" &&
                          !charge.refunded && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRefundDialog({
                                  open: true,
                                  chargeId: charge.id,
                                  paymentIntentId:
                                    typeof charge.payment_intent === "string"
                                      ? charge.payment_intent
                                      : null,
                                  maxAmount: charge.amount,
                                  currency: charge.currency,
                                });
                                setRefundAmount("");
                              }}
                            >
                              <RotateCcw className="mr-2 h-3 w-3" />
                              Refund
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Metadata del Cliente</CardTitle>
              <CardDescription>
                Datos adicionales almacenados en Stripe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(customer.metadata).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay metadata
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(customer.metadata).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between p-2 border rounded"
                    >
                      <span className="font-mono text-sm font-medium">
                        {key}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Refund Dialog */}
      <Dialog
        open={refundDialog.open}
        onOpenChange={(open) =>
          setRefundDialog({ ...refundDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Procesar Refund</DialogTitle>
            <DialogDescription>
              Cargo: {refundDialog.chargeId} - Máximo:{" "}
              {formatCurrency(refundDialog.maxAmount, refundDialog.currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                Monto a reembolsar (dejar vacío para refund total)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={refundDialog.maxAmount / 100}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`${(refundDialog.maxAmount / 100).toFixed(2)} (total)`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRefundDialog({ ...refundDialog, open: false })
              }
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRefund}
              disabled={!!actionLoading}
            >
              {actionLoading === "refund" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Confirmar Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
