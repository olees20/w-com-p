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
  const address = getString(formData.get("address"));
  const postcode = getString(formData.get("postcode"));
  const employeeCountRaw = getString(formData.get("employee_count"));
  const currentWasteProvider = getString(formData.get("current_waste_provider"));

  if (!businessName || !businessType || !address || !postcode || !employeeCountRaw) {
    return { error: "Please complete all required fields." };
  }

  const employeeCount = Number.parseInt(employeeCountRaw, 10);
  if (Number.isNaN(employeeCount) || employeeCount < 1) {
    return { error: "Employee count must be a valid number greater than 0." };
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
    address,
    postcode,
    employee_count: employeeCount,
    produces_food_waste: getBoolean(formData.get("produces_food_waste")),
    produces_hazardous_waste: getBoolean(formData.get("produces_hazardous_waste")),
    sells_packaged_goods: getBoolean(formData.get("sells_packaged_goods")),
    current_waste_provider: currentWasteProvider || null
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
