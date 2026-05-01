import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="container-page py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Simple pricing for compliance teams</h1>
          <p className="mt-3 text-slate-600">Start with one location and all core WComp compliance features.</p>
        </div>

        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Starter</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">£29<span className="text-xl text-slate-500">/month</span></p>
          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            <li>One business location</li>
            <li>Document uploads</li>
            <li>Compliance score</li>
            <li>Alerts</li>
            <li>AI assistant</li>
          </ul>
          <form action="/api/stripe/checkout" method="POST" className="mt-6">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Start Starter plan
            </button>
          </form>
          <p className="mt-3 text-center text-xs text-slate-500">
            Already have an account? <Link href="/login" className="text-brand-700">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
