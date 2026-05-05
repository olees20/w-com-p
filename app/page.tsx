import Link from "next/link";
import Image from "next/image";

const tileCards = [
  {
    title: "Missing waste transfer notes",
    subtitle: "Required evidence not present for specific transfers."
  },
  {
    title: "Licence validity and mismatch",
    subtitle: "Expired at transfer date or does not match WTN."
  },
  {
    title: "Unreadable uploads",
    subtitle: "Relevant evidence detected but too poor to verify."
  },
  {
    title: "Entity and site mismatch",
    subtitle: "Documents may belong to different businesses."
  },
  {
    title: "Duplicate evidence",
    subtitle: "Duplicate files are flagged and not double counted."
  },
  {
    title: "Date consistency",
    subtitle: "Future-dated or stale records are highlighted."
  }
];

const checkCards = [
  {
    title: "WTN or equivalent invoice evidence",
    subtitle: "Each transfer needs usable core records."
  },
  {
    title: "Carrier registration evidence",
    subtitle: "Carrier details, licence and expiry validation."
  },
  {
    title: "Licence valid at transfer date",
    subtitle: "Not just valid today - valid when transfer occurred."
  },
  {
    title: "Entity and site matching",
    subtitle: "Producer, customer, supplier and site consistency."
  },
  {
    title: "Food waste and recycling checks",
    subtitle: "Coverage checks based on your business profile."
  },
  {
    title: "Unreadable and irrelevant file handling",
    subtitle: "Poor scans and non-evidence files handled cleanly."
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#edf3fb] text-[#0b1f3a]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#c7d9f0] bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/logo-sml.png" alt="Waste Compliance Platform" width={24} height={24} priority />
            <span className="text-sm font-semibold text-[#11315e]">Waste Compliance Platform</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#home" className="border-b-2 border-[#1d5fb7] pb-1 text-sm font-semibold text-[#11315e]">Home</a>
            <a href="#checks" className="text-sm font-semibold text-[#35557f] hover:text-[#11315e]">What we check</a>
            <a href="#pricing" className="text-sm font-semibold text-[#35557f] hover:text-[#11315e]">Pricing</a>
            <a href="#trust" className="text-sm font-semibold text-[#35557f] hover:text-[#11315e]">Trust</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-[#35557f] hover:text-[#11315e]">
              Log in
            </Link>
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-[#1d5fb7] px-4 py-2 text-sm font-bold text-white hover:bg-[#174b91]"
              >
                Start Health Check - £99
              </button>
            </form>
          </div>
        </div>
      </header>

      <section
        id="home"
        className="relative min-h-[82vh] pt-20"
        style={{
          backgroundImage:
            "linear-gradient(105deg, rgba(5,27,56,0.84) 0%, rgba(17,60,115,0.76) 48%, rgba(17,60,115,0.45) 100%), url('https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=2200&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <div className="container-page py-16">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/90">AI Waste Compliance For UK Businesses</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
            Prove your waste compliance before an inspector asks
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-white/90">
            Upload your waste transfer notes, invoices, carrier documents and contracts. We check whether they can demonstrate compliance, flag gaps, and generate a clear health check report.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <form action="/api/stripe/checkout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[#1d5fb7] px-6 py-3 text-sm font-bold text-white hover:bg-[#174b91]"
              >
                Start Health Check - £99
              </button>
            </form>
            <Link href="/pricing" className="inline-flex items-center justify-center rounded-full border border-white/70 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">
              View pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/90">
            One-off check. No subscription. Built for busy UK business owners and operators.
          </p>
        </div>

        <div className="container-page pb-8">
          <div className="grid gap-3 rounded-xl bg-white/90 p-3 backdrop-blur md:grid-cols-4">
            {[
              "Compliance score out of 100",
              "Key risks and missing evidence",
              "Unreadable and duplicate file flags",
              "Audit-ready report output"
            ].map((item) => (
              <div key={item} className="rounded-md border border-[#c7d9f0] bg-white px-4 py-3 text-sm font-semibold text-[#11315e]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-8">
        <h2 className="text-2xl font-extrabold text-[#0b1f3a]">Most businesses only discover waste compliance gaps when asked to prove them</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tileCards.map((card) => (
            <article key={card.title} className="rounded-lg border border-[#c7d9f0] bg-white p-4">
              <p className="text-base font-bold text-[#11315e]">{card.title}</p>
              <p className="mt-1 text-sm text-[#35557f]">{card.subtitle}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="checks" className="container-page py-8">
        <div className="flex items-end justify-between">
          <h3 className="text-3xl font-extrabold tracking-tight text-[#0b1f3a]">
            We check whether your documents prove compliance, not just whether they exist
          </h3>
        </div>
        <p className="mt-2 text-sm text-[#35557f]">
          Includes WTN or equivalent invoice evidence, carrier validity checks, entity matching, date consistency, and document usability.
        </p>
        <div className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {checkCards.map((card, index) => (
            <article
              key={card.title}
              className="min-w-[300px] max-w-[340px] snap-start overflow-hidden rounded-xl border border-[#c7d9f0] bg-white"
            >
              <div
                className="h-40 w-full"
                style={{
                  backgroundImage:
                    index % 3 === 0
                      ? "linear-gradient(140deg, rgba(11,58,116,0.85), rgba(29,95,183,0.45)), url('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80')"
                      : index % 3 === 1
                        ? "linear-gradient(140deg, rgba(11,58,116,0.85), rgba(29,95,183,0.45)), url('https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1200&q=80')"
                        : "linear-gradient(140deg, rgba(11,58,116,0.85), rgba(29,95,183,0.45)), url('https://images.unsplash.com/photo-1556155092-490a1ba16284?auto=format&fit=crop&w=1200&q=80')",
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              />
              <div className="p-4">
                <p className="text-base font-bold text-[#0b1f3a]">{card.title}</p>
                <p className="mt-1 text-sm text-[#35557f]">{card.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page py-4">
        <div className="grid gap-4 md:grid-cols-2">
          <article
            className="min-h-[240px] rounded-xl border border-[#c7d9f0] p-6 text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgba(8,38,76,0.86), rgba(29,95,183,0.48)), url('https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/90">Use Cases</p>
            <h4 className="mt-2 text-3xl font-extrabold">Single-site and multi-site audit readiness</h4>
          </article>
          <article
            className="min-h-[240px] rounded-xl border border-[#c7d9f0] p-6 text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgba(8,38,76,0.86), rgba(29,95,183,0.48)), url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/90">Outcome</p>
            <h4 className="mt-2 text-3xl font-extrabold">Know what is missing before inspection</h4>
          </article>
        </div>
      </section>

      <section className="mt-8 bg-[#0f417e] py-14 text-white">
        <div className="container-page text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/90">Get inspection-ready</p>
          <h4 className="mt-3 text-4xl font-extrabold tracking-tight">Search your evidence pack faster with source-backed outputs</h4>
          <form action="/api/stripe/checkout" method="POST" className="mt-7">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-bold text-[#0f417e] hover:bg-[#e8f1fb]"
            >
              Start Health Check - £99
            </button>
          </form>
        </div>
      </section>

      <section id="pricing" className="container-page py-12">
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-[#c7d9f0] bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#1d5fb7]">One-off pricing</p>
            <p className="mt-2 text-4xl font-extrabold text-[#0b1f3a]">
              £99 <span className="text-xl font-semibold text-[#5b7498]">per health check</span>
            </p>
            <p className="mt-2 text-sm text-[#35557f]">Built for businesses that need to be inspection-ready, not guess compliant.</p>
            <ul className="mt-4 space-y-1 text-sm text-[#11315e]">
              <li>Secure document upload</li>
              <li>AI-assisted evidence extraction</li>
              <li>Waste compliance health score</li>
              <li>Risk and missing-evidence summary</li>
              <li>Unreadable and irrelevant document flags</li>
              <li>Audit-ready health check report</li>
            </ul>
            <form action="/api/stripe/checkout" method="POST" className="mt-5">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-[#1d5fb7] px-4 py-2 text-sm font-bold text-white hover:bg-[#174b91]"
              >
                Start Health Check
              </button>
            </form>
          </article>
          <article id="trust" className="rounded-lg border border-[#c7d9f0] bg-white p-6">
            <h4 className="text-2xl font-extrabold text-[#0b1f3a]">Built for trust</h4>
            <ul className="mt-4 space-y-2 text-sm text-[#11315e]">
              <li>Uses official UK regulatory sources where available</li>
              <li>We tell you when compliance cannot be proven</li>
              <li>Private document handling</li>
              <li>Designed for UK business waste compliance support</li>
            </ul>
            <p className="mt-6 rounded-md border border-[#c9d8ea] bg-[#f4f8fd] p-3 text-xs text-[#35557f]">
              This service provides compliance support based only on the documents you upload. It is not legal advice and does not guarantee regulatory compliance.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t border-[#c7d9f0] bg-white py-10">
        <div className="container-page grid gap-6 md:grid-cols-4">
          <div>
            <div className="inline-flex items-center gap-2">
              <Image src="/logo-sml.png" alt="Waste Compliance Platform" width={24} height={24} />
              <span className="text-sm font-semibold text-[#11315e]">Waste Compliance Platform</span>
            </div>
            <p className="mt-3 text-sm text-[#35557f]">Compliance support for UK business waste evidence checks.</p>
          </div>
          <div>
            <p className="text-sm font-bold text-[#0b1f3a]">Pages</p>
            <ul className="mt-2 space-y-1 text-sm text-[#35557f]">
              <li><a href="#home" className="hover:text-[#11315e]">Home</a></li>
              <li><a href="#checks" className="hover:text-[#11315e]">What we check</a></li>
              <li><a href="#pricing" className="hover:text-[#11315e]">Pricing</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-[#0b1f3a]">Account</p>
            <ul className="mt-2 space-y-1 text-sm text-[#35557f]">
              <li><Link href="/login" className="hover:text-[#11315e]">Log in</Link></li>
              <li><Link href="/signup" className="hover:text-[#11315e]">Create account</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-[#0b1f3a]">Compliance note</p>
            <p className="mt-2 text-sm text-[#35557f]">
              This service provides compliance support based on uploaded evidence. It is not legal advice and does not guarantee regulatory compliance.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
