import { createServerClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/audit-pack/print-button";
import { buildHealthCheckReportForBusiness } from "@/lib/health-check-report";

type HealthCheck = {
  id: string;
  status: "active" | "completed" | "expired" | "cancelled";
  locked_at: string | null;
  final_report: Record<string, unknown> | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
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
  return description ?? "No description";
}

export default async function AuditPackPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!business) return null;

  const { data: checks } = await supabase
    .from("health_checks")
    .select("id,status,locked_at,final_report,created_at")
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

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-start justify-between gap-4 print:block">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Waste Compliance Health Check Report</h1>
          <p className="mt-1 text-sm text-slate-600">Generated {formatDate(report.generated_at)}</p>
          <p className="text-xs text-slate-600">Health Check Status: {healthCheckStatusLabel({ activeCheck, latestLocked })}</p>
          {latestLocked?.locked_at && !activeCheck ? <p className="text-xs text-slate-600">Report locked on {formatDate(latestLocked.locked_at)}</p> : null}
        </div>
        <PrintButton />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Executive Summary</h2>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <p><span className="font-semibold">Business:</span> {report.business.name ?? "Unknown"}</p>
          <p><span className="font-semibold">Business type:</span> {report.business.business_type ?? "Unknown"}</p>
          <p><span className="font-semibold">Documents reviewed:</span> {report.documents.length}</p>
          <p><span className="font-semibold">Sites:</span> {report.business.sites_count ?? "Not provided"}</p>
          <p><span className="font-semibold">Compliance score:</span> {report.score.score}/100</p>
          <p><span className="font-semibold">Status:</span> {report.score.status}</p>
          <p><span className="font-semibold">Confidence:</span> {report.confidence}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Plain-English Verdict</h2>
        <p className="mt-2 text-sm text-slate-700">{report.plain_english_verdict}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Confidence Contributors</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.confidence_contributors.map((item) => <p key={item}>- {item}</p>)}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Score Breakdown</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Starting score: {report.score.breakdown.starting_score}</p>
          {report.score.breakdown.deductions.length ? report.score.breakdown.deductions.map((d) => (
            <p key={`${d.reason}-${d.points}`}>- {d.reason}: -{d.points}</p>
          )) : <p>No deductions applied.</p>}
          <p className="font-semibold text-slate-900">Final score: {report.score.breakdown.final_score}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Compliance Checks</h2>
        <div className="mt-3 space-y-3 text-sm">
          {report.compliance_checks.map((check) => (
            <article key={check.check_name} className="rounded-md border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">{check.check_name}</p>
              <p className="text-slate-700">Result: <span className="font-semibold">{check.result}</span></p>
              <p className="text-slate-700">Evidence used: {check.evidence_used.length ? check.evidence_used.join(", ") : "No evidence found"}</p>
              <p className="text-slate-700">Affected document: {check.affected_document ?? "Not specific"}</p>
              <p className="text-slate-700">Recommended action: {check.recommended_action}</p>
              <p className="text-xs text-slate-600">Source: {check.source_reference}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Key Risks</h2>
        <div className="mt-3 space-y-3 text-sm">
          {report.top_risks.length ? report.top_risks.map((risk, idx) => (
            <article key={risk.id ?? `risk-${idx}`} className="rounded-md border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">{risk.title}</p>
              <p className="text-slate-700">{renderRiskDescription(risk.title, risk.description)}</p>
              <p className="text-xs text-slate-600">Severity: {(risk.severity ?? "medium").toUpperCase()}</p>
            </article>
          )) : <p className="text-slate-600">No open risks found.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Cross-Document Consistency</h2>
        <div className="mt-3 space-y-3 text-sm">
          {report.consistency_findings.length ? report.consistency_findings.map((finding) => (
            <article key={finding.key} className="rounded-md border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">{finding.title}</p>
              <p className="text-slate-700">{finding.message}</p>
              <p className="text-xs text-slate-600">Severity: {finding.severity.toUpperCase()} | Status: {finding.status}</p>
              <p className="text-xs text-slate-600">Evidence: {finding.evidence.length ? finding.evidence.join(" | ") : "No evidence captured"}</p>
              <p className="text-xs text-slate-600">Recommended action: {finding.recommended_action}</p>
            </article>
          )) : <p className="text-slate-600">No cross-document inconsistencies detected.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Consistency Summary</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p><span className="font-semibold">Carriers detected:</span> {report.consistency_summary.carriers_detected.length ? report.consistency_summary.carriers_detected.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Licence numbers detected:</span> {report.consistency_summary.licence_numbers_detected.length ? report.consistency_summary.licence_numbers_detected.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Sites/addresses detected:</span> {report.consistency_summary.sites_or_addresses_detected.length ? report.consistency_summary.sites_or_addresses_detected.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Document date range:</span> {report.consistency_summary.document_date_range.from ?? "N/A"} to {report.consistency_summary.document_date_range.to ?? "N/A"}</p>
          <p><span className="font-semibold">Duplicate documents detected:</span> {report.consistency_summary.duplicate_documents_detected}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Recommended Next Actions</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.recommended_actions.length ? report.recommended_actions.map((action) => <p key={action}>- {action}</p>) : <p>No immediate action required.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Missing Documents</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.missing_documents.length ? report.missing_documents.map((item) => <p key={item}>- {item}</p>) : <p>No major missing categories detected.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Documents Not Used In The Assessment</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.documents_not_used.length ? report.documents_not_used.map((d) => <p key={`${d.file_name}-${d.reason}`}>- {d.file_name}: {d.reason}</p>) : <p>All uploaded documents were used in the compliance assessment.</p>}
          <p className="text-xs text-slate-600">No action required unless these files were intended to evidence waste compliance.</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Document Inventory</h2>
        <div className="mt-3 space-y-3 text-sm">
          {report.documents.length ? report.documents.map((doc) => (
            <article key={doc.id} className="rounded-md border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">{doc.file_name}</p>
              <p className="text-slate-700">Type: {doc.document_type ?? "unknown"} | Status: {doc.processing_status ?? "uploaded"}</p>
              <p className="text-slate-700">Extracted date: {formatDate(doc.extracted_date)} | Expiry: {formatDate(doc.expiry_date)}</p>
              <p className="text-slate-700">Supplier: {doc.extracted_supplier ?? "Not extracted"} | Waste type: {doc.waste_type ?? "Not extracted"}</p>
              <p className="text-slate-700">Validation warnings: {doc.ai_extracted_json?.missing_fields?.length ? doc.ai_extracted_json.missing_fields.join(", ") : doc.processing_status === "failed" ? doc.processing_error ?? "Failed" : "None"}</p>
            </article>
          )) : <p className="text-slate-600">No documents uploaded.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Source-Grounded References</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.references.length ? report.references.map((r, idx) => <p key={r.id ?? `ref-${idx}`}>{r.title}: {r.source_url ?? "No source reference available for this specific check."}</p>) : <p>No source reference available for this specific check.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-red-900">Areas We Could Not Verify</h2>
        <div className="mt-2 space-y-1 text-sm text-red-800">
          {report.cannot_verify.length ? report.cannot_verify.map((item) => <p key={item}>- {item}</p>) : <p>No major unverifiable areas were detected in this run.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 print:bg-white print:border-slate-300">
        <p className="text-sm text-amber-900 print:text-slate-700">
          This report is based only on the documents provided. It is compliance support, not legal advice, and does not guarantee regulatory compliance.
        </p>
      </section>
    </div>
  );
}
