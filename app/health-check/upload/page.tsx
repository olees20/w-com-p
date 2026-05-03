import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function HealthCheckUploadRedirectPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle();

  if (!business) {
    redirect("/onboarding");
  }

  redirect("/dashboard/upload");
}
