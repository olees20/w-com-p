import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUserSubscription } from "@/lib/stripe/subscription";

export default async function BillingPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { subscription, isActive } = await getCurrentUserSubscription();
  const isAdminBypass = user.email?.toLowerCase() === "admin@lithmira.com";

  return (
    <main className="space-y-4">
      <section className="app-panel p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#123026]">Billing</h1>
        <p className="mt-1 text-sm text-[#5f746d]">Manage your Starter subscription and billing information.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="app-panel p-6">
          <h2 className="text-sm font-bold text-[#1d3a31]">Plan & Usage</h2>
          <div className="mt-4 rounded-xl border border-[#dce6e2] p-4">
            <p className="text-xl font-extrabold text-[#123026]">Starter Plan</p>
            <p className="mt-1 text-sm text-[#5f746d]">£29 / month</p>
            <p className="mt-2 text-sm text-[#5f746d]">
              Status: <span className="font-semibold">{isAdminBypass ? "active (admin exempt)" : subscription?.status ?? "inactive"}</span>
            </p>
          </div>

          {isAdminBypass ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              This account is exempt from billing and has full feature access.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form action="/api/stripe/checkout" method="POST">
                <button type="submit" className="w-full rounded-lg bg-[#0f5b46] px-4 py-2 text-sm font-bold text-white hover:bg-[#0c4939]">
                  {isActive ? "Manage plan" : "Activate subscription"}
                </button>
              </form>
              <form action="/api/stripe/billing-portal" method="POST">
                <button type="submit" className="w-full rounded-lg border border-[#d3e2dc] bg-white px-4 py-2 text-sm font-bold text-[#21453a] hover:bg-[#f3f8f6]">
                  Open billing portal
                </button>
              </form>
            </div>
          )}
        </div>

        <aside className="app-panel p-6">
          <h2 className="text-sm font-bold text-[#1d3a31]">Summary</h2>
          <div className="mt-4 space-y-2 text-sm text-[#5f746d]">
            <p>Plan: Starter</p>
            <p>Next billing date: {subscription?.current_period_end ?? "N/A"}</p>
            <p>Payment method: Managed in Stripe billing portal</p>
          </div>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-[#0f5b46]">
            Back to dashboard
          </Link>
        </aside>
      </section>
    </main>
  );
}
