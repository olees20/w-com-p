"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function markAlertResolved(formData: FormData) {
  const alertId = formData.get("alert_id");

  if (typeof alertId !== "string" || !alertId) {
    return;
  }

  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle<{ id: string }>();

  if (!business) {
    return;
  }

  await supabase
    .from("alerts")
    .update({ status: "resolved" })
    .eq("id", alertId)
    .eq("business_id", business.id)
    .eq("status", "open");
}
