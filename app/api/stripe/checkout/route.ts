import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { stripe, STRIPE_PRICE_ID_STARTER } from "@/lib/stripe/server";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${siteUrl}/login`, { status: 303 });
  }

  if (user.email?.toLowerCase() === "admin@lithmira.com") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?admin_exempt=true`, { status: 303 });
  }

  if (!STRIPE_PRICE_ID_STARTER) {
    return NextResponse.json({ error: "Missing STRIPE_PRICE_ID_STARTER." }, { status: 500 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; name: string | null }>();

  if (!business) {
    return NextResponse.json({ error: "Business profile not found." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${siteUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
    line_items: [{ price: STRIPE_PRICE_ID_STARTER, quantity: 1 }],
    customer_email: user.email,
    metadata: {
      user_id: user.id,
      business_id: business.id
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        business_id: business.id,
        plan: "starter"
      }
    }
  });

  if (!session.url) {
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
