import Link from "next/link";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    q: "Who is WComp for?",
    a: "WComp is designed for small UK businesses including cafes, restaurants, salons, offices, workshops, and small warehouses."
  },
  {
    q: "Do I need compliance expertise to use it?",
    a: "No. WComp turns your records, deadlines, and risks into clear actions so your team knows what to do next."
  },
  {
    q: "What happens before an inspection?",
    a: "You can review open issues, check your audit pack, and export a printable summary of your key compliance records."
  },
  {
    q: "Does WComp replace legal advice?",
    a: "No. WComp helps you stay organised and inspection-ready, but it does not replace official guidance or qualified advice."
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="text-base font-semibold tracking-tight">
            WComp
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Log in
            </Link>
            <Button href="/signup">Start free</Button>
          </div>
        </div>
      </header>

      <section className="container-page py-16 sm:py-20">
        <p className="text-sm font-medium text-brand-700">Waste Compliance Monitor</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
          WComp monitors your waste compliance so your business is always inspection-ready.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          Keep documents, alerts, and compliance checks in one place. Get clear priorities each week so nothing critical is missed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/signup">Start free</Button>
          <Button href="/pricing" variant="secondary">
            View pricing
          </Button>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container-page py-14">
          <h2 className="text-2xl font-semibold tracking-tight">The problem for small teams</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium">Records are scattered</p>
              <p className="mt-1 text-sm text-slate-600">Transfer notes, licences, and invoices live across inboxes, folders, and paper files.</p>
            </article>
            <article className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium">Deadlines get missed</p>
              <p className="mt-1 text-sm text-slate-600">Expiry dates and monthly checks are easy to forget when everyone is busy.</p>
            </article>
            <article className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium">Inspection stress</p>
              <p className="mt-1 text-sm text-slate-600">When asked for evidence, teams scramble instead of responding with confidence.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-brand-700">1. Set up your profile</p>
            <p className="mt-2 text-sm text-slate-600">Add your business details and waste profile in minutes.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-brand-700">2. Upload compliance documents</p>
            <p className="mt-2 text-sm text-slate-600">Store key records in one secure place and keep your evidence organised.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-brand-700">3. Monitor and act</p>
            <p className="mt-2 text-sm text-slate-600">WComp highlights risk, open alerts, and next actions to stay inspection-ready.</p>
          </article>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container-page py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard preview</h2>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">Compliance status</p>
                <p className="mt-1 text-xl font-semibold">Attention Needed</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">Compliance score</p>
                <p className="mt-1 text-xl font-semibold">78%</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">Open alerts</p>
                <p className="mt-1 text-xl font-semibold">3</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              See what is missing, what is urgent, and what to fix first without digging through paperwork.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="text-2xl font-semibold tracking-tight">Features built for peace of mind</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Compliance scoring</p>
            <p className="mt-2 text-sm text-slate-600">Know where you stand today with a clear score and status.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Smart alerting</p>
            <p className="mt-2 text-sm text-slate-600">Catch missing records, upcoming expiries, and unresolved risks early.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Audit pack export</p>
            <p className="mt-2 text-sm text-slate-600">Generate a clean printable pack with key records and current status.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Document storage</p>
            <p className="mt-2 text-sm text-slate-600">Keep transfer notes, licences, and reports tied to your business profile.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Clear action planning</p>
            <p className="mt-2 text-sm text-slate-600">Prioritise what to resolve first based on compliance impact.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium">Assistant support</p>
            <p className="mt-2 text-sm text-slate-600">Ask practical questions using your own records and dashboard context.</p>
          </article>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container-page py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
          <div className="mt-6 max-w-xl rounded-xl border border-slate-200 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Starter</p>
            <p className="mt-2 text-4xl font-semibold">£29<span className="text-xl text-slate-500">/month</span></p>
            <p className="mt-2 text-sm text-slate-600">One business location with full core monitoring and audit readiness tools.</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>Document uploads</li>
              <li>Compliance score and status</li>
              <li>Automated alerts</li>
              <li>AI assistant</li>
            </ul>
            <div className="mt-6">
              <Button href="/signup">Start Starter plan</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
        <div className="mt-6 space-y-3">
          {faqs.map((item) => (
            <article key={item.q} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-medium text-slate-900">{item.q}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-brand-900">
        <div className="container-page py-14 text-white">
          <h2 className="text-3xl font-semibold tracking-tight">Stay inspection-ready without the guesswork</h2>
          <p className="mt-3 max-w-2xl text-brand-100">
            Join small UK businesses using WComp to monitor compliance risk, stay organised, and act before issues escalate.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/signup">Create your account</Button>
            <Button href="/pricing" variant="secondary">
              View pricing
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
