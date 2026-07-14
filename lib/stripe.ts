import { createHmac, timingSafeEqual } from "crypto";

/**
 * Minimal Stripe REST helpers — no SDK dependency. Stripe's API takes
 * form-encoded bodies and returns JSON; webhook signatures are HMAC-SHA256
 * over `${timestamp}.${rawBody}`.
 */

const STRIPE_API = "https://api.stripe.com/v1";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export async function stripeRequest(
  path: string,
  params: Record<string, string>
): Promise<{ ok: boolean; body: any }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, body: { error: { message: "Stripe not configured" } } };

  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

/** Verifies a `Stripe-Signature` header against the raw request body. */
export function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): boolean {
  if (!sigHeader) return false;
  const parts = new Map(
    sigHeader.split(",").map((kv) => {
      const [k, ...rest] = kv.split("=");
      return [k.trim(), rest.join("=")] as const;
    })
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
