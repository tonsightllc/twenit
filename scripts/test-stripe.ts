
import { handleCustomerEvent } from "@/lib/stripe/events";
import { assert } from "console";

// Mock Supabase Client
const createMockSupabase = (existingData: any[] = []) => {
    let store = [...existingData];
    const calls: string[] = [];

    const mock = {
        from: (table: string) => {
            calls.push(`from:${table}`);
            return {
                select: (cols: string) => {
                    calls.push(`select:${cols}`);
                    return {
                        eq: (col: string, val: any) => {
                            calls.push(`eq:${col}=${val}`);
                            return {
                                eq: (col2: string, val2: any) => {
                                    calls.push(`eq:${col2}=${val2}`);
                                    return {
                                        single: async () => {
                                            calls.push("single");
                                            // Simple implementation for test
                                            const found = store.find(item => item[col] === val && item[col2] === val2);
                                            return { data: found || null, error: found ? null : "Not found" };
                                        }
                                    };
                                },
                                single: async () => {
                                    calls.push("single");
                                    const found = store.find(item => item[col] === val);
                                    return { data: found || null, error: found ? null : "Not found" };
                                }
                            };
                        }
                    };
                },
                update: (data: any) => {
                    calls.push(`update:${JSON.stringify(data)}`);
                    return {
                        eq: (col: string, val: any) => {
                            calls.push(`eq:${col}=${val}`);
                            // Update implementation
                            store = store.map(item => item[col] === val ? { ...item, ...data } : item);
                            return { data: null, error: null };
                        }
                    };
                },
                upsert: (data: any, options: any) => {
                    calls.push(`upsert:${JSON.stringify(data)}`);
                    // Upsert implementation
                    const existingIndex = store.findIndex(item => item.stripe_customer_id === data.stripe_customer_id && item.org_id === data.org_id);
                    if (existingIndex >= 0) {
                        store[existingIndex] = { ...store[existingIndex], ...data };
                    } else {
                        store.push(data);
                    }
                    return { data: null, error: null };
                }
            };
        },
        _getCalls: () => calls,
        _getStore: () => store
    };

    return mock as any;
};

async function testLinkByEmail() {
    console.log("TEST: Link by Email");
    const orgId = "org_123";
    const email = "test@example.com";
    const existingCustomer = {
        id: "uuid_1",
        org_id: orgId,
        email: email,
        stripe_customer_id: "cus_old" // Intentionally different
    };

    const mockSupabase = createMockSupabase([existingCustomer]);

    const newStripeCustomer = {
        id: "cus_new",
        email: email,
        name: "Updated Name",
        metadata: {}
    } as any; // Cast as Stripe.Customer

    await handleCustomerEvent(mockSupabase, orgId, newStripeCustomer);

    const calls = mockSupabase._getCalls();
    const store = mockSupabase._getStore();

    console.log("Calls:", calls);

    // Verify update was called
    const updateCall = calls.find((c: string) => c.startsWith("update:"));
    if (!updateCall) {
        console.error("FAIL: Update was not called");
        process.exit(1);
    } else {
        console.log("PASS: Update called to link customer");
    }

    // Verify store state
    const updatedCustomer = store.find((c: any) => c.id === "uuid_1");
    if (updatedCustomer.stripe_customer_id !== "cus_new") {
        console.error(`FAIL: expected stripe_customer_id to be cus_new, got ${updatedCustomer.stripe_customer_id}`);
        process.exit(1);
    } else {
        console.log("PASS: Database updated correctly");
    }
}

async function testNewCustomer() {
    console.log("\nTEST: New Customer");
    const orgId = "org_123";
    const email = "new@example.com";

    const mockSupabase = createMockSupabase([]);

    const newStripeCustomer = {
        id: "cus_brand_new",
        email: email,
        name: "New User",
        metadata: {}
    } as any;

    await handleCustomerEvent(mockSupabase, orgId, newStripeCustomer);

    const calls = mockSupabase._getCalls();

    // Verify upsert was called
    const upsertCall = calls.find((c: string) => c.startsWith("upsert:"));
    if (!upsertCall) {
        console.error("FAIL: Upsert was not called");
        process.exit(1);
    } else {
        console.log("PASS: Upsert called to create customer");
    }
}

async function run() {
    try {
        await testLinkByEmail();
        await testNewCustomer();
        console.log("\nALL TESTS PASSED");
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

run();
