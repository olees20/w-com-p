import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

function StepCard({
  step,
  title,
  description,
  href,
  done
}: {
  step: number;
  title: string;
  description: string;
  href: string;
  done: boolean;
}) {
  return (
    <Link href={href} className="app-panel block p-5 transition hover:border-[#3B82F6]">
      <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Step {step}</p>
      <h3 className="mt-1 text-lg font-bold text-[#111827]">{title}</h3>
      <p className="mt-2 text-sm text-[#6B7280]">{description}</p>
      <p className={`mt-3 text-sm font-semibold ${done ? "text-[#16A34A]" : "text-[#F59E0B]"}`}>{done ? "Complete" : "Pending"}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,business_type,sites_count")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; name: string | null; business_type: string | null; sites_count: number | null }>();

  if (!business) return null;

  const { data: docs } = await supabase
    .from("documents")
    .select("id,processing_status")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const { data: alerts } = await supabase.from("alerts").select("id,status").eq("business_id", business.id).eq("status", "open");

  const totalDocs = docs?.length ?? 0;
  const processedDocs = (docs ?? []).filter((d) => d.processing_status === "processed" || d.processing_status === "review").length;
  const hasBusinessDetails = Boolean(business.name && business.business_type && business.sites_count);
  const resultsReady = processedDocs > 0;

  return (
    <div className="space-y-5">
      <section className="app-panel p-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">Waste Compliance Health Check</h1>
        <p className="mt-2 text-[#6B7280]">
          Upload your waste documents, let us analyse them, and get a clear compliance score, risk summary, and audit-ready report.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="app-panel p-4">
          <p className="text-xs uppercase text-[#6B7280]">Business details</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{hasBusinessDetails ? "Ready" : "Incomplete"}</p>
        </div>
        <div className="app-panel p-4">
          <p className="text-xs uppercase text-[#6B7280]">Documents uploaded</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{totalDocs}</p>
        </div>
        <div className="app-panel p-4">
          <p className="text-xs uppercase text-[#6B7280]">Processed documents</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{processedDocs}</p>
        </div>
        <div className="app-panel p-4">
          <p className="text-xs uppercase text-[#6B7280]">Open risks</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{alerts?.length ?? 0}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <StepCard
          step={1}
          title="Business details"
          description="Confirm your business profile so we apply the right waste compliance checks."
          href="/onboarding"
          done={hasBusinessDetails}
        />
        <StepCard
          step={2}
          title="Upload waste documents"
          description="Upload transfer notes, invoices, carrier documents, contracts, and hazardous notes if relevant."
          href="/dashboard/upload"
          done={totalDocs > 0}
        />
        <StepCard
          step={3}
          title="Processing status"
          description="Track extraction status and rescan failed or low-confidence documents."
          href="/dashboard/documents"
          done={processedDocs > 0}
        />
        <StepCard
          step={4}
          title="Results & audit pack"
          description="Get your compliance score, top risks, actions, and printable audit pack."
          href="/dashboard/results"
          done={resultsReady}
        />
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Pricing</h2>
        <p className="mt-2 text-sm text-[#6B7280]">Waste Compliance Health Check: one-off audit from £99 to £149 depending on complexity.</p>
        <p className="mt-2 text-xs text-[#6B7280]">Ongoing monitoring plans are coming soon.</p>
      </section>
    </div>
  );
}
