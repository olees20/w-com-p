import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { completeHealthCheckAction } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { buildHealthCheckReportForBusiness } from "@/lib/health-check-report";

type HealthCheck = {
  id: string;
  status: "active" | "completed" | "expired" | "cancelled";
  locked_at: string | null;
  expires_at: string | null;
  final_report: Record<string, unknown> | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function scoreBadge(status: string) {
  if (status === "compliant") return { label: "Compliant", cls: "bg-green-50 text-[#16A34A] border-green-200" };
  if (status === "attention_needed") return { label: "Attention Needed", cls: "bg-amber-50 text-[#F59E0B] border-amber-200" };
  return { label: "At Risk", cls: "bg-red-50 text-[#DC2626] border-red-200" };
}

function healthCheckStatusLabel(params: { activeCheck: HealthCheck | null; latestLocked: HealthCheck | null }) {
  if (params.activeCheck) return "Active";
  if (params.latestLocked?.status === "completed" || params.latestLocked?.final_report) return "Completed";
  if (params.latestLocked?.status === "expired") return "Expired";
  return "Draft / Test Result";
}

function renderRiskDescription(title: string, description: string | null) {
  const t = title.toLowerCase();
  if (t.includes("carrier") && (t.includes("expired") || t.includes("expires"))) {
    return "During an inspection, you may be unable to demonstrate that your waste was handled by a currently valid registered carrier.";
  }
  if (t.includes("food waste")) {
    return "Based on your business profile, food waste evidence was expected but not found in the uploaded documents.";
  }
  return description ?? "No description provided.";
}

export default async function ResultsPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; name: string | null }>();

  if (!business) return null;

  const { data: checks } = await supabase
    .from("health_checks")
    .select("id,status,locked_at,expires_at,final_report,created_at")
    .eq("business_id", business.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const healthChecks = (checks ?? []) as HealthCheck[];
  const activeCheck = healthChecks.find((c) => c.status === "active" && !c.locked_at) ?? null;
  const latestLocked = healthChecks.find((c) => (c.status === "completed" || c.status === "expired") && c.final_report) ?? null;
  const useLockedSnapshot = !activeCheck && !!latestLocked?.final_report;

  const liveReport = await buildHealthCheckReportForBusiness({ businessId: business.id, userId: user.id });
  const report = useLockedSnapshot ? (latestLocked?.final_report as typeof liveReport) : liveReport;

  const badge = scoreBadge(report.score.status);

  return (
    <div className="space-y-5">
      <section className="app-panel p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Health Check Result</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Can I prove waste compliance from the documents provided?</p>
        <p className="mt-2 text-sm text-[#6B7280]">
          Health Check Status: {healthCheckStatusLabel({ activeCheck, latestLocked })}
        </p>
        {latestLocked?.locked_at && !activeCheck ? <p className="text-xs text-[#6B7280]">Report locked on {formatDate(latestLocked.locked_at)}</p> : null}
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Executive Summary</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4 text-sm">
          <p><span className="font-semibold">Business:</span> {report.business.name ?? "Unknown"}</p>
          <p><span className="font-semibold">Date generated:</span> {formatDate(report.generated_at)}</p>
          <p><span className="font-semibold">Documents reviewed:</span> {report.documents.length}</p>
          <p><span className="font-semibold">Sites:</span> {report.business.sites_count ?? "Not provided"}</p>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#111827]">Overall assessment: {report.overall_assessment}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#E5E7EB] p-3">
            <p className="text-xs uppercase text-[#6B7280]">Compliance score</p>
            <p className="text-3xl font-extrabold text-[#111827]">{report.score.score}<span className="block text-xs font-semibold text-[#6B7280]">/100</span></p>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] p-3">
            <p className="text-xs uppercase text-[#6B7280]">Status</p>
            <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-bold ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] p-3">
            <p className="text-xs uppercase text-[#6B7280]">Confidence</p>
            <p className="text-lg font-bold text-[#111827]">{report.confidence}</p>
          </div>
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Plain-English Verdict</h2>
        <p className="mt-2 text-sm text-[#374151]">{report.plain_english_verdict}</p>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Why this status?</h2>
        <div className="mt-3 space-y-1">
          {report.status_reasons.map((item) => (
            <p key={item} className="text-sm text-[#374151]">- {item}</p>
          ))}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Confidence Contributors</h2>
        <div className="mt-3 space-y-2">
          {report.confidence_contributors.map((item) => (
            <p key={item} className="text-sm text-[#374151]">- {item}</p>
          ))}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Score Breakdown</h2>
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-semibold text-[#111827]">Starting score: {report.score.breakdown.starting_score}</p>
          {report.score.breakdown.deductions.length ? report.score.breakdown.deductions.map((d) => (
            <p key={`${d.reason}-${d.points}`} className="text-[#374151]">- {d.reason}: -{d.points}</p>
          )) : <p className="text-[#6B7280]">No deductions applied.</p>}
          <p className="font-semibold text-[#111827]">Final score: {report.score.breakdown.final_score}</p>
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Baseline Evidence Checks</h2>
        <div className="mt-3 space-y-3">
          {report.compliance_checks.map((check) => (
            <article key={check.check_name} className="rounded-lg border border-[#E5E7EB] p-3 text-sm">
              <p className="font-semibold text-[#111827]">{check.check_name}</p>
              <p className="text-xs text-[#6B7280]">Result: <span className="font-semibold">{check.result}</span></p>
              <p className="text-[#6B7280]">Evidence: {check.evidence_used.length ? check.evidence_used.join(", ") : "No evidence found"}</p>
              <p className="text-[#6B7280]">Affected document: {check.affected_document ?? "Not specific"}</p>
              <p className="text-[#6B7280]">Recommended action: {check.recommended_action}</p>
              <p className="text-xs text-[#6B7280]">Source: {check.source_reference}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Key Risks</h2>
        <div className="mt-3 space-y-3">
          {report.top_risks.length ? report.top_risks.map((risk) => (
            <article key={risk.id} className="rounded-lg border border-[#E5E7EB] p-3 text-sm">
              <p className="font-semibold text-[#111827]">{risk.title}</p>
              <p className="text-[#6B7280]">{renderRiskDescription(risk.title, risk.description)}</p>
              <p className="text-xs text-[#6B7280]"><span className="font-semibold">Severity:</span> {(risk.severity ?? "medium").toUpperCase()}</p>
            </article>
          )) : <p className="text-sm text-[#6B7280]">No open risks found.</p>}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Cross-Document Consistency</h2>
        <div className="mt-3 space-y-3">
          {report.consistency_findings.length ? report.consistency_findings.map((finding) => (
            <article key={finding.key} className="rounded-lg border border-[#E5E7EB] p-3 text-sm">
              <p className="font-semibold text-[#111827]">{finding.title}</p>
              <p className="text-[#6B7280]">{finding.message}</p>
              <p className="text-xs text-[#6B7280]"><span className="font-semibold">Severity:</span> {finding.severity.toUpperCase()}</p>
              <p className="text-xs text-[#6B7280]"><span className="font-semibold">Status:</span> {finding.status}</p>
              <p className="text-xs text-[#6B7280]"><span className="font-semibold">Evidence:</span> {finding.evidence.length ? finding.evidence.join(" | ") : "No evidence captured"}</p>
              <p className="text-xs text-[#6B7280]"><span className="font-semibold">Action:</span> {finding.recommended_action}</p>
            </article>
          )) : <p className="text-sm text-[#6B7280]">No cross-document inconsistencies detected.</p>}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Consistency Summary</h2>
        <div className="mt-3 space-y-2 text-sm text-[#374151]">
          <p><span className="font-semibold">Carriers detected:</span> {report.consistency_summary.carriers_detected.length ? report.consistency_summary.carriers_detected.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Licence numbers detected:</span> {report.consistency_summary.licence_numbers_detected.length ? report.consistency_summary.licence_numbers_detected.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Sites/addresses detected:</span> {report.consistency_summary.sites_or_addresses_detected.length ? report.consistency_summary.sites_or_addresses_detected.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Document date range:</span> {report.consistency_summary.document_date_range.from ?? "N/A"} to {report.consistency_summary.document_date_range.to ?? "N/A"}</p>
          <p><span className="font-semibold">Duplicate documents detected:</span> {report.consistency_summary.duplicate_documents_detected}</p>
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Business/Entity Matching</h2>
        <div className="mt-3 space-y-2 text-sm text-[#374151]">
          <p><span className="font-semibold">Onboarded business:</span> {report.entity_matching.onboarded_business_name ?? "Not provided"}</p>
          <p><span className="font-semibold">Detected customer/producer names:</span> {report.entity_matching.detected_customer_or_producer_names.length ? report.entity_matching.detected_customer_or_producer_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Detected carrier/supplier names:</span> {report.entity_matching.detected_carrier_or_supplier_names.length ? report.entity_matching.detected_carrier_or_supplier_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Detected destination/facility names:</span> {report.entity_matching.detected_destination_or_facility_names.length ? report.entity_matching.detected_destination_or_facility_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Unclear entities:</span> {report.entity_matching.unclear_entity_names.length ? report.entity_matching.unclear_entity_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Unmatched business names:</span> {report.entity_matching.unmatched_business_names.length ? report.entity_matching.unmatched_business_names.join(", ") : "None"}</p>
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Recommended Next Actions</h2>
        <div className="mt-3 space-y-2">
          {report.recommended_actions.length ? report.recommended_actions.map((action) => <p key={action} className="text-sm text-[#374151]">- {action}</p>) : <p className="text-sm text-[#6B7280]">No immediate action required.</p>}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Informational Findings</h2>
        <div className="mt-3 space-y-2">
          {report.informational_findings.length ? report.informational_findings.map((finding) => (
            <p key={finding.key} className="text-sm text-[#374151]">- {finding.title}: {finding.message}</p>
          )) : <p className="text-sm text-[#6B7280]">No informational findings.</p>}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Missing Documents</h2>
        <div className="mt-3 space-y-2">
          {report.missing_documents.length ? report.missing_documents.map((m) => <p key={m} className="text-sm text-[#374151]">- {m}</p>) : <p className="text-sm text-[#6B7280]">No major missing categories detected.</p>}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Documents Not Used In The Assessment</h2>
        <div className="mt-3 space-y-2">
          {report.documents_not_used.length ? report.documents_not_used.map((d) => (
            <p key={`${d.file_name}-${d.reason}`} className="text-sm text-[#374151]">- {d.file_name}: {d.reason}</p>
          )) : <p className="text-sm text-[#6B7280]">All uploaded documents were used in the compliance assessment.</p>}
        </div>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Areas We Could Not Verify</h2>
        <div className="mt-3 space-y-2">
          {report.cannot_verify.length ? report.cannot_verify.map((c) => <p key={c} className="text-sm text-[#374151]">- {c}</p>) : <p className="text-sm text-[#6B7280]">No major unverifiable areas detected.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This report is based only on the documents provided. It is compliance support, not legal advice, and does not guarantee regulatory compliance.
      </section>

      <section className="flex flex-wrap gap-3">
        {activeCheck ? (
          <>
            <Link href="/dashboard/upload" className="inline-flex rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-bold text-white">Continue Uploading</Link>
            <form action={completeHealthCheckAction}>
              <SubmitButton loadingText="Locking report...">Generate Final Report</SubmitButton>
            </form>
          </>
        ) : (
          <form action="/api/stripe/checkout" method="POST">
            <button type="submit" className="inline-flex rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-bold text-white">Start new Health Check — £99</button>
          </form>
        )}
        <Link href="/dashboard/audit-pack" className="inline-flex rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold text-[#111827]">Open audit pack</Link>
      </section>
    </div>
  );
}
