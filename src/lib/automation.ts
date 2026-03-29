import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";
import {
    getStripeClientForOrg,
    createRefund,
    pauseSubscription,
    applyDiscount,
    updateCustomerMetadata,
} from "@/lib/stripe";

type SupabaseServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Triggers automation rules based on an event type and data payload.
 */
export async function triggerAutomation(
    supabase: SupabaseServiceClient,
    orgId: string,
    triggerType: string,
    data: Record<string, unknown>
) {
    const { data: rules } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("org_id", orgId)
        .eq("trigger_type", triggerType)
        .eq("enabled", true)
        .order("priority", { ascending: false });

    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
        const conditionsMet = checkConditions(rule.conditions, data);
        if (!conditionsMet) continue;

        await executeAction(
            supabase,
            orgId,
            rule.action_type,
            rule.action_config,
            data
        );
    }
}

/**
 * Evaluates a list of conditions against the provided data.
 */
export function checkConditions(
    conditions: Array<{ field: string; operator: string; value: unknown }>,
    data: Record<string, unknown>
): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const condition of conditions) {
        const fieldValue = getNestedValue(data, condition.field);

        switch (condition.operator) {
            case "equals":
                if (fieldValue !== condition.value) return false;
                break;
            case "not_equals":
                if (fieldValue === condition.value) return false;
                break;
            case "greater_than":
                if (
                    typeof fieldValue !== "number" ||
                    fieldValue <= (condition.value as number)
                )
                    return false;
                break;
            case "less_than":
                if (
                    typeof fieldValue !== "number" ||
                    fieldValue >= (condition.value as number)
                )
                    return false;
                break;
            case "contains":
                if (
                    typeof fieldValue !== "string" ||
                    !fieldValue.includes(condition.value as string)
                )
                    return false;
                break;
        }
    }

    return true;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current, key) => {
        return current && typeof current === "object"
            ? (current as Record<string, unknown>)[key]
            : undefined;
    }, obj as unknown);
}

// ─── Automation Action Executor ───────────────────────────────────────

async function executeAction(
    supabase: SupabaseServiceClient,
    orgId: string,
    actionType: string,
    actionConfig: Record<string, unknown>,
    data: Record<string, unknown>
) {
    // ── Ownership helpers ─────────────────────────────────────────────────
    async function isSubscriptionOwnedByOrg(subscriptionId: string): Promise<boolean> {
        const { data: sub } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("org_id", orgId)
            .eq("stripe_subscription_id", subscriptionId)
            .single();
        return !!sub;
    }

    async function isChargeOwnedByOrg(chargeId: string): Promise<boolean> {
        // Stripe charges are prefixed with ch_ and tied to a customer.
        // We verify the customer exists in this org via the customers table.
        // For full certainty we look at the charge in our events log.
        const { data: event } = await supabase
            .from("stripe_events")
            .select("id")
            .eq("org_id", orgId)
            .filter("payload->>charge", "eq", chargeId)
            .limit(1)
            .maybeSingle();
        if (event) return true;

        // Fallback: check if any matching charge is in invoice events for this org
        const { data: invoiceEvent } = await supabase
            .from("stripe_events")
            .select("id")
            .eq("org_id", orgId)
            .filter("payload->>id", "eq", chargeId)
            .limit(1)
            .maybeSingle();
        return !!invoiceEvent;
    }

    switch (actionType) {
        // ─── Send Email ──────────────────────────────────────────
        case "send_email": {
            try {
                const templateId = actionConfig.template_id as string | undefined;
                let subject = (actionConfig.subject as string) || "Notificación";
                let htmlContent =
                    (actionConfig.html_content as string) || "";

                // If a template is referenced, load it from DB
                if (templateId) {
                    const { data: template } = await supabase
                        .from("email_templates")
                        .select("subject, html_content")
                        .eq("id", templateId)
                        .eq("org_id", orgId)
                        .single();

                    if (template) {
                        subject = template.subject;
                        htmlContent = template.html_content;
                    }
                }

                // Replace template variables with data
                const replaceVars = (text: string) => {
                    return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
                        const value = getNestedValue(data, path);
                        return value !== undefined ? String(value) : `{{${path}}}`;
                    });
                };

                subject = replaceVars(subject);
                htmlContent = replaceVars(htmlContent);

                // Determine recipient
                const to =
                    (actionConfig.to as string) ||
                    (getNestedValue(data, "invoice.customer_email") as string) ||
                    (getNestedValue(data, "subscription.customer.email") as string);

                if (to && htmlContent) {
                    await sendEmail({
                        to,
                        subject,
                        html: htmlContent,
                        from:
                            (actionConfig.from as string) ||
                            "Twenit <noreply@yourdomain.com>",
                    });
                    console.log(`Email sent to ${to} for org ${orgId}`);
                } else {
                    console.log(
                        "Email action skipped: missing recipient or content",
                        { to, hasContent: !!htmlContent }
                    );
                }
            } catch (err) {
                console.error("Email action failed:", err);
            }
            break;
        }

        // ─── Create Ticket ───────────────────────────────────────
        case "create_ticket": {
            await supabase.from("support_tickets").insert({
                org_id: orgId,
                source: "manual",
                status: "open",
                category: (actionConfig.category as string) || "automation",
                subject: (actionConfig.subject as string) || "Ticket automático",
                messages: [
                    {
                        id: crypto.randomUUID(),
                        sender_type: "bot",
                        content:
                            (actionConfig.message as string) || JSON.stringify(data),
                        created_at: new Date().toISOString(),
                    },
                ],
            });
            break;
        }

        // ─── Apply Discount ──────────────────────────────────────
        case "apply_discount": {
            const stripeData = await getStripeClientForOrg(orgId);
            if (!stripeData) break;

            const subscriptionId =
                (actionConfig.subscription_id as string) ||
                (getNestedValue(data, "subscription.id") as string);
            const percentOff = (actionConfig.percent_off as number) || 10;
            const durationMonths =
                (actionConfig.duration_months as number) || 1;

            if (subscriptionId) {
                if (!(await isSubscriptionOwnedByOrg(subscriptionId))) {
                    console.warn(`[Automation] Blocked discount: sub ${subscriptionId} not owned by org ${orgId}`);
                    break;
                }
                try {
                    await applyDiscount(
                        stripeData.client,
                        subscriptionId,
                        percentOff,
                        durationMonths
                    );
                    console.log(
                        `Discount ${percentOff}% applied to subscription ${subscriptionId}`
                    );
                } catch (err) {
                    console.error("Apply discount action failed:", err);
                }
            }
            break;
        }

        // ─── Pause Subscription ──────────────────────────────────
        case "pause_subscription": {
            const stripeData = await getStripeClientForOrg(orgId);
            if (!stripeData) break;

            const subscriptionId =
                (actionConfig.subscription_id as string) ||
                (getNestedValue(data, "subscription.id") as string);

            if (subscriptionId) {
                if (!(await isSubscriptionOwnedByOrg(subscriptionId))) {
                    console.warn(`[Automation] Blocked pause: sub ${subscriptionId} not owned by org ${orgId}`);
                    break;
                }
                try {
                    await pauseSubscription(stripeData.client, subscriptionId);
                    console.log(`Subscription ${subscriptionId} paused`);
                } catch (err) {
                    console.error("Pause subscription action failed:", err);
                }
            }
            break;
        }

        // ─── Refund ──────────────────────────────────────────────
        case "refund": {
            const stripeData = await getStripeClientForOrg(orgId);
            if (!stripeData) break;

            const chargeId =
                (actionConfig.charge_id as string) ||
                (getNestedValue(data, "invoice.charge") as string);
            const paymentIntentId =
                (actionConfig.payment_intent_id as string) ||
                (getNestedValue(data, "invoice.payment_intent") as string);
            const amount = actionConfig.amount as number | undefined;

            if (chargeId || paymentIntentId) {
                // Ownership check: verify the charge belongs to this org
                if (chargeId && !(await isChargeOwnedByOrg(chargeId))) {
                    console.warn(`[Automation] Blocked refund: charge ${chargeId} not owned by org ${orgId}`);
                    break;
                }
                try {
                    const refund = await createRefund(stripeData.client, {
                        chargeId,
                        paymentIntentId,
                        amount,
                    });
                    console.log(`Refund ${refund.id} created for org ${orgId}`);
                } catch (err) {
                    console.error("Refund action failed:", err);
                }
            }
            break;
        }

        // ─── Tag Customer ────────────────────────────────────────
        case "tag_customer": {
            const stripeData = await getStripeClientForOrg(orgId);
            if (!stripeData) break;

            const customerId =
                (actionConfig.customer_id as string) ||
                (getNestedValue(data, "subscription.customer") as string) ||
                (getNestedValue(data, "invoice.customer") as string);
            const tags = (actionConfig.tags as Record<string, string>) || {};

            if (customerId && Object.keys(tags).length > 0) {
                try {
                    await updateCustomerMetadata(stripeData.client, customerId, tags);

                    // Update local DB too
                    const { data: dbCustomer } = await supabase
                        .from("customers")
                        .select("metadata")
                        .eq("org_id", orgId)
                        .eq("stripe_customer_id", customerId)
                        .single();

                    if (dbCustomer) {
                        await supabase
                            .from("customers")
                            .update({
                                metadata: { ...(dbCustomer.metadata as Record<string, unknown>), ...tags },
                            })
                            .eq("org_id", orgId)
                            .eq("stripe_customer_id", customerId);
                    }

                    console.log(`Customer ${customerId} tagged:`, tags);
                } catch (err) {
                    console.error("Tag customer action failed:", err);
                }
            }
            break;
        }

        // ─── Call Webhook ────────────────────────────────────────
        case "call_webhook": {
            if (actionConfig.url) {
                try {
                    await fetch(actionConfig.url as string, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                    });
                } catch (error) {
                    console.error("Webhook call failed:", error);
                }
            }
            break;
        }
    }
}
