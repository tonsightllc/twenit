"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrg } from "@/components/providers/org-provider";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  RotateCcw,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

interface ChargeItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  refunded: boolean;
  amount_refunded: number;
  payment_intent: string | null;
  description: string | null;
  customer: string | null;
}

interface RefundItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  charge: string;
  reason: string | null;
}

export default function RefundsPage() {
  const { orgId } = useOrg();
  const [charges, setCharges] = useState<ChargeItem[]>([]);
  const [recentRefunds, setRecentRefunds] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stripeConnected, setStripeConnected] = useState(true);

  // Refund dialog
  const [refundDialog, setRefundDialog] = useState<{
    open: boolean;
    chargeId: string;
    paymentIntentId: string | null;
    maxAmount: number;
    currency: string;
  }>({
    open: false,
    chargeId: "",
    paymentIntentId: null,
    maxAmount: 0,
    currency: "usd",
  });
  const [refundAmount, setRefundAmount] = useState("");

  const supabase = createClient();

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    // Check Stripe connection
    const { data: connection } = await supabase
      .from("stripe_connections")
      .select("id")
      .eq("org_id", orgId)
      .single();

    if (!connection) {
      setStripeConnected(false);
      setLoading(false);
      return;
    }

    // Get all customers for this org to fetch their charges
    const { data: customers } = await supabase
      .from("customers")
      .select("stripe_customer_id")
      .eq("org_id", orgId);

    if (!customers || customers.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch charges for each customer (batch the first few)
    const allCharges: ChargeItem[] = [];
    const allRefunds: RefundItem[] = [];

    // Process in parallel batches of 5 customers
    const batchSize = 5;
    for (let i = 0; i < Math.min(customers.length, 20); i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      const promises = batch.map(async (c) => {
        try {
          const chargesRes = await fetch(
            `/api/stripe/customers?customerId=${c.stripe_customer_id}&charges=true&limit=10`
          );
          if (chargesRes.ok) {
            const data = await chargesRes.json();
            return data.charges || [];
          }
        } catch {
          // Skip failed fetches
        }
        return [];
      });

      const results = await Promise.all(promises);
      results.forEach((chargesData) => {
        allCharges.push(...chargesData);
      });
    }

    // Sort charges by date, most recent first
    allCharges.sort((a, b) => b.created - a.created);

    // Get refunded charges and extract refund info
    const refundedCharges = allCharges.filter(
      (c) => c.refunded || c.amount_refunded > 0
    );
    refundedCharges.forEach((c) => {
      if (c.amount_refunded > 0) {
        allRefunds.push({
          id: `ref_${c.id}`,
          amount: c.amount_refunded,
          currency: c.currency,
          status: "succeeded",
          created: c.created,
          charge: c.id,
          reason: null,
        });
      }
    });

    setCharges(allCharges);
    setRecentRefunds(allRefunds);
    setLoading(false);
  }, [supabase, orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRefund() {
    setActionLoading(refundDialog.chargeId);
    try {
      const amountCents = refundAmount
        ? Math.round(parseFloat(refundAmount) * 100)
        : undefined;

      const response = await fetch("/api/stripe/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refund",
          chargeId: refundDialog.chargeId,
          paymentIntentId: refundDialog.paymentIntentId,
          amount: amountCents,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Reload data after refund
        await loadData();
        setRefundDialog({
          open: false,
          chargeId: "",
          paymentIntentId: null,
          maxAmount: 0,
          currency: "usd",
        });
        setRefundAmount("");
      } else {
        alert(result.error || "Error al procesar refund");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setActionLoading(null);
    }
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
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Filter charges by search term
  const filteredCharges = charges.filter((charge) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      charge.id.toLowerCase().includes(term) ||
      charge.description?.toLowerCase().includes(term) ||
      charge.customer?.toLowerCase().includes(term)
    );
  });

  // Stats
  const refundableCharges = charges.filter(
    (c) => c.status === "succeeded" && !c.refunded
  );
  const totalRefunded = recentRefunds.reduce((sum, r) => sum + r.amount, 0);
  const refundedCount = recentRefunds.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!stripeConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Refunds</h1>
          <p className="text-muted-foreground">
            Gestiona las solicitudes de reembolso
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Conecta tu cuenta de Stripe
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Para gestionar refunds, primero necesitas conectar tu cuenta de
              Stripe.
            </p>
            <Button asChild>
              <Link href="/settings">Conectar Stripe</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Refunds</h1>
          <p className="text-muted-foreground">
            Gestiona los reembolsos de tu cuenta de Stripe
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cobros Reembolsables
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refundableCharges.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(
                refundableCharges.reduce((sum, c) => sum + c.amount, 0)
              )}{" "}
              total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Reembolsados
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refundedCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalRefunded)} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Cobros
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{charges.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(
                charges
                  .filter((c) => c.status === "succeeded")
                  .reduce((sum, c) => sum + c.amount, 0)
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tasa de Refund
            </CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {charges.length > 0
                ? `${((refundedCount / charges.length) * 100).toFixed(1)}%`
                : "0%"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID de cobro o descripción..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Charges List */}
      <Card>
        <CardHeader>
          <CardTitle>Cobros Recientes</CardTitle>
          <CardDescription>
            Cobros de tus clientes. Puedes hacer refund de los cobros exitosos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCharges.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No se encontraron cobros
            </p>
          ) : (
            <div className="space-y-3">
              {filteredCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium">
                        {charge.id}
                      </p>
                      <Badge
                        variant={
                          charge.status === "succeeded"
                            ? "default"
                            : charge.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {charge.status}
                      </Badge>
                      {charge.refunded && (
                        <Badge variant="outline" className="text-orange-500">
                          Reembolsado
                        </Badge>
                      )}
                    </div>
                    {charge.description && (
                      <p className="text-sm text-muted-foreground">
                        {charge.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(charge.created)}
                    </p>
                    {charge.amount_refunded > 0 && !charge.refunded && (
                      <p className="text-xs text-orange-500">
                        Refund parcial:{" "}
                        {formatCurrency(charge.amount_refunded, charge.currency)}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    <p className="text-xl font-bold">
                      {formatCurrency(charge.amount, charge.currency)}
                    </p>
                    {charge.status === "succeeded" && !charge.refunded && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRefundDialog({
                            open: true,
                            chargeId: charge.id,
                            paymentIntentId:
                              typeof charge.payment_intent === "string"
                                ? charge.payment_intent
                                : null,
                            maxAmount: charge.amount - charge.amount_refunded,
                            currency: charge.currency,
                          });
                          setRefundAmount("");
                        }}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === charge.id ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-3 w-3" />
                        )}
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

      {/* Refund Dialog */}
      <Dialog
        open={refundDialog.open}
        onOpenChange={(open) => setRefundDialog({ ...refundDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Procesar Refund</DialogTitle>
            <DialogDescription>
              Cargo: {refundDialog.chargeId} - Monto máximo:{" "}
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
              onClick={() => setRefundDialog({ ...refundDialog, open: false })}
            >
              Cancelar
            </Button>
            <Button onClick={handleRefund} disabled={!!actionLoading}>
              {actionLoading ? (
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
