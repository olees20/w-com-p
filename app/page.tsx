import Link from "next/link";
import Image from "next/image";

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-[#111827]">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-[#6B7280]">{subtitle}</p> : null}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#F9FAFB] text-[#111827]">
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/logo-sml.png" alt="Waste Compliance Platform" width={24} height={24} priority />
            <span className="text-sm font-semibold">Waste Compliance Platform</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-[#6B7280]">
              Log in
            </Link>
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a3279]"
              >
                Start Health Check — £99
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="container-page py-16">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#1E3A8A]">Waste Compliance Health Check</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">Check your waste compliance before an inspection</h1>
        <p className="mt-4 max-w-3xl text-lg text-[#6B7280]">
          Upload your waste transfer notes, invoices, carrier documents and contracts. We analyse them against official UK guidance and give you a clear compliance score, risk summary and audit pack.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <form action="/api/stripe/checkout" method="POST">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-[#1E3A8A] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1a3279]"
            >
              Start Health Check — £99
            </button>
          </form>
          <p className="text-sm text-[#6B7280]">No subscription. One-off check. Built for busy business owners and operators.</p>
        </div>
      </section>

      <section className="container-page pb-10">
        <SectionTitle
          title="Most businesses only discover waste compliance gaps when they are asked to prove them"
          subtitle="Common issues we see in document reviews"
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Missing waste transfer notes",
            "Expired or unclear carrier details",
            "Inconsistent documents across sites",
            "Unclear food waste or hazardous waste handling",
            "No audit-ready folder"
          ].map((item) => (
            <article key={item} className="app-panel p-4 text-sm text-[#374151]">
              {item}
            </article>
          ))}
        </div>
      </section>

      <section className="container-page py-10">
        <SectionTitle title="What you get" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[
            "Compliance score out of 100",
            "Status: Compliant / Attention Needed / At Risk",
            "Top risks found",
            "Missing documents list",
            "Recommended next actions",
            "Audit-ready report",
            "Source-grounded references where available"
          ].map((item) => (
            <article key={item} className="app-panel p-4 text-sm font-medium text-[#111827]">
              {item}
            </article>
          ))}
        </div>
      </section>

      <section className="container-page py-10">
        <SectionTitle title="How it works" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["1", "Pay £99"],
            ["2", "Upload your waste documents"],
            ["3", "Receive your health check result and audit pack"]
          ].map(([step, label]) => (
            <article key={step} className="app-panel p-5">
              <p className="text-sm font-bold text-[#1E3A8A]">Step {step}</p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">{label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#E5E7EB] bg-white">
        <div className="container-page py-14">
          <SectionTitle title="Pricing" />
          <div className="mt-5 max-w-xl app-panel p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1E3A8A]">Waste Compliance Health Check</p>
            <p className="mt-2 text-4xl font-extrabold text-[#111827]">£99 <span className="text-xl font-semibold text-[#6B7280]">one-off</span></p>
            <ul className="mt-4 space-y-1 text-sm text-[#374151]">
              <li>Document upload</li>
              <li>AI-assisted document review</li>
              <li>Compliance score</li>
              <li>Risk summary</li>
              <li>Missing document flags</li>
              <li>Audit pack/report</li>
            </ul>
            <form action="/api/stripe/checkout" method="POST" className="mt-5">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a3279]"
              >
                Start Health Check
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="container-page py-10">
        <SectionTitle title="Built for trust" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Uses official UK regulatory sources where available",
            "Private document storage",
            "Clear 'cannot verify' fallbacks instead of guessing",
            "Designed for UK waste compliance support"
          ].map((item) => (
            <article key={item} className="app-panel p-4 text-sm text-[#374151]">
              {item}
            </article>
          ))}
        </div>
      </section>

      <section className="container-page pb-12">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This service provides compliance support based on the documents you provide. It is not legal advice and does not guarantee regulatory compliance.
        </div>
      </section>
    </main>
  );
}
