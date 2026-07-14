import { NextResponse, type NextRequest } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/stripe/webhook — the ONLY writer of billing_customers.
 * Configure in Stripe dashboard (Developers → Webhooks) pointing at
 * https://<your-app>/api/stripe/webhook with events:
 *   checkout.session.completed, customer.subscription.updated,
 *   customer.subscription.deleted
 * Signature verification makes forged requests useless, and the table's RLS
 * (no user write policies) means this service-role path is the only way in.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const rawBody = await req.text();
  if (!verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const customerId = session.customer;
    if (userId && customerId) {
      await admin.from("billing_customers").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          is_premium: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const active =
      event.type !== "customer.subscription.deleted" &&
      (sub.status === "active" || sub.status === "trialing");
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;
    await admin
      .from("billing_customers")
      .update({
        is_premium: active,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", sub.customer);
  }

  return NextResponse.json({ received: true });
}
