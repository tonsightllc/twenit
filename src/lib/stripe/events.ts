import { createServiceClient } from "@/lib/supabase/server";
import {
    getStripeClientForOrg,
    createRefund,
    closeDispute,
    submitDisputeEvidence,
    updateCustomerMetadata,
} from "@/lib/stripe";
import { triggerAutomation } from "@/lib/automation";
import Stripe from "stripe";

type SupabaseServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// ─── Customer Events ──────────────────────────────────────────────────

export async function handleCustomerEvent(
    supabase: SupabaseServiceClient,
    orgId: string,
    customer: Stripe.Customer
) {
    // Check if a customer with this email already exists in this org
    if (customer.email) {
        const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id, stripe_customer_id")
            .eq("org_id", orgId)
            .eq("email", customer.email)
            .single();

        if (existingCustomer) {
            // Link this Stripe customer ID to the existing record if not already linked
            if (existingCustomer.stripe_customer_id !== customer.id) {
                await supabase
                    .from("customers")
                    .update({
                        stripe_customer_id: customer.id,
                        metadata: {
                            ...(customer.metadata || {}),
                            merged_at: new Date().toISOString(),
                            original_stripe_id: existingCustomer.stripe_customer_id,
                        },
                    })
                    .eq("id", existingCustomer.id);

                console.log(`Linked Stripe customer ${customer.id} to existing email ${customer.email}`);
                return;
            }
        }
    }

    // If no existing customer or no email, proceed with upsert based on stripe_customer_id
    await supabase.from("customers").upsert(
        {
            org_id: orgId,
            stripe_customer_id: customer.id,
            email: customer.email || "",
            name: customer.name || null,
            metadata: customer.metadata || {},
        },
        {
            onConflict: "org_id,stripe_customer_id",
        }
    );
}

// ─── Subscription Events ──────────────────────────────────────────────

export async function handleSubscriptionEvent(
    supabase: SupabaseServiceClient,
    orgId: string,
    subscription: Stripe.Subscription
) {
    const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("org_id", orgId)
        .eq("stripe_customer_id", subscription.customer as string)
        .single();

    if (!customer) return;

    const currentPeriodStart = (
        subscription as unknown as { current_period_start?: number }
    ).current_period_start;
    const currentPeriodEnd = (
        subscription as unknown as { current_period_end?: number }
    ).current_period_end;

    await supabase.from("subscriptions").upsert(
        {
            org_id: orgId,
            customer_id: customer.id,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price.id || null,
            status: subscription.status,
            current_period_start: currentPeriodStart
                ? new Date(currentPeriodStart * 1000).toISOString()
                : null,
            current_period_end: currentPeriodEnd
                ? new Date(currentPeriodEnd * 1000).toISOString()
                : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000).toISOString()
                : null,
        },
        {
            onConflict: "org_id,stripe_subscription_id",
        }
    );

    await triggerAutomation(supabase, orgId, "new_subscription", {
        subscription,
    });
}

export async function handleSubscriptionDeleted(
    supabase: SupabaseServiceClient,
    orgId: string,
    subscription: Stripe.Subscription
) {
    await supabase
        .from("subscriptions")
        .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
        })
        .eq("org_id", orgId)
        .eq("stripe_subscription_id", subscription.id);

    await triggerAutomation(supabase, orgId, "subscription_canceled", {
        subscription,
    });
}

// ─── Invoice Events ───────────────────────────────────────────────────

export async function handleInvoicePaid(
    supabase: SupabaseServiceClient,
    orgId: string,
    invoice: Stripe.Invoice
) {
    await triggerAutomation(supabase, orgId, "new_sale", { invoice });
}

export async function handleInvoicePaymentFailed(
    supabase: SupabaseServiceClient,
    orgId: string,
    invoice: Stripe.Invoice
) {
    // Create a support ticket for the failed payment
    const customerId =
        typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

    await supabase.from("support_tickets").insert({
        org_id: orgId,
        source: "manual",
        status: "open",
        category: "payment_failed",
        subject: `Pago fallido: ${invoice.id} - $${((invoice.amount_due || 0) / 100).toFixed(2)}`,
        messages: [
            {
                id: crypto.randomUUID(),
                sender_type: "bot",
                content: `Pago fallido para la factura ${invoice.id}. Cliente: ${customerId}. Monto: $${((invoice.amount_due || 0) / 100).toFixed(2)}.`,
                created_at: new Date().toISOString(),
            },
        ],
    });

    console.log("Payment failed for invoice:", invoice.id, "org:", orgId);
}

// ─── Dispute Events ──────────────────────────────────────────────────

export async function handleDisputeCreated(
    supabase: SupabaseServiceClient,
    orgId: string,
    dispute: Stripe.Dispute
) {
    // Get the unsubscription rules for this org
    const { data: rules } = await supabase
        .from("unsubscription_rules")
        .select("dispute_rules")
        .eq("org_id", orgId)
        .single();

    const disputeRules = (rules?.dispute_rules as {
        action: string;
        min_amount_to_dispute: number;
    }) || { action: "review", min_amount_to_dispute: 0 };

    // Always create a support ticket for the dispute
    await supabase.from("support_tickets").insert({
        org_id: orgId,
        source: "manual",
        status: "open",
        category: "dispute",
        subject: `Disputa: ${dispute.id} - $${(dispute.amount / 100).toFixed(2)}`,
        messages: [
            {
                id: crypto.randomUUID(),
                sender_type: "bot",
                content: `Nueva disputa creada. Razón: ${dispute.reason}. Monto: $${(dispute.amount / 100).toFixed(2)}. Estrategia configurada: ${disputeRules.action}.`,
                created_at: new Date().toISOString(),
            },
        ],
    });

    // Get Stripe client for the org to perform actions
    const stripeData = await getStripeClientForOrg(orgId);
    if (!stripeData) {
        console.error("No Stripe connection for org:", orgId);
        return;
    }

    const { client } = stripeData;

    // Act based on rules
    switch (disputeRules.action) {
        case "always_dispute": {
            // Automatically gather evidence and submit
            await gatherAndSubmitEvidence(supabase, client, orgId, dispute);
            break;
        }

        case "smart": {
            // Only dispute if amount is above minimum threshold
            if (dispute.amount >= disputeRules.min_amount_to_dispute * 100) {
                await gatherAndSubmitEvidence(supabase, client, orgId, dispute);
            } else {
                // Accept the dispute for small amounts
                try {
                    await closeDispute(client, dispute.id);
                    console.log(
                        `Dispute ${dispute.id} closed (amount below threshold): $${(dispute.amount / 100).toFixed(2)}`
                    );
                } catch (err) {
                    console.error("Error closing dispute:", err);
                }
            }
            break;
        }

        case "never_dispute": {
            // Accept the dispute without contesting
            try {
                await closeDispute(client, dispute.id);
                console.log(`Dispute ${dispute.id} accepted (never_dispute policy)`);
            } catch (err) {
                console.error("Error closing dispute:", err);
            }
            break;
        }

        case "review":
        default: {
            // Just keep the ticket open for manual review - evidence is gathered and attached to ticket
            const evidence = await gatherEvidence(supabase, orgId, dispute);
            if (evidence && Object.keys(evidence).length > 0) {
                // Update ticket with gathered evidence
                const { data: ticket } = await supabase
                    .from("support_tickets")
                    .select("id, messages")
                    .eq("org_id", orgId)
                    .ilike("subject", `%${dispute.id}%`)
                    .single();

                if (ticket) {
                    const messages = ticket.messages as Array<{
                        id: string;
                        sender_type: string;
                        content: string;
                        created_at: string;
                    }>;
                    messages.push({
                        id: crypto.randomUUID(),
                        sender_type: "bot",
                        content: `Evidencia recopilada automáticamente:\n${JSON.stringify(evidence, null, 2)}\n\nRevisa y envía manualmente si corresponde.`,
                        created_at: new Date().toISOString(),
                    });
                    await supabase
                        .from("support_tickets")
                        .update({ messages })
                        .eq("id", ticket.id);
                }
            }
            break;
        }
    }

    await triggerAutomation(supabase, orgId, "dispute_created", {
        dispute,
        rules: disputeRules,
    });
}

export async function handleDisputeUpdated(
    supabase: SupabaseServiceClient,
    orgId: string,
    dispute: Stripe.Dispute
) {
    const { data: ticket } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("org_id", orgId)
        .ilike("subject", `%${dispute.id}%`)
        .single();

    if (ticket) {
        const messages = ticket.messages as Array<{
            id: string;
            sender_type: string;
            content: string;
            created_at: string;
        }>;
        messages.push({
            id: crypto.randomUUID(),
            sender_type: "bot",
            content: `Disputa actualizada. Estado: ${dispute.status}`,
            created_at: new Date().toISOString(),
        });

        await supabase
            .from("support_tickets")
            .update({
                messages,
                status:
                    dispute.status === "won" || dispute.status === "lost"
                        ? "closed"
                        : "in_progress",
            })
            .eq("id", ticket.id);
    }
}

// ─── Dispute Evidence Helpers ─────────────────────────────────────────

async function gatherEvidence(
    supabase: SupabaseServiceClient,
    orgId: string,
    dispute: Stripe.Dispute
): Promise<Stripe.DisputeUpdateParams.Evidence | null> {
    // Get configured evidence endpoints
    const { data: endpoints } = await supabase
        .from("dispute_evidence_endpoints")
        .select("*")
        .eq("org_id", orgId)
        .eq("enabled", true);

    if (!endpoints || endpoints.length === 0) return null;

    const evidence: Stripe.DisputeUpdateParams.Evidence = {};
    const chargeId =
        typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    const customerId =
        typeof dispute.charge === "object" && dispute.charge
            ? typeof dispute.charge.customer === "string"
                ? dispute.charge.customer
                : dispute.charge.customer?.id
            : undefined;

    for (const endpoint of endpoints) {
        try {
            // Replace placeholders in URL
            let url = endpoint.endpoint_url as string;
            url = url.replace("{customerId}", customerId || "");
            url = url.replace("{chargeId}", chargeId || "");
            url = url.replace("{disputeId}", dispute.id);

            // Build headers based on auth config
            const fetchHeaders: Record<string, string> = {
                "Content-Type": "application/json",
            };
            const authConfig = endpoint.auth_config as {
                type: string;
                credentials?: Record<string, string>;
            };

            if (authConfig.type === "api_key" && authConfig.credentials?.api_key) {
                fetchHeaders["X-API-Key"] = authConfig.credentials.api_key;
            } else if (
                authConfig.type === "bearer" &&
                authConfig.credentials?.token
            ) {
                fetchHeaders["Authorization"] =
                    `Bearer ${authConfig.credentials.token}`;
            } else if (
                authConfig.type === "basic" &&
                authConfig.credentials?.username
            ) {
                const encoded = Buffer.from(
                    `${authConfig.credentials.username}:${authConfig.credentials.password || ""}`
                ).toString("base64");
                fetchHeaders["Authorization"] = `Basic ${encoded}`;
            }

            const response = await fetch(url, {
                headers: fetchHeaders,
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                console.error(
                    `Evidence endpoint ${endpoint.evidence_type} returned ${response.status}`
                );
                continue;
            }

            const evidenceData = await response.text();

            // Map evidence type to Stripe evidence fields
            const evidenceType = endpoint.evidence_type as string;
            switch (evidenceType) {
                case "customer_communication":
                    evidence.customer_communication = evidenceData;
                    break;
                case "refund_policy":
                    evidence.refund_policy = evidenceData;
                    break;
                case "service_documentation":
                    evidence.service_documentation = evidenceData;
                    break;
                case "access_activity_log":
                    evidence.access_activity_log = evidenceData;
                    break;
                case "duplicate_charge_documentation":
                    evidence.duplicate_charge_documentation = evidenceData;
                    break;
                case "receipt":
                    // Receipt is a file ID in Stripe, store as uncategorized text
                    evidence.uncategorized_text = evidenceData;
                    break;
            }
        } catch (err) {
            console.error(
                `Error fetching evidence from endpoint ${endpoint.evidence_type}:`,
                err
            );
        }
    }

    return evidence;
}

async function gatherAndSubmitEvidence(
    supabase: SupabaseServiceClient,
    client: Stripe,
    orgId: string,
    dispute: Stripe.Dispute
) {
    const evidence = await gatherEvidence(supabase, orgId, dispute);
    if (!evidence || Object.keys(evidence).length === 0) {
        console.log(
            `No evidence gathered for dispute ${dispute.id}, skipping auto-submit`
        );
        return;
    }

    try {
        await submitDisputeEvidence(client, dispute.id, evidence);
        console.log(`Evidence submitted for dispute ${dispute.id}`);

        // Update the ticket with success message
        const { data: ticket } = await supabase
            .from("support_tickets")
            .select("id, messages")
            .eq("org_id", orgId)
            .ilike("subject", `%${dispute.id}%`)
            .single();

        if (ticket) {
            const messages = ticket.messages as Array<{
                id: string;
                sender_type: string;
                content: string;
                created_at: string;
            }>;
            messages.push({
                id: crypto.randomUUID(),
                sender_type: "bot",
                content: `Evidencia enviada automáticamente a Stripe. Campos: ${Object.keys(evidence).join(", ")}`,
                created_at: new Date().toISOString(),
            });
            await supabase
                .from("support_tickets")
                .update({ messages, status: "in_progress" })
                .eq("id", ticket.id);
        }
    } catch (err) {
        console.error(`Error submitting evidence for dispute ${dispute.id}:`, err);
    }
}

// ─── EFW (Early Fraud Warning) ───────────────────────────────────────

export async function handleEfwCreated(
    supabase: SupabaseServiceClient,
    orgId: string,
    efw: Stripe.Radar.EarlyFraudWarning
) {
    // Get EFW rules
    const { data: rules } = await supabase
        .from("unsubscription_rules")
        .select("efw_rules")
        .eq("org_id", orgId)
        .single();

    const efwRules = (rules?.efw_rules as {
        action: string;
        mark_fraudulent: boolean;
    }) || { action: "review", mark_fraudulent: false };

    // Get Stripe client for the org
    const stripeData = await getStripeClientForOrg(orgId);
    if (!stripeData) {
        console.error("No Stripe connection for org:", orgId);
        return;
    }

    const { client } = stripeData;

    // Get the charge associated with the EFW
    const chargeId =
        typeof efw.charge === "string" ? efw.charge : efw.charge?.id;

    // Create a high-priority support ticket
    await supabase.from("support_tickets").insert({
        org_id: orgId,
        source: "manual",
        status: "open",
        category: "efw",
        subject: `EFW: ${efw.id} - Cargo: ${chargeId || "desconocido"}`,
        messages: [
            {
                id: crypto.randomUUID(),
                sender_type: "bot",
                content: `Early Fraud Warning recibido.\nTipo de fraude: ${efw.fraud_type}\nCargo: ${chargeId}\nAcción configurada: ${efwRules.action}`,
                created_at: new Date().toISOString(),
            },
        ],
    });

    // Act based on EFW rules
    switch (efwRules.action) {
        case "refund_always": {
            // Automatically refund the charge
            if (chargeId) {
                try {
                    const refund = await createRefund(client, { chargeId });
                    console.log(
                        `EFW auto-refund created: ${refund.id} for charge ${chargeId}`
                    );

                    // Update ticket with refund info
                    const { data: ticket } = await supabase
                        .from("support_tickets")
                        .select("id, messages")
                        .eq("org_id", orgId)
                        .ilike("subject", `%${efw.id}%`)
                        .single();

                    if (ticket) {
                        const messages = ticket.messages as Array<{
                            id: string;
                            sender_type: string;
                            content: string;
                            created_at: string;
                        }>;
                        messages.push({
                            id: crypto.randomUUID(),
                            sender_type: "bot",
                            content: `Refund automático procesado: ${refund.id} - $${((refund.amount || 0) / 100).toFixed(2)}`,
                            created_at: new Date().toISOString(),
                        });
                        await supabase
                            .from("support_tickets")
                            .update({ messages, status: "resolved" })
                            .eq("id", ticket.id);
                    }
                } catch (err) {
                    console.error("EFW auto-refund failed:", err);
                }
            }
            break;
        }

        case "review": {
            // Ticket already created above, just log
            console.log(`EFW ${efw.id} flagged for manual review`);
            break;
        }

        case "ignore": {
            // Close the ticket immediately
            const { data: ticket } = await supabase
                .from("support_tickets")
                .select("id, messages")
                .eq("org_id", orgId)
                .ilike("subject", `%${efw.id}%`)
                .single();

            if (ticket) {
                const messages = ticket.messages as Array<{
                    id: string;
                    sender_type: string;
                    content: string;
                    created_at: string;
                }>;
                messages.push({
                    id: crypto.randomUUID(),
                    sender_type: "bot",
                    content: "EFW ignorado según configuración.",
                    created_at: new Date().toISOString(),
                });
                await supabase
                    .from("support_tickets")
                    .update({ messages, status: "closed" })
                    .eq("id", ticket.id);
            }
            break;
        }
    }

    // Mark customer as fraudulent if configured
    if (efwRules.mark_fraudulent && chargeId) {
        try {
            // Get the charge to find the customer
            const charge = await client.charges.retrieve(chargeId);
            const customerId =
                typeof charge.customer === "string"
                    ? charge.customer
                    : charge.customer?.id;

            if (customerId) {
                // Update in Stripe
                await updateCustomerMetadata(client, customerId, {
                    fraud_warning: "true",
                    fraud_warning_date: new Date().toISOString(),
                    fraud_warning_id: efw.id,
                });

                // Update in local DB
                await supabase
                    .from("customers")
                    .update({
                        metadata: {
                            fraud_warning: true,
                            fraud_warning_date: new Date().toISOString(),
                            fraud_warning_id: efw.id,
                        },
                    })
                    .eq("org_id", orgId)
                    .eq("stripe_customer_id", customerId);

                console.log(`Customer ${customerId} marked as fraudulent`);
            }
        } catch (err) {
            console.error("Error marking customer as fraudulent:", err);
        }
    }

    // Trigger automation
    await triggerAutomation(supabase, orgId, "efw_created", {
        efw,
        rules: efwRules,
    });
}

// ─── Checkout Events ──────────────────────────────────────────────────

export async function handleCheckoutCompleted(
    supabase: SupabaseServiceClient,
    orgId: string,
    session: Stripe.Checkout.Session
) {
    await triggerAutomation(supabase, orgId, "new_sale", { session });
}
