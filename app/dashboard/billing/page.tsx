import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUserSubscription } from "@/lib/stripe/subscription";

export default async function BillingPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { subscription, isActive } = await getCurrentUserSubscription();

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="container-page py-10">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Billing</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage your Starter subscription and payment method.
          </p>

          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              Status: <span className="font-medium">{subscription?.status ?? "inactive"}</span>
            </p>
            <p className="mt-1">Plan: starter</p>
            <p className="mt-1">Next billing date: {subscription?.current_period_end ?? "N/A"}</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                {isActive ? "Change plan" : "Activate subscription"}
              </button>
            </form>

            <form action="/api/stripe/billing-portal" method="POST">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open billing portal
              </button>
            </form>
          </div>

          <div className="mt-5 text-sm">
            <Link href="/dashboard" className="text-brand-700">
              Back to dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
