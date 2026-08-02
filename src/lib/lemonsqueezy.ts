export type ProductKey = "guide" | "insider-monthly" | "insider-yearly";

function variantEnvVar(productKey: ProductKey): string | undefined {
  switch (productKey) {
    case "guide":
      return process.env.LS_VARIANT_GUIDE;
    case "insider-monthly":
      return process.env.LS_VARIANT_INSIDER_MONTHLY;
    case "insider-yearly":
      return process.env.LS_VARIANT_INSIDER_YEARLY;
  }
}

const ALL_PRODUCT_KEYS: ProductKey[] = ["guide", "insider-monthly", "insider-yearly"];

export function variantIdForProductKey(productKey: ProductKey): string {
  const variantId = variantEnvVar(productKey);
  if (!variantId) {
    throw new Error(`No Lemon Squeezy variant id configured for productKey "${productKey}"`);
  }
  return variantId;
}

/** Maps an incoming webhook's variant_id back to our internal productKey. */
export function productKeyForVariantId(variantId: string | number): ProductKey | null {
  const id = String(variantId);
  for (const key of ALL_PRODUCT_KEYS) {
    if (variantEnvVar(key) === id) return key;
  }
  return null;
}

interface CreateCheckoutArgs {
  productKey: ProductKey;
  email?: string;
  /** The logged-in buyer's user id, if any — see resolveUser() in the webhook
   * route for why this takes priority over email matching. */
  userId?: number;
}

/** Creates a Lemon Squeezy hosted checkout and returns its URL. Server-only. */
export async function createCheckoutUrl({ productKey, email, userId }: CreateCheckoutArgs): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!apiKey || !storeId) {
    throw new Error("LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID must be set.");
  }

  const variantId = variantIdForProductKey(productKey);

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email,
            // Echoed back as meta.custom_data on every order/subscription webhook.
            custom: userId ? { productKey, userId: String(userId) } : { productKey },
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lemon Squeezy checkout creation failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const url = json?.data?.attributes?.url;
  if (typeof url !== "string") {
    throw new Error("Lemon Squeezy checkout response did not include a url.");
  }
  return url;
}

/**
 * Fetches a subscription's current state from the Lemon Squeezy API and
 * returns the raw JSON:API resource (`{ id, type, attributes }`).
 *
 * The webhook handler needs this because `subscription_payment_success`
 * delivers a `subscription-invoices` object, which has no `renews_at` — the
 * new paid-through date only exists on the subscription itself.
 */
export async function fetchSubscriptionResource(
  lsSubscriptionId: string,
): Promise<{ id: string; type: string; attributes: Record<string, unknown> }> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY must be set.");
  }

  const res = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${lsSubscriptionId}`, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lemon Squeezy subscription fetch failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const data = json?.data;
  if (!data || typeof data.id === "undefined" || !data.attributes) {
    throw new Error(`Lemon Squeezy subscription ${lsSubscriptionId} response had no usable data object.`);
  }

  return { id: String(data.id), type: String(data.type ?? "subscriptions"), attributes: data.attributes };
}

/**
 * Fetches a fresh customer-portal URL for a subscription. Lemon Squeezy
 * pre-signs this URL and it expires 24h after the request, so it must be
 * fetched on demand — never stored from an old webhook payload.
 */
export async function getCustomerPortalUrl(lsSubscriptionId: string): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY must be set.");
  }

  const res = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${lsSubscriptionId}`, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lemon Squeezy subscription fetch failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const url = json?.data?.attributes?.urls?.customer_portal;
  if (typeof url !== "string") {
    throw new Error("Lemon Squeezy response did not include a customer_portal url.");
  }
  return url;
}
