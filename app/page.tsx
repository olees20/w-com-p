import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    q: "Who is Waste Compliance Monitor for?",
    a: "Small UK businesses including cafes, restaurants, salons, offices, workshops, and small warehouses."
  },
  {
    q: "Do I need compliance expertise?",
    a: "No. Waste Compliance Monitor translates records and risk into practical actions for your team."
  },
  {
    q: "Can I prepare for inspections quickly?",
    a: "Yes. Your dashboard, alerts, and audit pack are built to show readiness at a glance."
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen text-[#143027]">
      <header className="border-b border-[#d8e5df] bg-white/80 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <Image src="/logo-sml.png" alt="Waste Compliance Monitor" width={168} height={38} priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-[#557067]">
              Log in
            </Link>
            <Button href="/signup">Start free</Button>
          </div>
        </div>
      </header>

      <section className="container-page py-16">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#2a6d59]">Waste Compliance Monitor</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Waste Compliance Monitor monitors your waste compliance so your business is always inspection-ready.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-[#5c746c]">
              Keep documents, alerts, and audit readiness in one system. Know what is missing, what is urgent, and what to fix first.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href="/signup">Start free</Button>
              <Button href="/pricing" variant="secondary">
                View pricing
              </Button>
            </div>
          </div>

          <div className="app-panel overflow-hidden">
            <div className="app-sidebar p-5 text-white">
              <p className="text-sm font-bold text-emerald-100">Compliance snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs text-emerald-100">Status</p>
                  <p className="mt-1 font-bold">Attention Needed</p>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs text-emerald-100">Score</p>
                  <p className="mt-1 font-bold">78%</p>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs text-emerald-100">Open alerts</p>
                  <p className="mt-1 font-bold">3</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm font-semibold text-[#213e35]">Most urgent action</p>
              <p className="mt-1 text-sm text-[#5c746c]">Carrier licence expires within 30 days.</p>
              <Button className="mt-4 w-full">Resolve now</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-4 py-4 md:grid-cols-3">
        {[
          ["No scattered records", "Store documents and evidence in one organised workspace."],
          ["No missed deadlines", "Automated monitoring catches expiring and missing records."],
          ["No inspection panic", "Generate audit-ready packs when needed."]
        ].map(([title, copy]) => (
          <article key={title} className="app-panel p-5">
            <h3 className="font-bold text-[#1b3a31]">{title}</h3>
            <p className="mt-2 text-sm text-[#5f746d]">{copy}</p>
          </article>
        ))}
      </section>

      <section className="container-page py-14">
        <h2 className="text-2xl font-extrabold">How it works</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {["Set up your business profile", "Upload compliance documents", "Act on score and alerts"].map((step, i) => (
            <article key={step} className="app-panel p-5">
              <p className="text-sm font-bold text-[#2b6a58]">Step {i + 1}</p>
              <p className="mt-1 font-semibold text-[#1b3a31]">{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#d8e5df] bg-white">
        <div className="container-page py-14">
          <h2 className="text-2xl font-extrabold">Starter pricing</h2>
          <div className="mt-5 max-w-xl app-panel p-6">
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-[#2a6d59]">Starter</p>
            <p className="mt-2 text-4xl font-extrabold">£29<span className="text-xl font-semibold text-[#67817a]"> / month</span></p>
            <ul className="mt-4 space-y-1 text-sm text-[#5f746d]">
              <li>One business location</li>
              <li>Document uploads</li>
              <li>Compliance score and alerts</li>
              <li>AI assistant</li>
            </ul>
            <Button href="/signup" className="mt-5">
              Start Starter plan
            </Button>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <h2 className="text-2xl font-extrabold">FAQ</h2>
        <div className="mt-5 space-y-3">
          {faqs.map((item) => (
            <article key={item.q} className="app-panel p-5">
              <h3 className="font-bold">{item.q}</h3>
              <p className="mt-1 text-sm text-[#5f746d]">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="app-sidebar mt-8">
        <div className="container-page py-12 text-white">
          <h2 className="text-3xl font-extrabold">Sell peace of mind, not paperwork.</h2>
          <p className="mt-2 max-w-2xl text-emerald-100">Get a clearer compliance picture this week and stay inspection-ready all year.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/signup">Create account</Button>
            <Button href="/pricing" variant="secondary">
              View pricing
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
