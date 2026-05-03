"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export type OnboardingState = {
  error?: string;
};

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: FormDataEntryValue | null) {
  return value === "on";
}

export async function saveBusinessOnboarding(
  _: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const businessName = getString(formData.get("business_name"));
  const businessType = getString(formData.get("business_type"));
  const sitesCountRaw = getString(formData.get("sites_count"));

  if (!businessName || !businessType || !sitesCountRaw) {
    return { error: "Please complete all required fields." };
  }

  const sitesCount = Number.parseInt(sitesCountRaw, 10);
  if (Number.isNaN(sitesCount) || sitesCount < 1) {
    return { error: "Number of sites must be a valid number greater than 0." };
  }

  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const payload = {
    user_id: user.id,
    name: businessName,
    business_type: businessType,
    sites_count: sitesCount,
    produces_food_waste: getBoolean(formData.get("produces_food_waste")),
    produces_hazardous_waste: getBoolean(formData.get("produces_hazardous_waste")),
    sells_packaged_goods: false
  };

  const { data: existingBusiness, error: findError } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (findError) {
    return { error: `Could not check existing profile: ${findError.message}` };
  }

  const query = existingBusiness
    ? supabase.from("businesses").update(payload).eq("id", existingBusiness.id)
    : supabase.from("businesses").insert(payload);

  const { error: saveError } = await query;

  if (saveError) {
    return { error: `Could not save business profile: ${saveError.message}` };
  }

  redirect("/dashboard");
}
