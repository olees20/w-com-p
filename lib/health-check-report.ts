import { supabaseAdmin } from "@/lib/supabase/admin";
import { runCrossDocumentReasoning, type ConsistencyFinding } from "@/lib/cross-document-reasoning";
import { validateSingleBusinessPack } from "@/lib/entity-pack-validation";

export type CheckResult = "pass" | "attention_needed" | "fail" | "cannot_verify";

export type ReportDocument = {
  id: string;
  file_name: string;
  document_type: string | null;
  processing_status: "uploaded" | "processing" | "processed" | "review" | "failed" | null;
  processing_error: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  extracted_supplier: string | null;
  extracted_date: string | null;
  extracted_ewc_code: string | null;
  extracted_licence_number: string | null;
  expiry_date: string | null;
  waste_type: string | null;
  ai_summary: string | null;
  ai_extracted_json: { missing_fields?: string[] } | null;
  created_at: string;
};

export type ReportAlert = {
  id: string;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | null;
  status: string | null;
  rule_id: string | null;
  document_id: string | null;
};

type RuleRef = { id: string; title: string; source_url: string | null };
type SourceRef = { id: string; title: string | null; url: string };

type BusinessInfo = {
  id: string;
  name: string | null;
  business_type: string | null;
  sites_count: number | null;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
};

export type BaselineCheck = {
  check_name: string;
  result: CheckResult;
  evidence_used: string[];
  affected_document: string | null;
  recommended_action: string;
  source_reference: string;
};

export type ScoreBreakdown = {
  starting_score: number;
  deductions: Array<{ reason: string; points: number }>;
  final_score: number;
};

export type HealthCheckReport = {
  generated_at: string;
  business: {
    id: string;
    name: string | null;
    business_type: string | null;
    sites_count: number | null;
  };
  score: {
    score: number;
    status: "compliant" | "attention_needed" | "at_risk";
    breakdown: ScoreBreakdown;
  };
  confidence: "High Confidence" | "Medium Confidence" | "Low Confidence / Cannot Fully Verify";
  plain_english_verdict: string;
  top_risks: ReportAlert[];
  missing_documents: string[];
  compliance_checks: BaselineCheck[];
  documents: ReportDocument[];
  references: RuleRef[];
  cannot_verify: string[];
  recommended_actions: string[];
  consistency_findings: ConsistencyFinding[];
  confidence_contributors: string[];
  documents_not_used: Array<{ file_name: string; reason: string }>;
  consistency_summary: {
    carriers_detected: string[];
    licence_numbers_detected: string[];
    sites_or_addresses_detected: string[];
    document_date_range: { from: string | null; to: string | null };
    duplicate_documents_detected: number;
  };
  entity_matching: {
    onboarded_business_name: string | null;
    detected_customer_or_producer_names: string[];
    detected_carrier_or_supplier_names: string[];
    detected_destination_or_facility_names: string[];
    unmatched_business_names: string[];
  };
  overall_assessment: string;
  status_reasons: string[];
  informational_findings: ConsistencyFinding[];
};

function hasText(v: string | null | undefined) {
  return Boolean(v && v.trim().length > 0);
}

function lower(v: string | null | undefined) {
  return (v ?? "").toLowerCase();
}

function isExpired(v: string | null) {
  if (!v) return false;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function isProcessed(doc: ReportDocument) {
  return doc.processing_status === "processed";
}

function hasActiveMarker(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const candidates = [payload.status, payload.licence_status, payload.license_status, doc.ai_summary];
  return candidates.some((value) => typeof value === "string" && /status\s*:\s*active|\bactive\b/i.test(value));
}

function getCarrierResolution(docs: ReportDocument[]) {
  const carrierDocs = docs.filter((d) => d.document_type === "carrier_licence");
  const wtDocs = docs.filter((d) => d.document_type === "waste_transfer_note");
  const now = new Date();

  const evidenceNumbers = new Set(
    carrierDocs.map((d) => (d.extracted_licence_number ?? "").trim().toLowerCase()).filter(Boolean)
  );

  const hasAnyCarrierEvidence = carrierDocs.length > 0;
  const hasValidNow = carrierDocs.some((d) => {
    const expiry = d.expiry_date ? new Date(d.expiry_date) : null;
    return expiry && !Number.isNaN(expiry.getTime()) && expiry >= now;
  });
  const hasExpiredNow = carrierDocs.some((d) => {
    const expiry = d.expiry_date ? new Date(d.expiry_date) : null;
    return expiry && !Number.isNaN(expiry.getTime()) && expiry < now;
  });

  const internallyInconsistent = carrierDocs.some((d) => {
    const expiry = d.expiry_date ? new Date(d.expiry_date) : null;
    return hasActiveMarker(d) && !!expiry && !Number.isNaN(expiry.getTime()) && expiry < now;
  });

  const wtnWithLicence = wtDocs.filter((d) => (d.extracted_licence_number ?? "").trim());
  const wtnMismatch = wtnWithLicence.some(
    (wtn) => !evidenceNumbers.has((wtn.extracted_licence_number ?? "").trim().toLowerCase())
  );

  const hasValidMatchingWtn = wtnWithLicence.some((wtn) => {
    const key = (wtn.extracted_licence_number ?? "").trim().toLowerCase();
    if (!key) return false;
    return carrierDocs.some((lic) => {
      const licKey = (lic.extracted_licence_number ?? "").trim().toLowerCase();
      const expiry = lic.expiry_date ? new Date(lic.expiry_date) : null;
      return licKey === key && expiry && !Number.isNaN(expiry.getTime()) && expiry >= now;
    });
  });

  const validAtTransferButExpiredNow = wtnWithLicence.some((wtn) => {
    const wtnDate = wtn.extracted_date ? new Date(wtn.extracted_date) : null;
    if (!wtnDate || Number.isNaN(wtnDate.getTime())) return false;
    const key = (wtn.extracted_licence_number ?? "").trim().toLowerCase();
    return carrierDocs.some((lic) => {
      const licKey = (lic.extracted_licence_number ?? "").trim().toLowerCase();
      const expiry = lic.expiry_date ? new Date(lic.expiry_date) : null;
      return licKey === key && expiry && !Number.isNaN(expiry.getTime()) && expiry >= wtnDate && expiry < now;
    });
  });

  return {
    hasAnyCarrierEvidence,
    hasValidNow,
    hasExpiredNow,
    internallyInconsistent,
    wtnMismatch,
    hasValidMatchingWtn,
    hasMixedEvidence: hasValidNow && hasExpiredNow,
    validAtTransferButExpiredNow
  };
}

const CHECK_SOURCE_FALLBACKS: Record<string, string> = {
  "Waste Transfer Note present": "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes",
  "Waste invoice or collection evidence present": "https://www.gov.uk/dispose-business-commercial-waste",
  "Carrier licence evidence present": "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers",
  "Carrier licence valid / not expired": "https://www.gov.uk/register-renew-waste-carrier-broker-dealer-england",
  "EWC code present on WTN where available": "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes",
  "Waste destination present on WTN where available": "https://www.gov.uk/government/publications/waste-duty-of-care-code-of-practice",
  "Supplier/contract evidence present": "https://www.gov.uk/dispose-business-commercial-waste"
};

function findReference(rules: RuleRef[], sources: SourceRef[], terms: string[]) {
  const normTerms = terms.map((term) => lower(term));
  const ruleMatch = rules.find((rule) => normTerms.some((term) => lower(`${rule.title} ${rule.source_url}`).includes(term)));
  if (ruleMatch?.source_url) {
    return ruleMatch.source_url;
  }
  const sourceMatch = sources.find((source) => normTerms.some((term) => lower(`${source.title} ${source.url}`).includes(term)));
  return sourceMatch?.url ?? null;
}

function resolveSourceReference(
  checkName: string,
  candidate: string | null,
  allowFallback = true
) {
  if (candidate) return candidate;
  if (allowFallback && CHECK_SOURCE_FALLBACKS[checkName]) return CHECK_SOURCE_FALLBACKS[checkName];
  return "No source reference available for this specific check.";
}

function getDestinationEvidence(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const keys = [
    "destination",
    "disposal_site",
    "waste_destination",
    "facility",
    "treatment_facility",
    "receiving_facility",
    "destination_name",
    "destination_address"
  ];

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const rawTextCandidates = [
    payload.raw_text,
    payload.rawText,
    payload.extracted_text,
    payload.extractedText,
    payload.text,
    payload.raw_text_excerpt,
    doc.ai_summary
  ];
  const destinationPatterns = [/^Destination:\s*(.+)$/im, /^Disposal site:\s*(.+)$/im, /^Receiving facility:\s*(.+)$/im, /^Treatment facility:\s*(.+)$/im];

  for (const candidate of rawTextCandidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    for (const pattern of destinationPatterns) {
      const match = candidate.match(pattern);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  }

  return null;
}

export function extractDestinationFromEvidenceForTest(doc: Pick<ReportDocument, "ai_extracted_json" | "ai_summary">) {
  return getDestinationEvidence(doc as ReportDocument);
}

function buildChecks(params: { business: BusinessInfo; docs: ReportDocument[]; rules: RuleRef[]; sources: SourceRef[] }) {
  const { business, docs, rules, sources } = params;

  const processed = docs.filter(isProcessed);
  const wtDocs = processed.filter((d) => d.document_type === "waste_transfer_note");
  const carrierDocs = processed.filter((d) => d.document_type === "carrier_licence");
  const carrierResolution = getCarrierResolution(processed);
  const invoiceDocs = processed.filter((d) => d.document_type === "invoice");
  const contractDocs = processed.filter((d) => d.document_type === "contract");
  const hazDocs = processed.filter((d) => d.document_type === "hazardous_waste_note");
  const failedDocs = docs.filter((d) => d.processing_status === "failed");

  const checks: BaselineCheck[] = [];

  checks.push({
    check_name: "Waste Transfer Note present",
    result: wtDocs.length ? "pass" : docs.length ? "fail" : "cannot_verify",
    evidence_used: wtDocs.map((d) => d.file_name),
    affected_document: wtDocs[0]?.file_name ?? null,
    recommended_action: wtDocs.length ? "No immediate action." : "Upload at least one valid waste transfer note.",
    source_reference: resolveSourceReference(
      "Waste Transfer Note present",
      findReference(rules, sources, ["waste transfer note business waste gov.uk", "waste duty of care gov.uk"])
    )
  });

  checks.push({
    check_name: "Carrier licence evidence present",
    result: carrierResolution.hasAnyCarrierEvidence ? "pass" : docs.length ? "fail" : "cannot_verify",
    evidence_used: carrierDocs.map((d) => d.file_name),
    affected_document: carrierDocs[0]?.file_name ?? null,
    recommended_action: carrierDocs.length ? "No immediate action." : "Upload carrier licence evidence.",
    source_reference: resolveSourceReference(
      "Carrier licence evidence present",
      findReference(rules, sources, ["waste carrier licence environment agency", "search waste carriers brokers"])
    )
  });

  checks.push({
    check_name: "Carrier licence valid / not expired",
    result:
      !carrierResolution.hasAnyCarrierEvidence
        ? "cannot_verify"
        : carrierResolution.hasValidMatchingWtn
          ? "pass"
          : carrierResolution.hasValidNow && !carrierResolution.wtnMismatch
            ? "pass"
            : carrierResolution.hasMixedEvidence || carrierResolution.validAtTransferButExpiredNow
              ? "attention_needed"
              : "fail",
    evidence_used: carrierDocs.map((d) => `${d.file_name} (${d.expiry_date ?? "no expiry"})`),
    affected_document: carrierDocs[0]?.file_name ?? null,
    recommended_action:
      !carrierResolution.hasAnyCarrierEvidence
        ? "Upload carrier licence evidence."
        : carrierResolution.hasValidMatchingWtn || (carrierResolution.hasValidNow && !carrierResolution.wtnMismatch)
          ? "No immediate action."
          : carrierResolution.hasMixedEvidence
            ? "A valid licence appears to be present, but older expired licence evidence was also uploaded. Review which document should be relied on."
            : carrierResolution.validAtTransferButExpiredNow
              ? "Carrier licence may have been valid at the time of transfer but is expired now. Upload current evidence."
              : "Replace or renew expired carrier licence evidence.",
    source_reference: resolveSourceReference(
      "Carrier licence valid / not expired",
      findReference(rules, sources, ["waste carrier licence environment agency", "public register waste carriers"])
    )
  });

  checks.push({
    check_name: "Waste invoice or collection evidence present",
    result: invoiceDocs.length || wtDocs.length ? "pass" : docs.length ? "attention_needed" : "cannot_verify",
    evidence_used: [...invoiceDocs, ...wtDocs].map((d) => d.file_name),
    affected_document: null,
    recommended_action: invoiceDocs.length || wtDocs.length ? "No immediate action." : "Upload invoice or collection evidence.",
    source_reference: resolveSourceReference(
      "Waste invoice or collection evidence present",
      findReference(rules, sources, ["dispose business commercial waste", "waste transfer note"])
    )
  });

  checks.push({
    check_name: "Supplier/contract evidence present",
    result: contractDocs.length ? "pass" : docs.length ? "attention_needed" : "cannot_verify",
    evidence_used: contractDocs.map((d) => d.file_name),
    affected_document: contractDocs[0]?.file_name ?? null,
    recommended_action: contractDocs.length ? "No immediate action." : "Upload supplier contract evidence.",
    source_reference: resolveSourceReference(
      "Supplier/contract evidence present",
      findReference(rules, sources, ["waste duty of care gov.uk", "dispose business commercial waste"])
    )
  });

  if (business.produces_food_waste) {
    const foodEvidence = processed.filter((d) => lower(`${d.waste_type} ${d.ai_summary}`).includes("food"));
    checks.push({
      check_name: "Food waste evidence present",
      result: foodEvidence.length ? "pass" : docs.length ? "fail" : "cannot_verify",
      evidence_used: foodEvidence.map((d) => d.file_name),
      affected_document: foodEvidence[0]?.file_name ?? null,
      recommended_action: foodEvidence.length ? "No immediate action." : "Upload food waste collection evidence.",
      source_reference: resolveSourceReference(
        "Food waste evidence present",
        findReference(rules, sources, ["food waste workplace recycling england gov.uk", "simpler recycling workplace recycling"]),
        false
      )
    });
  }

  if (business.produces_hazardous_waste) {
    checks.push({
      check_name: "Hazardous waste consignment note present",
      result: hazDocs.length ? "pass" : docs.length ? "fail" : "cannot_verify",
      evidence_used: hazDocs.map((d) => d.file_name),
      affected_document: hazDocs[0]?.file_name ?? null,
      recommended_action: hazDocs.length ? "No immediate action." : "Upload hazardous waste consignment note evidence.",
      source_reference: resolveSourceReference(
        "Hazardous waste consignment note present",
        findReference(rules, sources, ["hazardous waste consignment note gov.uk", "hazardous waste note"]),
        false
      )
    });
  }

  const wtnWithDestination = wtDocs
    .map((doc) => {
      const destination = getDestinationEvidence(doc);
      if (process.env.NODE_ENV !== "production") {
        const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
        console.log("[health-check][destination]", {
          file: doc.file_name,
          candidates: {
            destination: payload.destination,
            disposal_site: payload.disposal_site,
            waste_destination: payload.waste_destination,
            facility: payload.facility,
            treatment_facility: payload.treatment_facility,
            receiving_facility: payload.receiving_facility,
            destination_name: payload.destination_name,
            destination_address: payload.destination_address,
            raw_text_excerpt: typeof payload.raw_text_excerpt === "string" ? payload.raw_text_excerpt.slice(0, 240) : null
          },
          finalDestination: destination
        });
      }
      return { doc, destination };
    })
    .filter((entry) => hasText(entry.destination));
  const hasDestinationCoverage = wtnWithDestination.length > 0;
  checks.push({
    check_name: "Waste destination present on WTN where available",
    result: wtDocs.length === 0 ? "cannot_verify" : hasDestinationCoverage ? "pass" : "attention_needed",
    evidence_used: wtnWithDestination.map((entry) => `${entry.doc.file_name} — ${entry.destination}`),
    affected_document: wtDocs[0]?.file_name ?? null,
    recommended_action: hasDestinationCoverage ? "No immediate action." : "Ensure destination details are visible on waste transfer records.",
    source_reference: resolveSourceReference(
      "Waste destination present on WTN where available",
      findReference(rules, sources, ["waste transfer note business waste gov.uk", "waste duty of care gov.uk"])
    )
  });

  const wtnWithEwc = wtDocs.filter((d) => hasText(d.extracted_ewc_code));
  checks.push({
    check_name: "EWC code present on WTN where available",
    result: wtDocs.length === 0 ? "cannot_verify" : wtnWithEwc.length ? "pass" : "attention_needed",
    evidence_used: wtnWithEwc.map((d) => d.file_name),
    affected_document: wtDocs[0]?.file_name ?? null,
    recommended_action: wtnWithEwc.length ? "No immediate action." : "Upload WTN copies that include EWC code details.",
    source_reference: resolveSourceReference(
      "EWC code present on WTN where available",
      findReference(rules, sources, ["ewc code waste transfer note", "waste transfer note guidance"])
    )
  });

  if (failedDocs.length > 0) {
    checks.push({
      check_name: "Document extraction reliability",
      result: "attention_needed",
      evidence_used: failedDocs.map((d) => d.file_name),
      affected_document: failedDocs[0]?.file_name ?? null,
      recommended_action: "Rescan failed documents or upload clearer copies.",
      source_reference: "No source reference available for this specific check."
    });
  }

  return checks;
}

function scoreFromChecks(params: { checks: BaselineCheck[]; docs: ReportDocument[]; business: BusinessInfo }) {
  const { checks, docs, business } = params;
  let score = 100;
  const deductions: Array<{ reason: string; points: number }> = [];

  const byName = (name: string) => checks.find((c) => c.check_name === name);

  if (byName("Waste Transfer Note present")?.result === "fail") deductions.push({ reason: "Missing waste transfer note", points: 35 });
  if (byName("Carrier licence valid / not expired")?.result === "fail") deductions.push({ reason: "Only expired carrier licence evidence found", points: 25 });
  if (byName("Carrier licence valid / not expired")?.result === "attention_needed") deductions.push({ reason: "Multiple carrier licence records found", points: 8 });
  if (byName("Carrier licence evidence present")?.result === "fail") deductions.push({ reason: "Missing carrier licence evidence", points: 25 });
  if (business.produces_food_waste && byName("Food waste evidence present")?.result === "fail") deductions.push({ reason: "Missing food waste evidence", points: 15 });
  if (business.produces_hazardous_waste && byName("Hazardous waste consignment note present")?.result === "fail") deductions.push({ reason: "Missing hazardous waste consignment note", points: 30 });
  if (byName("Supplier/contract evidence present")?.result === "attention_needed") deductions.push({ reason: "Missing supplier contract evidence", points: 8 });
  if (byName("Waste destination present on WTN where available")?.result === "attention_needed") deductions.push({ reason: "Missing destination detail on WTN", points: 8 });
  if (byName("EWC code present on WTN where available")?.result === "attention_needed") deductions.push({ reason: "Missing EWC code on WTN", points: 8 });

  const failedImportant = docs.filter((d) => d.processing_status === "failed" && ["waste_transfer_note", "carrier_licence", "invoice", "contract", "hazardous_waste_note"].includes(d.document_type ?? "unknown")).length;
  if (failedImportant > 0) deductions.push({ reason: `Failed important document processing (${failedImportant})`, points: failedImportant * 10 });

  const checksWithRef = checks.filter((c) => !c.source_reference.startsWith("No source reference available")).length;
  if (checksWithRef === 0) deductions.push({ reason: "No official references retrieved for checks", points: 5 });

  for (const d of deductions) score -= d.points;
  score = Math.max(0, Math.min(100, score));

  const status = score >= 80 ? "compliant" : score >= 50 ? "attention_needed" : "at_risk";

  return {
    score,
    status,
    breakdown: {
      starting_score: 100,
      deductions,
      final_score: score
    }
  } as const;
}

function mergeDeductions(
  base: ScoreBreakdown,
  extra: Array<{ reason: string; points: number }>
): ScoreBreakdown {
  const deductions = [...base.deductions, ...extra];
  let final = base.starting_score;
  for (const d of deductions) final -= d.points;
  final = Math.max(0, Math.min(100, final));
  return {
    starting_score: base.starting_score,
    deductions,
    final_score: final
  };
}

function confidenceFromSignals(params: {
  checks: BaselineCheck[];
  docs: ReportDocument[];
  alerts: ReportAlert[];
  missingDocs: string[];
  cannotVerifyCount: number;
  crossFindings: ConsistencyFinding[];
}) {
  const { checks, docs, alerts, missingDocs, cannotVerifyCount, crossFindings } = params;
  const failed = docs.filter((d) => d.processing_status === "failed").length;
  const review = docs.filter((d) => d.processing_status === "review").length;
  const highOrMedium = alerts.filter((a) => a.severity === "high" || a.severity === "medium").length;
  const highOnly = alerts.filter((a) => a.severity === "high").length;
  const cannotVerifyChecks = checks.filter((c) => c.result === "cannot_verify").length;
  const noRefChecks = checks.filter((c) => c.source_reference.startsWith("No source reference available")).length;
  const requiredFails = checks.filter((c) => ["Waste Transfer Note present", "Carrier licence evidence present", "Carrier licence valid / not expired", "Food waste evidence present", "Hazardous waste consignment note present"].includes(c.check_name) && c.result === "fail").length;
  const completeFieldDocs = docs.filter((d) => d.processing_status === "processed" && !d.ai_extracted_json?.missing_fields?.length).length;
  const processedDocs = docs.filter((d) => d.processing_status === "processed").length;
  const extractionCompleteness = processedDocs === 0 ? 0 : completeFieldDocs / processedDocs;
  const unknownCount = docs.filter((d) => d.document_type === "unknown").length;
  const irrelevantRatio = docs.length === 0 ? 1 : unknownCount / docs.length;
  const duplicateCount = crossFindings.find((f) => f.key === "duplicate_documents")?.evidence.length ?? 0;
  const duplicateRatio = docs.length === 0 ? 0 : duplicateCount / docs.length;
  const hasMajorCarrierConflict = crossFindings.some((f) => f.key === "conflicting_waste_carriers" && f.severity === "high");
  const hasLicenceMismatch = crossFindings.some((f) => f.key === "licence_mismatch");
  const hasFutureDatedKey = crossFindings.some((f) => f.key === "future_dated_documents");
  const hasStaleWtn = crossFindings.some((f) => f.key === "stale_wtn");
  const majorCrossConflictCount = crossFindings.filter((f) => f.status === "fail").length;

  let level: 1 | 2 | 3 = 2; // 1 low, 2 medium, 3 high

  const hardLow =
    !docs.length ||
    requiredFails >= 2 ||
    failed >= Math.max(1, Math.ceil(docs.length * 0.5)) ||
    highOnly >= 2 ||
    majorCrossConflictCount >= 2 ||
    extractionCompleteness < 0.5 ||
    irrelevantRatio > 0.5;

  if (hardLow) {
    level = 1;
  } else {
    const highConfidenceCandidate =
      missingDocs.length === 0 &&
      failed === 0 &&
      review === 0 &&
      highOrMedium === 0 &&
      requiredFails === 0 &&
      noRefChecks <= 1 &&
      extractionCompleteness >= 0.9 &&
      irrelevantRatio <= 0.15 &&
      duplicateRatio <= 0.2 &&
      majorCrossConflictCount === 0;

    level = highConfidenceCandidate ? 3 : 2;
  }

  if (hasMajorCarrierConflict || hasLicenceMismatch || hasFutureDatedKey || hasStaleWtn || irrelevantRatio > 0.25 || duplicateRatio > 0.4) {
    level = Math.max(1, level - 1) as 1 | 2 | 3;
  }

  if (cannotVerifyChecks >= 3 || cannotVerifyCount >= 4) {
    level = 1;
  }

  if (level === 3) return "High Confidence" as const;
  if (level === 2) return "Medium Confidence" as const;
  return "Low Confidence / Cannot Fully Verify" as const;
}

export function assessConfidenceForTest(params: {
  checks: BaselineCheck[];
  docs: ReportDocument[];
  alerts: ReportAlert[];
  missingDocs: string[];
  cannotVerifyCount: number;
  crossFindings: ConsistencyFinding[];
}) {
  return confidenceFromSignals(params);
}

function verdict(confidence: HealthCheckReport["confidence"], scoreStatus: HealthCheckReport["score"]["status"], missingCount: number) {
  if (confidence.startsWith("Low")) {
    return "We could not fully verify compliance because the uploaded documents contain inconsistencies or unsupported files.";
  }

  if (scoreStatus === "compliant" && missingCount === 0) {
    return "Based on the documents provided, your records appear reasonably complete for key waste compliance evidence checks.";
  }

  return "Based on the documents provided, your business appears to be missing key evidence required to prove waste compliance.";
}

function overallAssessment(params: {
  confidence: HealthCheckReport["confidence"];
  entityMismatchFail: boolean;
  crossConflicts: number;
}) {
  if (params.entityMismatchFail) return "Documents appear to belong to multiple businesses";
  if (params.confidence.startsWith("Low")) return "Evidence pack cannot be reliably assessed";
  if (params.crossConflicts > 0) return "Evidence pack needs review";
  return "Evidence pack appears usable";
}

function isBusinessRelevantRisk(alert: ReportAlert) {
  const text = `${alert.title} ${alert.description ?? ""}`.toLowerCase();
  const patterns = [
    "waste transfer note",
    "carrier licence",
    "carrier license",
    "conflicting waste carriers",
    "licence evidence does not match",
    "license evidence does not match",
    "food waste",
    "hazardous waste",
    "future-dated",
    "stale",
    "site coverage",
    "missing destination",
    "missing ewc",
    "multiple businesses"
  ];
  return patterns.some((p) => text.includes(p));
}

function isCarrierExpiredRisk(alert: ReportAlert) {
  const text = `${alert.title} ${alert.description ?? ""}`.toLowerCase();
  return text.includes("carrier licence expired") || text.includes("carrier license expired") || text.includes("carrier licence evidence expired");
}

export function isBusinessRelevantRiskForTest(alert: ReportAlert) {
  return isBusinessRelevantRisk(alert);
}

function buildConsistencySummary(
  docs: ReportDocument[],
  findings: ConsistencyFinding[],
  options?: { carriersDetected?: string[]; destinationsDetected?: string[] }
) {
  const carriers = options?.carriersDetected ?? Array.from(new Set(docs.map((d) => d.extracted_supplier?.trim()).filter((v): v is string => !!v)));
  const licenceNumbers = Array.from(new Set(docs.map((d) => d.extracted_licence_number?.trim()).filter((v): v is string => !!v)));
  const sites = Array.from(
    new Set(
      docs
        .map((d) => {
          const payload = (d.ai_extracted_json ?? {}) as Record<string, unknown>;
          const candidates = [payload.destination_address, payload.address, payload.site, payload.destination_name, payload.destination];
          return candidates.find((c) => typeof c === "string" && c.trim()) as string | undefined;
        })
        .filter((v): v is string => !!v)
    )
  );
  const dated = docs.map((d) => d.extracted_date).filter((v): v is string => !!v).sort();
  const duplicateCount = findings.find((f) => f.key === "duplicate_documents")?.evidence.length ?? 0;
  return {
    carriers_detected: carriers,
    licence_numbers_detected: licenceNumbers,
    sites_or_addresses_detected: options?.destinationsDetected ?? sites,
    document_date_range: {
      from: dated[0] ?? null,
      to: dated[dated.length - 1] ?? null
    },
    duplicate_documents_detected: duplicateCount
  };
}

export async function buildHealthCheckReportForBusiness(params: { businessId: string; userId: string }): Promise<HealthCheckReport> {
  const { businessId } = params;
  const [{ data: business }, { data: documents }, { data: alerts }, { data: rules }, { data: sources }] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("id,name,business_type,sites_count,produces_food_waste,produces_hazardous_waste")
      .eq("id", businessId)
      .maybeSingle<BusinessInfo>(),
    supabaseAdmin
      .from("documents")
      .select(
        "id,file_name,document_type,processing_status,processing_error,ai_risk_level,extracted_supplier,extracted_date,extracted_ewc_code,extracted_licence_number,expiry_date,waste_type,ai_summary,ai_extracted_json,created_at"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("alerts")
      .select("id,title,description,severity,status,rule_id,document_id")
      .eq("business_id", businessId)
      .eq("status", "open"),
    supabaseAdmin.from("compliance_rules").select("id,title,source_url").eq("is_active", true).limit(30),
    supabaseAdmin.from("regulatory_sources").select("id,title,url").eq("is_active", true).limit(80)
  ]);

  if (!business) throw new Error("Business not found.");

  const docs = (documents ?? []) as ReportDocument[];
  const openAlerts = (alerts ?? []) as ReportAlert[];
  const refs = (rules ?? []) as RuleRef[];
  const sourceRefs = (sources ?? []) as SourceRef[];

  const checks = buildChecks({ business, docs, rules: refs, sources: sourceRefs });
  const entityValidation = validateSingleBusinessPack({
    onboardedBusinessName: business.name,
    documents: docs
  });
  const cross = runCrossDocumentReasoning({
    documents: docs,
    openAlerts,
    business: {
      produces_food_waste: business.produces_food_waste,
      produces_hazardous_waste: business.produces_hazardous_waste
    }
  });
  const missingDocs: string[] = [];
  if (checks.find((c) => c.check_name === "Waste Transfer Note present")?.result === "fail") missingDocs.push("Waste transfer note");
  if (checks.find((c) => c.check_name === "Carrier licence evidence present")?.result === "fail") missingDocs.push("Carrier licence evidence");
  if (checks.find((c) => c.check_name === "Supplier/contract evidence present")?.result !== "pass") missingDocs.push("Supplier/contract evidence");
  if (business.produces_food_waste && checks.find((c) => c.check_name === "Food waste evidence present")?.result !== "pass") missingDocs.push("Food waste documentation");
  if (business.produces_hazardous_waste && checks.find((c) => c.check_name === "Hazardous waste consignment note present")?.result !== "pass") missingDocs.push("Hazardous waste consignment note");

  const cannotVerify = new Set<string>();
  if (!docs.length) cannotVerify.add("No documents uploaded for review.");
  docs.filter((d) => d.processing_status === "failed").forEach((d) => cannotVerify.add(`${d.file_name}: processing failed (${d.processing_error ?? "unknown error"}).`));
  const reviewCount = docs.filter((d) => d.processing_status === "review").length;
  if (reviewCount > 0) {
    cannotVerify.add(`${reviewCount} documents could not be fully interpreted and require review.`);
  }
  checks.filter((c) => c.result === "cannot_verify").forEach((c) => cannotVerify.add(`${c.check_name}: cannot verify with current evidence.`));
  if (checks.some((c) => c.source_reference.startsWith("No source reference available"))) {
    cannotVerify.add("Some checks could not be linked to an official source reference.");
  }
  if (entityValidation.finding?.status === "fail") {
    cannotVerify.add("The uploaded pack appears to mix multiple business entities, so a single-business assessment is unreliable.");
  }
  cross.cannot_verify_items.forEach((item) => cannotVerify.add(item));

  const recommendedActions = Array.from(
    new Map(
      [...checks.map((check) => ({ action: check.recommended_action, key: lower(check.check_name), result: check.result }))]
        .filter((c) => c.result !== "pass")
        .map((c) => {
          const category = c.key;
          let action = c.action.trim();
          if (category.includes("food waste")) action = "Upload food waste collection evidence or contract documentation.";
          if (category.includes("supplier/contract")) action = "Upload supplier contract evidence for your waste provider.";
          if (category.includes("carrier licence") && category.includes("valid")) action = "Provide current carrier licence evidence with a valid expiry date.";
          return [category, action] as const;
        })
    ).values()
  );
  for (const action of cross.recommended_actions) {
    if (!recommendedActions.includes(action)) recommendedActions.push(action);
  }
  if (entityValidation.finding?.recommended_action && !recommendedActions.includes(entityValidation.finding.recommended_action)) {
    recommendedActions.unshift(entityValidation.finding.recommended_action);
  }
  const businessActionsOnly = recommendedActions.filter(
    (action) => !/missing_fields|ewc_code_or_licence_number|document_type|no action required|no immediate action/i.test(action.toLowerCase())
  );

  const baseScore = scoreFromChecks({ checks, docs, business });
  const mergedBreakdown = mergeDeductions(
    baseScore.breakdown,
    [...cross.score_deductions, ...(entityValidation.finding ? [{ reason: entityValidation.finding.title, points: entityValidation.finding.points }] : [])]
  );
  let mergedScore = mergedBreakdown.final_score;
  if (entityValidation.finding?.status === "fail") {
    mergedScore = Math.min(mergedScore, 49);
  }
  const score = {
    score: mergedScore,
    status: mergedScore >= 80 ? "compliant" : mergedScore >= 50 ? "attention_needed" : "at_risk",
    breakdown: mergedBreakdown
  } as const;
  const confidence = confidenceFromSignals({
    checks,
    docs,
    alerts: [...openAlerts, ...cross.business_level_risks],
    missingDocs,
    cannotVerifyCount: cannotVerify.size + cross.confidence_adjustments.length,
    crossFindings: cross.consistency_findings
  });
  const finalConfidence = entityValidation.finding?.status === "fail" ? "Low Confidence / Cannot Fully Verify" : confidence;

  const confidenceContributors = [
    `Baseline evidence checks: ${checks.filter((c) => c.result === "pass").length}/${checks.length} passed`,
    `Extraction completeness: ${Math.round((docs.filter((d) => d.processing_status === "processed" && !d.ai_extracted_json?.missing_fields?.length).length / Math.max(1, docs.filter((d) => d.processing_status === "processed").length)) * 100)}%`,
    `Business-level risks (high/medium): ${[...openAlerts, ...cross.business_level_risks].filter((a) => a.severity === "high" || a.severity === "medium").length}`,
    `Cross-document findings: ${cross.consistency_findings.length}`,
    `Irrelevant/unknown docs: ${docs.filter((d) => d.document_type === "unknown").length}/${docs.length}`,
    `Duplicate docs flagged: ${cross.consistency_findings.find((f) => f.key === "duplicate_documents")?.evidence.length ?? 0}`,
    `Source coverage: ${checks.filter((c) => !c.source_reference.startsWith("No source reference available")).length}/${checks.length}`
  ];
  if (entityValidation.finding) {
    confidenceContributors.push(`Entity match ratio: ${Math.round(entityValidation.match_ratio * 100)}% (${entityValidation.producer_names.length} producer/customer names detected)`);
  }

  const carrierCheck = checks.find((c) => c.check_name === "Carrier licence valid / not expired");
  const businessRisks = [...openAlerts, ...cross.business_level_risks].filter((risk) => {
    if (carrierCheck?.result === "pass" && isCarrierExpiredRisk(risk)) {
      return false;
    }
    return true;
  });
  if (entityValidation.finding) {
    businessRisks.unshift({
      id: "entity-validation",
      title: entityValidation.finding.title,
      description: entityValidation.finding.message,
      severity: entityValidation.finding.severity,
      status: "open",
      rule_id: entityValidation.finding.key,
      document_id: null
    });
  }

  const informationalFindings = cross.consistency_findings.filter((f) =>
    ["duplicate_documents", "irrelevant_documents", "historic_expired_licence_uploaded"].includes(f.key)
  );
  const crossConflicts = cross.consistency_findings.filter((f) => f.status === "fail" || f.status === "attention_needed").length;
  const assessment = overallAssessment({
    confidence: finalConfidence,
    entityMismatchFail: entityValidation.finding?.status === "fail",
    crossConflicts
  });
  const statusReasons = [
    `Baseline evidence checks: ${checks.filter((c) => c.result === "pass").length}/${checks.length} passed`,
    crossConflicts > 0 ? `${crossConflicts} cross-document consistency issues found` : "No major cross-document consistency conflicts detected",
    (cross.consistency_findings.some((f) => f.key.includes("licence")) || cross.consistency_findings.some((f) => f.key.includes("future") || f.key.includes("stale")))
      ? "Date/licence evidence requires review"
      : "No major date/licence conflicts detected",
    docs.filter((d) => d.document_type === "unknown").length > 0
      ? `${docs.filter((d) => d.document_type === "unknown").length} unsupported files were excluded`
      : "No unsupported files were excluded"
  ];

  return {
    generated_at: new Date().toISOString(),
    business: {
      id: business.id,
      name: business.name,
      business_type: business.business_type,
      sites_count: business.sites_count
    },
    score,
    confidence: finalConfidence,
    plain_english_verdict: verdict(finalConfidence, score.status, missingDocs.length),
    top_risks: businessRisks.filter(isBusinessRelevantRisk).slice(0, 5),
    missing_documents: missingDocs,
    compliance_checks: checks,
    documents: docs,
    references: refs,
    cannot_verify: Array.from(cannotVerify),
    recommended_actions: businessActionsOnly,
    consistency_findings: cross.consistency_findings,
    confidence_contributors: confidenceContributors,
    documents_not_used: docs
      .filter((d) => d.document_type === "unknown")
      .map((d) => ({ file_name: d.file_name, reason: "Unsupported or unrelated document" })),
    consistency_summary: buildConsistencySummary(docs, cross.consistency_findings, {
      carriersDetected: entityValidation.carrier_names,
      destinationsDetected: entityValidation.destination_names
    }),
    entity_matching: {
      onboarded_business_name: business.name,
      detected_customer_or_producer_names: entityValidation.producer_names,
      detected_carrier_or_supplier_names: entityValidation.carrier_names,
      detected_destination_or_facility_names: entityValidation.destination_names,
      unmatched_business_names: entityValidation.unmatched_producer_names
    },
    overall_assessment: assessment,
    status_reasons: statusReasons,
    informational_findings: informationalFindings
  };
}
