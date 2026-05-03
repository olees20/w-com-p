"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "admin@lithmira.com";

export async function refreshGuidanceSourcesAction() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return { success: false, error: "Unauthorized" };
  }

  const secret = process.env.ADMIN_REFRESH_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!secret || !appUrl) {
    return { success: false, error: "Missing ADMIN_REFRESH_SECRET or NEXT_PUBLIC_APP_URL" };
  }

  const response = await fetch(`${appUrl}/api/admin/refresh-regulatory-sources`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    return { success: false, error: `Refresh failed: ${message}` };
  }

  revalidatePath("/dashboard/rules");
  return { success: true };
}
