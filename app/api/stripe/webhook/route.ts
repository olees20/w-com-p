import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function toIso(timestamp: number | null | undefined) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

async function upsertSubscription(input: {
  user_id: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  price_id: string | null;
  current_period_end: string | null;
}) {
  const { user_id, ...rest } = input;

  if (!user_id) {
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", user_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing) {
    await supabaseAdmin.from("subscriptions").update({ ...rest }).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("subscriptions").insert({ user_id, ...rest });
  }
}

async function getUserFromCustomer(customerId: string) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ user_id: string }>();

  return data ?? null;
}

async function createActiveHealthCheck(input: {
  user_id: string | null;
  business_id: string | null;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id: string | null;
  paid_at: string;
}) {
  if (!input.user_id || !input.business_id) return;

  await supabaseAdmin
    .from("health_checks")
    .update({ status: "expired", locked_at: new Date().toISOString() })
    .eq("user_id", input.user_id)
    .eq("business_id", input.business_id)
    .eq("status", "active")
    .is("locked_at", null);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from("health_checks").insert({
    user_id: input.user_id,
    business_id: input.business_id,
    stripe_checkout_session_id: input.stripe_checkout_session_id,
    stripe_payment_intent_id: input.stripe_payment_intent_id,
    status: "active",
    paid_at: input.paid_at,
    started_at: input.paid_at,
    expires_at: expiresAt
  });
}

export async function POST(request: Request) {
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook signature or secret." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook signature verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = (session.metadata?.user_id as string | undefined) ?? null;
      const businessId = (session.metadata?.business_id as string | undefined) ?? null;

      if (session.mode === "payment" && session.payment_status === "paid") {
        await upsertSubscription({
          user_id: userId,
          stripe_customer_id: session.customer ? String(session.customer) : "no_customer",
          stripe_subscription_id: session.id,
          status: "paid",
          price_id: session.metadata?.price_id ?? null,
          current_period_end: null
        });
        await createActiveHealthCheck({
          user_id: userId,
          business_id: businessId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
          paid_at: new Date().toISOString()
        });
      } else if (session.subscription && session.customer) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertSubscription({
          user_id: userId,
          stripe_customer_id: String(session.customer),
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          price_id: subscription.items.data[0]?.price.id ?? null,
          current_period_end: toIso(subscription.current_period_end)
        });
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = String(subscription.customer);
      const mapped = await getUserFromCustomer(customerId);

      if (mapped) {
        await upsertSubscription({
          user_id: mapped.user_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          price_id: subscription.items.data[0]?.price.id ?? null,
          current_period_end: toIso(subscription.current_period_end)
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
