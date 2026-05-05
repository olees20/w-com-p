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

function overrideIrrelevantContributorLine(lines: string[], irrelevant: number, total: number) {
  const replacement = `Irrelevant/unknown docs: ${irrelevant}/${total}`;
  let replaced = false;
  const next = lines.map((line) => {
    if (line.startsWith("Irrelevant/unknown docs:")) {
      replaced = true;
      return replacement;
    }
    return line;
  });
  return replaced ? next : [...next, replacement];
}

function overrideDuplicateContributorLine(lines: string[], duplicateCount: number) {
  const replacement = `Duplicate docs flagged: ${duplicateCount}`;
  let replaced = false;
  const next = lines.map((line) => {
    if (line.startsWith("Duplicate docs flagged:")) {
      replaced = true;
      return replacement;
    }
    return line;
  });
  return replaced ? next : [...next, replacement];
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
  const docsNotUsedForDisplay = useLockedSnapshot ? liveReport.documents_not_used : report.documents_not_used;
  const usageSummary = useLockedSnapshot
    ? {
        irrelevantUnknownDocsCount: liveReport.irrelevantUnknownDocsCount,
        totalDocs: liveReport.totalDocs,
        documentsNotUsedCount: liveReport.documentsNotUsedCount,
        usedDocumentsCount: liveReport.usedDocumentsCount
      }
    : {
        irrelevantUnknownDocsCount: report.irrelevantUnknownDocsCount,
        totalDocs: report.totalDocs,
        documentsNotUsedCount: report.documentsNotUsedCount,
        usedDocumentsCount: report.usedDocumentsCount
      };
  const mixedBusinessMode =
    report.overall_assessment === "Documents appear to belong to multiple businesses" ||
    report.top_risks.some((risk) => (risk.rule_id ?? "").toLowerCase() === "multi_business_pack");
  const confidenceContributorsForDisplay = overrideIrrelevantContributorLine(
    report.confidence_contributors,
    usageSummary.irrelevantUnknownDocsCount,
    usageSummary.totalDocs
  );
  const confidenceContributorsWithDuplicates = overrideDuplicateContributorLine(
    confidenceContributorsForDisplay,
    report.duplicateDocumentsCount ?? 0
  );

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
          {report.score_reliability_note ? <p><span className="font-semibold">Score reliability:</span> {report.score_reliability_note}</p> : null}
          <p><span className="font-semibold">Status:</span> {report.score.status}</p>
          <p><span className="font-semibold">Confidence:</span> {report.confidence}</p>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">Overall assessment: {report.overall_assessment}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Plain-English Verdict</h2>
        <p className="mt-2 text-sm text-slate-700">{report.plain_english_verdict}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Why this status?</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.status_reasons.map((item) => <p key={item}>- {item}</p>)}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Confidence Contributors</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {confidenceContributorsWithDuplicates.map((item) => <p key={item}>- {item}</p>)}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Score Breakdown</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Starting score: {report.score.breakdown.starting_score}</p>
          {report.score.breakdown.deductions.length ? report.score.breakdown.deductions.map((d) => (
            <p key={`${d.reason}-${d.points}`}>- {d.reason}: -{d.points}</p>
          )) : <p>No deductions applied.</p>}
          {report.score.breakdown.notes?.map((note) => (
            <p key={note} className="text-amber-700">{note}</p>
          ))}
          <p className="font-semibold text-slate-900">Final score: {report.score.breakdown.final_score}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Baseline Evidence Checks</h2>
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
        {mixedBusinessMode ? (
          <p className="mt-2 text-sm text-amber-700">Additional findings detected after mixed-business warning. These findings may be unreliable until unrelated documents are removed.</p>
        ) : null}
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
          <p><span className="font-semibold">Duplicate documents detected:</span> {report.duplicateDocumentsCount ?? report.consistency_summary.duplicate_documents_detected}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Business/Entity Matching</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p><span className="font-semibold">Onboarded business:</span> {report.entity_matching.onboarded_business_name ?? "Not provided"}</p>
          <p><span className="font-semibold">Detected customer/producer names:</span> {report.entity_matching.detected_customer_or_producer_names.length ? report.entity_matching.detected_customer_or_producer_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Detected site/address names:</span> {report.entity_matching.detected_site_address_names.length ? report.entity_matching.detected_site_address_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Detected carrier/supplier names:</span> {report.entity_matching.detected_carrier_or_supplier_names.length ? report.entity_matching.detected_carrier_or_supplier_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Detected destination/facility names:</span> {report.entity_matching.detected_destination_or_facility_names.length ? report.entity_matching.detected_destination_or_facility_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Unclear entities:</span> {report.entity_matching.unclear_entity_names.length ? report.entity_matching.unclear_entity_names.join(", ") : "None detected"}</p>
          <p><span className="font-semibold">Unmatched business names:</span> {report.entity_matching.unmatched_business_names.length ? report.entity_matching.unmatched_business_names.join(", ") : "None"}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Recommended Next Actions</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.recommended_actions.length ? report.recommended_actions.map((action) => <p key={action}>- {action}</p>) : <p>No immediate action required.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Informational Findings</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.informational_findings.length ? report.informational_findings.map((finding) => <p key={finding.key}>- {finding.title}: {finding.message}</p>) : <p>No informational findings.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Missing Documents</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.missing_documents.length ? report.missing_documents.map((item) => <p key={item}>- {item}</p>) : <p>No major missing categories detected.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Unverifiable Documents</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.unverifiable_documents?.length ? report.unverifiable_documents.map((item) => <p key={item}>- {item}</p>) : <p>No uploaded evidence was flagged as unreadable.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Documents Requiring Review</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.documents_requiring_review?.length
            ? report.documents_requiring_review.map((d) => <p key={`${d.file_name}-${d.reason}`}>- {d.file_name}: {d.reason}</p>)
            : <p>No documents require quality review.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-900">Additional Supporting Documents</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {report.additional_supporting_documents?.length
            ? report.additional_supporting_documents.map((d) => <p key={`${d.file_name}-${d.reason}`}>- {d.file_name}: {d.reason}</p>)
            : <p>No additional supporting documents identified.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
          <h2 className="text-lg font-semibold text-slate-900">Documents Not Used In The Assessment</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          {docsNotUsedForDisplay.length ? (
            <>
              {docsNotUsedForDisplay.map((d) => <p key={`${d.file_name}-${d.reason}`}>- {d.file_name}: {d.reason}</p>)}
              {usageSummary.usedDocumentsCount === 0 && usageSummary.totalDocs > 0 ? (
                <p>All uploaded documents were reviewed; however, none contributed to waste compliance evidence.</p>
              ) : usageSummary.documentsNotUsedCount > 0 ? (
                <p>Some uploaded documents were excluded because they were not relevant to waste compliance.</p>
              ) : null}
            </>
          ) : (
            <p>No irrelevant documents were excluded from the assessment.</p>
          )}
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

      {process.env.NODE_ENV !== "production" && report.debug_document_relevance?.length ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-blue-900">Dev Debug: Relevance Classifier</h2>
          <div className="mt-2 space-y-2 text-xs text-blue-900">
            {report.debug_document_relevance.map((row) => (
              <article key={row.file_name} className="rounded border border-blue-200 bg-white p-2">
                <p><span className="font-semibold">filename:</span> {row.file_name}</p>
                <p><span className="font-semibold">document_type:</span> {row.document_type ?? "null"}</p>
                <p><span className="font-semibold">processing_status:</span> {row.processing_status ?? "null"}</p>
                <p><span className="font-semibold">extracted_data.document_type:</span> {row.extracted_data_document_type ?? "null"}</p>
                <p><span className="font-semibold">raw_text_excerpt:</span> {row.raw_text_excerpt || "N/A"}</p>
                <p><span className="font-semibold">relevance_status:</span> {row.relevance_status}</p>
                <p><span className="font-semibold">relevance_reason:</span> {row.relevance_reason}</p>
                <p><span className="font-semibold">used_in_assessment:</span> {String(row.used_in_assessment)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 print:bg-white print:border-slate-300">
        <p className="text-sm text-amber-900 print:text-slate-700">
          This report is based only on the documents provided. It is compliance support, not legal advice, and does not guarantee regulatory compliance.
        </p>
      </section>
    </div>
  );
}
