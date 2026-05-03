"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateAccountDetails(formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const businessName = getString(formData.get("name"));
  const businessType = getString(formData.get("business_type"));
  const address = getString(formData.get("address"));
  const postcode = getString(formData.get("postcode"));
  const currentWasteProvider = getString(formData.get("current_waste_provider"));

  if (!businessName || !businessType) {
    redirect("/dashboard/account?error=Business+name+and+type+are+required");
  }

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle<{ id: string }>();

  if (!business) {
    redirect("/dashboard/account?error=Business+profile+not+found");
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      name: businessName,
      business_type: businessType,
      address: address || null,
      postcode: postcode || null,
      current_waste_provider: currentWasteProvider || null
    })
    .eq("id", business.id);

  if (error) {
    redirect(`/dashboard/account?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard/account?success=Details+updated");
}

export async function changePassword(formData: FormData) {
  const supabase = await createServerClient();
  const newPassword = getString(formData.get("new_password"));

  if (!newPassword || newPassword.length < 8) {
    redirect("/dashboard/account?error=Password+must+be+at+least+8+characters");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    redirect(`/dashboard/account?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard/account?success=Password+updated");
}

export async function deleteAccount() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  await supabase.auth.signOut();
  await supabaseAdmin.auth.admin.deleteUser(userId);

  redirect("/signup?success=Account+deleted");
}
