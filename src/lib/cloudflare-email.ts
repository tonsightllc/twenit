/**
 * Cloudflare Email Routing API
 * Creates/deletes custom email addresses on a subdomain (e.g. mail.twenit.com)
 * that route to the email-inbound Worker.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN   – API token with Email Routing edit permissions
 *   CLOUDFLARE_ZONE_ID     – Zone ID for twenit.com (found in Cloudflare Dashboard > Overview)
 *   CLOUDFLARE_WORKER_NAME – Name of the deployed Email Worker (default: "email-inbound")
 */

const CF_API = "https://api.cloudflare.com/client/v4";

function getConfig() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const workerName = process.env.CLOUDFLARE_WORKER_NAME ?? "email-inbound";

  if (!token || !zoneId) {
    throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are required");
  }

  return { token, zoneId, workerName };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Create an email routing rule: address@mail.twenit.com -> Worker
 */
export async function createEmailRoute(address: string): Promise<{ success: boolean; error?: string; ruleId?: string }> {
  const { token, zoneId, workerName } = getConfig();

  const res = await fetch(`${CF_API}/zones/${zoneId}/email/routing/rules`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      actions: [{ type: "worker", value: [workerName] }],
      matchers: [{ type: "literal", field: "to", value: address }],
      enabled: true,
      name: `CRM inbound: ${address}`,
    }),
  });

  const data = await res.json();

  if (!data.success) {
    const errorMsg = data.errors?.[0]?.message ?? "Error creating email route";
    console.error("Cloudflare create email route error:", data.errors);
    return { success: false, error: errorMsg };
  }

  return { success: true, ruleId: data.result?.tag };
}

/**
 * Delete an email routing rule by searching for the address.
 */
export async function deleteEmailRoute(address: string): Promise<{ success: boolean }> {
  const { token, zoneId } = getConfig();

  // List rules and find the one matching this address
  const listRes = await fetch(`${CF_API}/zones/${zoneId}/email/routing/rules?per_page=50`, {
    headers: headers(token),
  });

  const listData = await listRes.json();
  if (!listData.success) return { success: false };

  const rules = listData.result ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rule = rules.find((r: any) =>
    r.matchers?.some((m: { type: string; value: string }) => m.value === address)
  );

  if (!rule) return { success: true };

  const delRes = await fetch(`${CF_API}/zones/${zoneId}/email/routing/rules/${rule.tag}`, {
    method: "DELETE",
    headers: headers(token),
  });

  const delData = await delRes.json();
  return { success: delData.success };
}
