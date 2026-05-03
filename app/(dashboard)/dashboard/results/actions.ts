"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { completeHealthCheck, getEditableActiveHealthCheck } from "@/lib/health-checks";

export async function completeHealthCheckAction() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle<{ id: string }>();
  if (!business) return;

  const active = await getEditableActiveHealthCheck(business.id, user.id);
  if (!active) return;

  await completeHealthCheck({ healthCheckId: active.id, businessId: business.id, userId: user.id });

  revalidatePath("/dashboard/results");
  revalidatePath("/dashboard/audit-pack");
  revalidatePath("/dashboard/upload");
  revalidatePath("/dashboard/documents");
}
