import { supabaseAdmin } from "@/lib/supabase/admin";

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
  const destinationPatterns = [
    /destination\s*:\s*([^\n\r.]+)/i,
    /disposal\s*site\s*:\s*([^\n\r.]+)/i,
    /receiving\s*facility\s*:\s*([^\n\r.]+)/i,
    /treatment\s*facility\s*:\s*([^\n\r.]+)/i
  ];

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

function buildChecks(params: { business: BusinessInfo; docs: ReportDocument[]; rules: RuleRef[]; sources: SourceRef[] }) {
  const { business, docs, rules, sources } = params;

  const processed = docs.filter(isProcessed);
  const wtDocs = processed.filter((d) => d.document_type === "waste_transfer_note");
  const carrierDocs = processed.filter((d) => d.document_type === "carrier_licence");
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
    result: carrierDocs.length ? "pass" : docs.length ? "fail" : "cannot_verify",
    evidence_used: carrierDocs.map((d) => d.file_name),
    affected_document: carrierDocs[0]?.file_name ?? null,
    recommended_action: carrierDocs.length ? "No immediate action." : "Upload carrier licence evidence.",
    source_reference: resolveSourceReference(
      "Carrier licence evidence present",
      findReference(rules, sources, ["waste carrier licence environment agency", "search waste carriers brokers"])
    )
  });

  const expiredCarrier = carrierDocs.find((d) => isExpired(d.expiry_date));
  checks.push({
    check_name: "Carrier licence valid / not expired",
    result: !carrierDocs.length ? "cannot_verify" : expiredCarrier ? "fail" : "pass",
    evidence_used: carrierDocs.map((d) => `${d.file_name} (${d.expiry_date ?? "no expiry"})`),
    affected_document: expiredCarrier?.file_name ?? carrierDocs[0]?.file_name ?? null,
    recommended_action: expiredCarrier ? "Replace or renew expired carrier licence evidence." : "No immediate action.",
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
    .map((doc) => ({ doc, destination: getDestinationEvidence(doc) }))
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
  if (byName("Carrier licence valid / not expired")?.result === "fail") deductions.push({ reason: "Expired carrier licence", points: 25 });
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

function confidenceFromSignals(params: {
  checks: BaselineCheck[];
  docs: ReportDocument[];
  alerts: ReportAlert[];
  missingDocs: string[];
  cannotVerifyCount: number;
}) {
  const { checks, docs, alerts, missingDocs, cannotVerifyCount } = params;
  const failed = docs.filter((d) => d.processing_status === "failed").length;
  const review = docs.filter((d) => d.processing_status === "review").length;
  const highOrMedium = alerts.filter((a) => a.severity === "high" || a.severity === "medium").length;
  const cannotVerifyChecks = checks.filter((c) => c.result === "cannot_verify").length;
  const noRefChecks = checks.filter((c) => c.source_reference.startsWith("No source reference available")).length;
  const requiredFails = checks.filter((c) => ["Waste Transfer Note present", "Carrier licence evidence present", "Carrier licence valid / not expired", "Food waste evidence present", "Hazardous waste consignment note present"].includes(c.check_name) && c.result === "fail").length;
  const completeFieldDocs = docs.filter((d) => d.processing_status === "processed" && !d.ai_extracted_json?.missing_fields?.length).length;
  const processedDocs = docs.filter((d) => d.processing_status === "processed").length;
  const extractionCompleteness = processedDocs === 0 ? 0 : completeFieldDocs / processedDocs;

  if (!docs.length || failed >= Math.max(1, Math.ceil(docs.length * 0.6)) || requiredFails >= 2 || cannotVerifyChecks >= 3 || cannotVerifyCount >= 4 || extractionCompleteness < 0.5) {
    return "Low Confidence / Cannot Fully Verify" as const;
  }

  const highConfidence = missingDocs.length === 0 && failed === 0 && review === 0 && highOrMedium === 0 && requiredFails === 0 && noRefChecks === 0 && extractionCompleteness >= 0.9;
  if (highConfidence) return "High Confidence" as const;

  return "Medium Confidence" as const;
}

function verdict(confidence: HealthCheckReport["confidence"], scoreStatus: HealthCheckReport["score"]["status"], missingCount: number) {
  if (confidence.startsWith("Low")) {
    return "We could not fully verify compliance from the documents provided.";
  }

  if (scoreStatus === "compliant" && missingCount === 0) {
    return "Based on the documents provided, your records appear reasonably complete for key waste compliance evidence checks.";
  }

  return "Based on the documents provided, your business appears to be missing key evidence required to prove waste compliance.";
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
  const missingDocs: string[] = [];
  if (checks.find((c) => c.check_name === "Waste Transfer Note present")?.result === "fail") missingDocs.push("Waste transfer note");
  if (checks.find((c) => c.check_name === "Carrier licence evidence present")?.result === "fail") missingDocs.push("Carrier licence evidence");
  if (checks.find((c) => c.check_name === "Supplier/contract evidence present")?.result !== "pass") missingDocs.push("Supplier/contract evidence");
  if (business.produces_food_waste && checks.find((c) => c.check_name === "Food waste evidence present")?.result !== "pass") missingDocs.push("Food waste documentation");
  if (business.produces_hazardous_waste && checks.find((c) => c.check_name === "Hazardous waste consignment note present")?.result !== "pass") missingDocs.push("Hazardous waste consignment note");

  const cannotVerify = new Set<string>();
  if (!docs.length) cannotVerify.add("No documents uploaded for review.");
  docs.filter((d) => d.processing_status === "failed").forEach((d) => cannotVerify.add(`${d.file_name}: processing failed (${d.processing_error ?? "unknown error"}).`));
  docs.filter((d) => d.processing_status === "review").forEach((d) => {
    const missing = d.ai_extracted_json?.missing_fields?.length ? d.ai_extracted_json.missing_fields.join(", ") : "required fields";
    cannotVerify.add(`${d.file_name}: missing extracted fields (${missing}).`);
  });
  checks.filter((c) => c.result === "cannot_verify").forEach((c) => cannotVerify.add(`${c.check_name}: cannot verify with current evidence.`));
  if (checks.some((c) => c.source_reference.startsWith("No source reference available"))) {
    cannotVerify.add("Some checks could not be linked to an official source reference.");
  }

  const recommendedActions = Array.from(
    new Map(
      checks
        .filter((c) => c.result !== "pass")
        .map((c) => {
          const category = lower(c.check_name);
          let action = c.recommended_action.trim();
          if (category.includes("food waste")) action = "Upload food waste collection evidence or contract documentation.";
          if (category.includes("supplier/contract")) action = "Upload supplier contract evidence for your waste provider.";
          if (category.includes("carrier licence") && category.includes("valid")) action = "Provide current carrier licence evidence with a valid expiry date.";
          return [category, action] as const;
        })
    ).values()
  );

  const score = scoreFromChecks({ checks, docs, business });
  const confidence = confidenceFromSignals({
    checks,
    docs,
    alerts: openAlerts,
    missingDocs,
    cannotVerifyCount: cannotVerify.size
  });

  return {
    generated_at: new Date().toISOString(),
    business: {
      id: business.id,
      name: business.name,
      business_type: business.business_type,
      sites_count: business.sites_count
    },
    score,
    confidence,
    plain_english_verdict: verdict(confidence, score.status, missingDocs.length),
    top_risks: openAlerts.slice(0, 5),
    missing_documents: missingDocs,
    compliance_checks: checks,
    documents: docs,
    references: refs,
    cannot_verify: Array.from(cannotVerify),
    recommended_actions: recommendedActions
  };
}
