import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";

export async function POST() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${siteUrl}/login`, { status: 303 });
  }

  if (user.email?.toLowerCase() === "admin@lithmira.com") {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?admin_exempt=true`, { status: 303 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?portal=unavailable`, { status: 303 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${siteUrl}/dashboard/billing`
  });

  return NextResponse.redirect(portal.url, { status: 303 });
}
