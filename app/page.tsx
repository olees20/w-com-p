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
    <main className="min-h-screen bg-[#f3f2f1] text-[#0b0c0c]">
      <header className="border-b-4 border-[#1d70b8] bg-[#0b0c0c]">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/logo-sml.png" alt="Waste Compliance Platform" width={24} height={24} priority />
            <span className="text-sm font-semibold text-white">Waste Compliance Platform</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-white/90 hover:text-white">
              Log in
            </Link>
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-[#1d70b8] px-4 py-2 text-sm font-bold text-white hover:bg-[#175a94]"
              >
                Start Health Check - £99
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="bg-[#1d70b8]">
        <div className="container-page py-14">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-white/90">Waste Compliance Health Check</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Prove your waste compliance - before an inspector asks</h1>
          <p className="mt-4 max-w-3xl text-lg text-white/95">
          Upload your waste transfer notes, invoices, carrier documents and contracts. We check whether they can demonstrate compliance, flag gaps, and generate a clear health check report.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-bold text-[#0b0c0c] hover:bg-[#f3f2f1]"
              >
                Start Health Check - £99
              </button>
            </form>
            <p className="text-sm text-white/95">One-off check. No subscription. Built for busy UK business owners and operators.</p>
          </div>
        </div>
      </section>

      <section className="container-page py-10">
        <SectionTitle
          title="Most businesses only discover waste compliance gaps when they are asked to prove them"
          subtitle="Common inspection-readiness issues we find"
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Missing waste transfer notes",
            "Carrier licence missing, expired, or not valid at transfer date",
            "Documents issued to the wrong business entity",
            "Waste evidence uploaded but unreadable",
            "Food waste or recycling evidence unclear",
            "Multi-site records that do not line up",
            "Future-dated or inconsistent document dates",
            "Duplicate documents that do not add evidence"
          ].map((item) => (
            <article key={item} className="rounded-md border border-[#b1b4b6] bg-white p-4 text-sm text-[#0b0c0c]">
              {item}
            </article>
          ))}
        </div>
      </section>

      <section className="container-page py-10">
        <SectionTitle title="What we actually check" subtitle="We check whether your documents prove compliance - not just whether they exist" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Waste transfer notes or equivalent invoice evidence",
            "Carrier registration evidence and licence validity",
            "Licence numbers matching waste transfer records",
            "Waste dates, destinations, EWC codes and transfer details",
            "Food waste and recycling evidence where relevant",
            "Business/entity names matching the onboarded business",
            "Multi-site consistency across WTNs, invoices and suppliers",
            "Unreadable, duplicate, irrelevant or unsupported files"
          ].map((item) => (
            <article key={item} className="rounded-md border border-[#b1b4b6] bg-white p-4 text-sm text-[#0b0c0c]">
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
            "Clear status: Compliant, Review Recommended, Attention Needed or At Risk",
            "Plain-English verdict",
            "Key risks and why they matter",
            "Missing and unverifiable documents list",
            "Recommended next actions",
            "Source-grounded references where available",
            "Audit-ready health check report"
          ].map((item) => (
            <article key={item} className="rounded-md border border-[#b1b4b6] bg-white p-4 text-sm font-medium text-[#0b0c0c]">
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
            ["3", "Receive your compliance health check and audit-ready report"]
          ].map(([step, label]) => (
            <article key={step} className="rounded-md border border-[#b1b4b6] bg-white p-5">
              <p className="text-sm font-bold text-[#1d70b8]">Step {step}</p>
              <p className="mt-1 text-sm font-semibold text-[#0b0c0c]">{label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#b1b4b6] bg-white">
        <div className="container-page py-14">
          <SectionTitle title="Pricing" />
          <div className="mt-5 max-w-xl rounded-md border border-[#b1b4b6] p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1d70b8]">Waste Compliance Health Check</p>
            <p className="mt-2 text-4xl font-extrabold text-[#0b0c0c]">£99 <span className="text-xl font-semibold text-[#505a5f]">one-off</span></p>
            <p className="mt-2 text-sm text-[#505a5f]">Built for businesses that need to be inspection-ready, not guess compliant.</p>
            <ul className="mt-4 space-y-1 text-sm text-[#0b0c0c]">
              <li>Secure document upload</li>
              <li>AI-assisted evidence extraction</li>
              <li>Waste compliance health score</li>
              <li>Risk and missing-evidence summary</li>
              <li>Unreadable and irrelevant document flags</li>
              <li>Audit-ready report</li>
            </ul>
            <form action="/api/stripe/checkout" method="POST" className="mt-5">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-[#1d70b8] px-4 py-2 text-sm font-bold text-white hover:bg-[#175a94]"
              >
                Start Health Check
              </button>
            </form>
            <p className="mt-3 text-xs text-[#505a5f]">Businesses must keep a waste transfer note, or equivalent information such as an invoice, for each non-hazardous waste transfer and check carriers are registered.</p>
          </div>
          <div className="mt-5">
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-[#1d70b8] px-4 py-2 text-sm font-bold text-white hover:bg-[#175a94]"
              >
                Start Health Check - £99
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
            "We tell you when compliance cannot be proven",
            "Private document handling",
            "Designed for UK waste compliance support"
          ].map((item) => (
            <article key={item} className="rounded-md border border-[#b1b4b6] bg-white p-4 text-sm text-[#0b0c0c]">
              {item}
            </article>
          ))}
        </div>
      </section>

      <section className="container-page pb-12">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This service provides compliance support based only on the documents you upload. It is not legal advice and does not guarantee regulatory compliance.
        </div>
      </section>
    </main>
  );
}
