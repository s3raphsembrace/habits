import { NextResponse, type NextRequest } from "next/server";
import { routeContext } from "@/lib/supabase/server";
import { stripeRequest } from "@/lib/stripe";

/** POST /api/stripe/portal — Stripe customer portal (cancel/update payment). */
export async function POST(req: NextRequest) {
  const { supabase, user } = await routeContext(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: billing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .maybeSingle();
  if (!billing?.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found." }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const { ok, body } = await stripeRequest("/billing_portal/sessions", {
    customer: billing.stripe_customer_id,
    return_url: `${appUrl}/premium`,
  });
  if (!ok || !body.url) {
    return NextResponse.json(
      { error: body.error?.message ?? "Could not open the billing portal." },
      { status: 502 }
    );
  }
  return NextResponse.json({ url: body.url });
}
