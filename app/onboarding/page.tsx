import { redirect } from "next/navigation";
import { BusinessOnboardingForm } from "@/components/onboarding/business-onboarding-form";
import { createServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingBusiness } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingBusiness) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="container-page py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Business onboarding</h1>
          <p className="mt-2 text-sm text-slate-600">
            Tell us about your business so Waste Compliance Monitor can calculate compliance requirements and risks.
          </p>
          <div className="mt-6">
            <BusinessOnboardingForm />
          </div>
        </div>
      </section>
    </main>
  );
}
