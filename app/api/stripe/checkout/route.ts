import { NextResponse, type NextRequest } from "next/server";
import { routeContext } from "@/lib/supabase/server";
import { stripeConfigured, stripeRequest } from "@/lib/stripe";

/**
 * POST /api/stripe/checkout — creates a Stripe Checkout session for the
 * Premium subscription and returns its URL. The webhook (not this route)
 * flips is_premium after payment, so a user abandoning checkout changes
 * nothing.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured yet (missing STRIPE_SECRET_KEY / STRIPE_PRICE_ID)." },
      { status: 503 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": process.env.STRIPE_PRICE_ID!,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/premium?status=success`,
    cancel_url: `${appUrl}/premium?status=cancelled`,
    client_reference_id: user.id,
  };

  // Reuse the Stripe customer if they subscribed before; otherwise let
  // Checkout create one, prefilled with their email.
  const { data: billing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .maybeSingle();
  if (billing?.stripe_customer_id) params.customer = billing.stripe_customer_id;
  else if (user.email) params.customer_email = user.email;

  const { ok, body } = await stripeRequest("/checkout/sessions", params);
  if (!ok || !body.url) {
    return NextResponse.json(
      { error: body.error?.message ?? "Could not start checkout." },
      { status: 502 }
    );
  }
  return NextResponse.json({ url: body.url });
}
