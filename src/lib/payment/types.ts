
export interface PaymentEvent {
    id: string;
    type: string;
    provider: "stripe" | "paypal" | "other";
    data: Record<string, unknown>;
    timestamp: string;
}

export interface PaymentProvider {
    name: string;
    processWebhook(payload: unknown, signature: string): Promise<PaymentEvent | null>;
    // Future methods: createSubscription, refund, etc.
}
