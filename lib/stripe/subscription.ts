import { createServerClient } from "@/lib/supabase/server";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function getCurrentUserSubscription() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, business: null, subscription: null, isActive: false };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id,status,price_id,stripe_customer_id,stripe_subscription_id,current_period_end")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      status: string | null;
      price_id: string | null;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      current_period_end: string | null;
    }>();

  const isActive = ACTIVE_STATUSES.has((subscription?.status ?? "").toLowerCase());

  return { user, business: null, subscription: subscription ?? null, isActive };
}
