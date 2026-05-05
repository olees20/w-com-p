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
  ai_extracted_json: (Record<string, unknown> & { missing_fields?: string[] }) | null;
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
  notes?: string[];
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
  score_reliability_note: string | null;
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
  additional_supporting_documents: Array<{ file_name: string; reason: string }>;
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
    detected_site_address_names: string[];
    unclear_entity_names: string[];
    unmatched_business_names: string[];
  };
  overall_assessment: string;
  status_reasons: string[];
  informational_findings: ConsistencyFinding[];
};

type NotUsedClassification = {
  file_name: string;
  reason: string;
  recommended_action: string | null;
  category: "unrelated" | "unreadable" | "ambiguous" | "potentially_relevant_unreadable";
};

type SupportingDocument = {
  file_name: string;
  reason: string;
};

type UnknownDocRole = "supporting" | "irrelevant" | "ambiguous";
type DocumentAssessmentRole = "PRIMARY_EVIDENCE" | "SUPPORTING_EVIDENCE" | "IRRELEVANT_NOT_USED";
type DocumentRelevanceStatus = DocumentAssessmentRole | "UNUSABLE";
type DocumentRelevance = {
  relevance_status: DocumentRelevanceStatus;
  relevance_reason: string;
  used_in_assessment: boolean;
};

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function pluralizeForTest(count: number, singular: string, plural: string) {
  return pluralize(count, singular, plural);
}

function hasText(v: string | null | undefined) {
  return Boolean(v && v.trim().length > 0);
}

function classifyUnknownDocumentRole(doc: ReportDocument): UnknownDocRole {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const text = `${doc.file_name} ${doc.ai_summary ?? ""} ${JSON.stringify(payload)}`.toLowerCase();
  const hasSupplierConfirmation = /(supplier confirmation|supplier update|provider confirmation|service confirmation|collection confirmation|correspondence|email)/.test(text);
  const hasLicenceReference = /(licen[cs]e|registration number|carrier number|cbd[u0-9]+)/.test(text);
  const hasWasteServiceReference = /(waste service|waste collection|collection service|general waste|recycling collection|service agreement|waste transfer)/.test(text);
  const supportingSignals = hasSupplierConfirmation || hasLicenceReference || hasWasteServiceReference;
  if (supportingSignals) return "supporting";
  if (/(insurance|menu|receipt|bank statement|payroll|employment|cv)/.test(text)) return "irrelevant";
  return "ambiguous";
}

function isClearlyIrrelevantDocument(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const text = `${doc.file_name} ${doc.document_type ?? ""} ${doc.ai_summary ?? ""} ${JSON.stringify(payload)}`.toLowerCase();
  const irrelevantSignals = /(insurance|menu|restaurant menu|public liability|employers liability|bank statement|payroll|employment|cv|generic receipt)/.test(text);
  const wasteSignals = /(waste|carrier|licen[cs]e|collection|ewc|consignment|transfer note|recycling|supplier|invoice|contract)/.test(text);
  return irrelevantSignals && !wasteSignals;
}

function classifyDocumentAssessmentRole(doc: ReportDocument): DocumentAssessmentRole {
  if (isClearlyIrrelevantDocument(doc)) return "IRRELEVANT_NOT_USED";
  const type = (doc.document_type ?? "unknown").toLowerCase();
  if (["waste_transfer_note", "carrier_licence", "invoice", "contract", "hazardous_waste_note", "recycling_report"].includes(type)) {
    return "PRIMARY_EVIDENCE";
  }
  if (type === "unknown") {
    const unknownRole = classifyUnknownDocumentRole(doc);
    if (unknownRole === "supporting" || unknownRole === "ambiguous") return "SUPPORTING_EVIDENCE";
    return "IRRELEVANT_NOT_USED";
  }
  return "SUPPORTING_EVIDENCE";
}

function getDocumentRelevance(doc: ReportDocument): DocumentRelevance {
  const role = classifyDocumentAssessmentRole(doc);
  if (role === "IRRELEVANT_NOT_USED") {
    return {
      relevance_status: "IRRELEVANT_NOT_USED",
      relevance_reason: "unrelated to waste compliance",
      used_in_assessment: false
    };
  }

  const hasNoType = !hasText(doc.document_type);
  const hasNoSummary = !hasText(doc.ai_summary);
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const payloadKeys = Object.keys(payload).filter((k) => k !== "missing_fields");
  const hasNoStructured = payloadKeys.length === 0;
  if (doc.processing_status === "failed" && hasNoType && hasNoSummary && hasNoStructured) {
    return {
      relevance_status: "UNUSABLE",
      relevance_reason: "unreadable or extraction failed",
      used_in_assessment: false
    };
  }

  return {
    relevance_status: role,
    relevance_reason: role === "PRIMARY_EVIDENCE" ? "primary waste compliance evidence" : "supporting waste compliance evidence",
    used_in_assessment: true
  };
}

export function classifyDocumentRelevanceForTest(doc: ReportDocument) {
  return getDocumentRelevance(doc);
}

function classifySupportingDocuments(docs: ReportDocument[]): SupportingDocument[] {
  const reasonFromDoc = (doc: ReportDocument) => {
    const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
    const text = `${doc.file_name} ${doc.ai_summary ?? ""} ${JSON.stringify(payload)}`.toLowerCase();
    const reasons: string[] = [];
    if (/(supplier confirmation|supplier update|provider confirmation)/.test(text)) reasons.push("confirms supplier details");
    if (/(licen[cs]e|registration number|carrier number|cbd[u0-9]+)/.test(text)) reasons.push("references carrier licence details");
    if (/(waste service|waste collection|collection service|general waste|recycling collection|food waste)/.test(text)) reasons.push("confirms waste collection/services");
    if (/(weekly|fortnightly|monthly|frequency)/.test(text)) reasons.push("confirms collection frequency");
    if (!reasons.length) return "waste-related correspondence supporting primary evidence.";
    return `${reasons.join(", ")}.`;
  };

  return docs
    .filter((doc) => classifyDocumentAssessmentRole(doc) === "SUPPORTING_EVIDENCE")
    .map((doc) => ({
      file_name: doc.file_name,
      reason: reasonFromDoc(doc)
    }));
}

function getJsonText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getCarrierNameFromDoc(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  return (
    (typeof doc.extracted_supplier === "string" && doc.extracted_supplier.trim() ? doc.extracted_supplier.trim() : null) ??
    getJsonText(payload, [
      "carrier_name",
      "waste_carrier",
      "registered_carrier",
      "collector",
      "transporter",
      "transferee",
      "business_taking_waste",
      "supplier",
      "invoice_issuer",
      "provider",
      "contract_supplier"
    ])
  );
}

function getCarrierLicenceFromDoc(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const candidates = [doc.extracted_licence_number, payload.licence_number, payload.carrier_licence_number, payload.registration_number];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function hasValidCarrierLicenceFields(doc: ReportDocument) {
  return hasText(getCarrierNameFromDoc(doc)) && hasText(getCarrierLicenceFromDoc(doc)) && hasText(doc.expiry_date);
}

function getProducerOrCustomerName(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  return getJsonText(payload, [
    "producer_name",
    "customer_name",
    "client_name",
    "waste_producer",
    "producer",
    "current_holder",
    "transferor",
    "invoice_recipient",
    "customer",
    "client"
  ]);
}

function getDestinationName(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  return getJsonText(payload, [
    "destination",
    "destination_name",
    "waste_destination",
    "disposal_site",
    "receiving_facility",
    "treatment_facility",
    "transfer_station",
    "facility",
    "destination_address"
  ]);
}

function getInvoiceServiceDescription(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  if (typeof doc.ai_summary === "string" && doc.ai_summary.trim()) return doc.ai_summary.trim();
  return getJsonText(payload, ["service_description", "line_items", "description", "services"]);
}

function getContractStartOrStatus(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  return getJsonText(payload, ["start_date", "contract_start_date", "contract_status", "status"]);
}

function isDraftOrUnsignedContract(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const text = `${doc.ai_summary ?? ""} ${JSON.stringify(payload)}`.toLowerCase();
  return /draft|unsigned|not signed|missing signature/.test(text);
}

function isLowQualityReadable(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const qualityText = `${doc.ai_summary ?? ""} ${doc.processing_error ?? ""} ${JSON.stringify(payload)}`.toLowerCase();
  const lowQuality = /low quality|faint|blurry|poor scan|hard to read|unreadable parts/.test(qualityText);
  if (!lowQuality) return false;
  if (doc.document_type !== "waste_transfer_note") return false;
  const required = [doc.extracted_date, getCarrierNameFromDoc(doc), getCarrierLicenceFromDoc(doc), getDestinationName(doc)];
  return required.every((v) => hasText(v ?? null));
}

function computeDocumentCompleteness(doc: ReportDocument) {
  const relevance = getDocumentRelevance(doc);
  if (!relevance.used_in_assessment) {
    return { applicable: false, ratio: 0 };
  }
  const docType = doc.document_type ?? "unknown";
  if (!(doc.processing_status === "processed" || doc.processing_status === "review")) {
    return { applicable: false, ratio: 0 };
  }

  const fields: Array<boolean> = [];
  if (docType === "carrier_licence") {
    fields.push(hasText(getCarrierNameFromDoc(doc)));
    fields.push(hasText(getCarrierLicenceFromDoc(doc)));
    fields.push(hasText(doc.expiry_date));
  } else if (docType === "waste_transfer_note") {
    fields.push(hasText(getProducerOrCustomerName(doc)));
    fields.push(hasText(getCarrierNameFromDoc(doc)));
    fields.push(hasText(getCarrierLicenceFromDoc(doc)));
    fields.push(hasText(doc.waste_type));
    fields.push(hasText(doc.extracted_ewc_code));
    fields.push(hasText(doc.extracted_date));
    fields.push(hasText(getDestinationName(doc)));
  } else if (docType === "invoice") {
    fields.push(hasText(getCarrierNameFromDoc(doc)));
    fields.push(hasText(getProducerOrCustomerName(doc)));
    fields.push(hasText(doc.extracted_date));
    fields.push(hasText(getInvoiceServiceDescription(doc)));
  } else if (docType === "contract" || docType === "food_waste_contract") {
    fields.push(hasText(getCarrierNameFromDoc(doc)));
    fields.push(hasText(getProducerOrCustomerName(doc)));
    fields.push(hasText(getInvoiceServiceDescription(doc)));
    fields.push(hasText(getContractStartOrStatus(doc)));
  } else if (docType === "hazardous_waste_note") {
    fields.push(hasText(getProducerOrCustomerName(doc)));
    fields.push(hasText(getCarrierNameFromDoc(doc)));
    fields.push(hasText(doc.extracted_date));
    fields.push(hasText(doc.waste_type));
    fields.push(hasText(doc.extracted_ewc_code));
  } else {
    return { applicable: false, ratio: 0 };
  }

  const present = fields.filter(Boolean).length;
  return { applicable: true, ratio: fields.length ? present / fields.length : 0 };
}

function computeRelevantExtractionCompleteness(docs: ReportDocument[]) {
  const metrics = docs.map(computeDocumentCompleteness).filter((m) => m.applicable);
  if (!metrics.length) return 0;
  return Math.max(0, Math.min(1, metrics.reduce((sum, item) => sum + item.ratio, 0) / metrics.length));
}

export function computeRelevantExtractionCompletenessForTest(docs: ReportDocument[]) {
  return computeRelevantExtractionCompleteness(docs);
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
  const carrierDocs = docs.filter(
    (d) => d.document_type === "carrier_licence" && (d.processing_status === "processed" || d.processing_status === "review") && hasValidCarrierLicenceFields(d)
  );
  const wtDocs = docs.filter((d) => d.document_type === "waste_transfer_note");
  const now = new Date();

  const evidenceNumbers = new Set(carrierDocs.map((d) => (getCarrierLicenceFromDoc(d) ?? "").trim().toLowerCase()).filter(Boolean));

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

  const hasValidMatchingWtnNow = wtnWithLicence.some((wtn) => {
    const key = (wtn.extracted_licence_number ?? "").trim().toLowerCase();
    if (!key) return false;
    return carrierDocs.some((lic) => {
      const licKey = (getCarrierLicenceFromDoc(lic) ?? "").trim().toLowerCase();
      const expiry = lic.expiry_date ? new Date(lic.expiry_date) : null;
      return licKey === key && expiry && !Number.isNaN(expiry.getTime()) && expiry >= now;
    });
  });

  const invalidAtTransferDocs = wtnWithLicence.filter((wtn) => {
    const wtnDate = wtn.extracted_date ? new Date(wtn.extracted_date) : null;
    if (!wtnDate || Number.isNaN(wtnDate.getTime())) return false;
    const key = (wtn.extracted_licence_number ?? "").trim().toLowerCase();
    const linked = carrierDocs.find((lic) => {
      const licKey = (getCarrierLicenceFromDoc(lic) ?? "").trim().toLowerCase();
      const expiry = lic.expiry_date ? new Date(lic.expiry_date) : null;
      return licKey === key && expiry && !Number.isNaN(expiry.getTime());
    });
    if (!linked?.expiry_date) return false;
    const exp = new Date(linked.expiry_date);
    return !Number.isNaN(exp.getTime()) && exp < wtnDate;
  });

  const validAtTransferButExpiredNowDocs = wtnWithLicence.filter((wtn) => {
    const wtnDate = wtn.extracted_date ? new Date(wtn.extracted_date) : null;
    if (!wtnDate || Number.isNaN(wtnDate.getTime())) return false;
    const key = (wtn.extracted_licence_number ?? "").trim().toLowerCase();
    const linked = carrierDocs.find((lic) => {
      const licKey = (getCarrierLicenceFromDoc(lic) ?? "").trim().toLowerCase();
      const expiry = lic.expiry_date ? new Date(lic.expiry_date) : null;
      return licKey === key && expiry && !Number.isNaN(expiry.getTime());
    });
    if (!linked?.expiry_date) return false;
    const exp = new Date(linked.expiry_date);
    return !Number.isNaN(exp.getTime()) && exp >= wtnDate && exp < now;
  });

  const hasInvalidAtTransfer = invalidAtTransferDocs.length > 0;
  const hasExpiredNowOnly = !hasInvalidAtTransfer && (validAtTransferButExpiredNowDocs.length > 0 || (!wtnWithLicence.length && hasExpiredNow && !hasValidNow));

  return {
    hasAnyCarrierEvidence,
    hasValidNow,
    hasExpiredNow,
    internallyInconsistent,
    wtnMismatch,
    hasValidMatchingWtnNow,
    hasMixedEvidence: hasValidNow && hasExpiredNow,
    hasInvalidAtTransfer,
    hasExpiredNowOnly
  };
}

const CHECK_SOURCE_FALLBACKS: Record<string, string> = {
  "Waste Transfer Note present": "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes",
  "Waste invoice or collection evidence present": "https://www.gov.uk/dispose-business-commercial-waste",
  "Carrier licence evidence present": "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers",
  "Carrier licence valid / not expired": "https://www.gov.uk/register-renew-waste-carrier-broker-dealer-england",
  "EWC code present on WTN where available": "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes",
  "Waste destination present on WTN where available": "https://www.gov.uk/government/publications/waste-duty-of-care-code-of-practice",
  "Supplier/contract evidence present": "https://www.gov.uk/dispose-business-commercial-waste",
  "Food waste evidence present": "https://www.gov.uk/guidance/simpler-recycling-workplace-recycling-in-england"
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

  const relevantDocs = docs.filter((doc) => getDocumentRelevance(doc).used_in_assessment);
  const hasAnyUploads = docs.length > 0;
  const noRelevantEvidence = hasAnyUploads && relevantDocs.length === 0;
  const processed = relevantDocs.filter(isProcessed);
  const wtDocs = processed.filter((d) => d.document_type === "waste_transfer_note");
  const carrierDocs = docs.filter(
    (d) => d.document_type === "carrier_licence" && (d.processing_status === "processed" || d.processing_status === "review") && hasValidCarrierLicenceFields(d)
  );
  const carrierResolution = getCarrierResolution(processed);
  const invoiceDocs = processed.filter((d) => d.document_type === "invoice");
  const contractDocs = processed.filter((d) => d.document_type === "contract");
  const strongContractDocs = contractDocs.filter((d) => !isDraftOrUnsignedContract(d));
  const draftOrUnsignedContractDocs = contractDocs.filter((d) => isDraftOrUnsignedContract(d));
  const supplierRelationshipEvidence = [...invoiceDocs, ...wtDocs].filter((d) => hasText(getCarrierNameFromDoc(d)));
  const hasSupplierRelationshipEvidence = supplierRelationshipEvidence.length > 0;
  const hazDocs = processed.filter((d) => d.document_type === "hazardous_waste_note");
  const failedDocs = relevantDocs.filter((d) => d.processing_status === "failed");

  const checks: BaselineCheck[] = [];

  checks.push({
    check_name: "Waste Transfer Note present",
    result: wtDocs.length ? "pass" : hasAnyUploads ? "fail" : "cannot_verify",
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
    result: carrierResolution.hasAnyCarrierEvidence ? "pass" : hasAnyUploads ? "fail" : "cannot_verify",
    evidence_used: carrierDocs.map((d) => d.file_name),
    affected_document: carrierDocs[0]?.file_name ?? null,
    recommended_action: carrierDocs.length ? "No immediate action." : "Upload carrier licence evidence.",
    source_reference: resolveSourceReference(
      "Carrier licence evidence present",
      findReference(rules, sources, ["waste carrier licence environment agency", "search waste carriers brokers"])
    )
  });

  if (carrierResolution.hasAnyCarrierEvidence) {
    checks.push({
      check_name: "Carrier licence valid / not expired",
      result:
        carrierResolution.hasInvalidAtTransfer
          ? "fail"
          : carrierResolution.hasExpiredNowOnly
            ? "attention_needed"
            : carrierResolution.hasValidMatchingWtnNow
          ? "pass"
          : carrierResolution.hasValidNow && !carrierResolution.wtnMismatch
            ? "pass"
            : carrierResolution.hasMixedEvidence
              ? "attention_needed"
              : "fail",
      evidence_used: carrierDocs.map((d) => `${d.file_name} (${d.expiry_date ?? "no expiry"})`),
      affected_document: carrierDocs[0]?.file_name ?? null,
      recommended_action:
        carrierResolution.hasInvalidAtTransfer
          ? "Carrier licence was not valid at the time of waste transfer."
          : carrierResolution.hasExpiredNowOnly
            ? "Carrier licence was valid at the time of transfer but has since expired. Updated evidence should be provided."
            : carrierResolution.hasValidMatchingWtnNow || (carrierResolution.hasValidNow && !carrierResolution.wtnMismatch)
          ? "No immediate action."
          : carrierResolution.hasMixedEvidence
            ? "A valid licence appears to be present, but older expired licence evidence was also uploaded. Review which document should be relied on."
              : "Replace or renew expired carrier licence evidence.",
      source_reference: resolveSourceReference(
        "Carrier licence valid / not expired",
        findReference(rules, sources, ["waste carrier licence environment agency", "public register waste carriers"])
      )
    });
  }

  checks.push({
    check_name: "Waste invoice or collection evidence present",
    result: invoiceDocs.length || wtDocs.length ? "pass" : hasAnyUploads ? "fail" : "cannot_verify",
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
    result: strongContractDocs.length || hasSupplierRelationshipEvidence ? "pass" : draftOrUnsignedContractDocs.length ? "attention_needed" : hasAnyUploads ? "fail" : "cannot_verify",
    evidence_used: strongContractDocs.length
      ? strongContractDocs.map((d) => d.file_name)
      : draftOrUnsignedContractDocs.length
        ? draftOrUnsignedContractDocs.map((d) => `${d.file_name} (draft/unsigned)`)
      : supplierRelationshipEvidence.map((d) => `${d.file_name} (${getCarrierNameFromDoc(d) ?? "supplier"})`),
    affected_document: strongContractDocs[0]?.file_name ?? draftOrUnsignedContractDocs[0]?.file_name ?? null,
    recommended_action: strongContractDocs.length || hasSupplierRelationshipEvidence ? "No immediate action." : "Upload supplier contract evidence.",
    source_reference: resolveSourceReference(
      "Supplier/contract evidence present",
      findReference(rules, sources, ["waste duty of care gov.uk", "dispose business commercial waste"])
    )
  });

  if (business.produces_food_waste) {
    const foodEvidence = processed.filter((d) => lower(`${d.waste_type} ${d.ai_summary}`).includes("food"));
    checks.push({
      check_name: "Food waste evidence present",
      result: foodEvidence.length ? "pass" : hasAnyUploads ? "fail" : "cannot_verify",
      evidence_used: foodEvidence.map((d) => d.file_name),
      affected_document: foodEvidence[0]?.file_name ?? null,
      recommended_action: foodEvidence.length ? "No immediate action." : "Upload food waste collection evidence.",
      source_reference: resolveSourceReference(
        "Food waste evidence present",
        findReference(rules, sources, ["food waste workplace recycling england gov.uk", "simpler recycling workplace recycling"])
      )
    });
  }

  if (business.produces_hazardous_waste) {
    checks.push({
      check_name: "Hazardous waste consignment note present",
      result: hazDocs.length ? "pass" : hasAnyUploads ? "fail" : "cannot_verify",
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

  if (wtDocs.length > 0) {
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
      result: hasDestinationCoverage ? "pass" : "attention_needed",
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
      result: wtnWithEwc.length ? "pass" : "attention_needed",
      evidence_used: wtnWithEwc.map((d) => d.file_name),
      affected_document: wtDocs[0]?.file_name ?? null,
      recommended_action: wtnWithEwc.length ? "No immediate action." : "Upload WTN copies that include EWC code details.",
      source_reference: resolveSourceReference(
        "EWC code present on WTN where available",
        findReference(rules, sources, ["ewc code waste transfer note", "waste transfer note guidance"])
      )
    });
  }

  if (failedDocs.length > 0 || noRelevantEvidence) {
    checks.push({
      check_name: "Document extraction reliability",
      result: "attention_needed",
      evidence_used: noRelevantEvidence ? docs.map((d) => d.file_name) : failedDocs.map((d) => d.file_name),
      affected_document: failedDocs[0]?.file_name ?? null,
      recommended_action: noRelevantEvidence ? "Upload waste compliance evidence documents (WTN, invoice, carrier licence)." : "Re-upload failed documents or upload clearer copies.",
      source_reference: "No source reference available for this specific check."
    });
  }

  return checks;
}

export function buildChecksForTest(params: { business: BusinessInfo; docs: ReportDocument[]; rules?: RuleRef[]; sources?: SourceRef[] }) {
  return buildChecks({
    business: params.business,
    docs: params.docs,
    rules: params.rules ?? [],
    sources: params.sources ?? []
  });
}

function scoreFromChecks(params: { checks: BaselineCheck[]; docs: ReportDocument[]; business: BusinessInfo }) {
  const { checks, docs, business } = params;
  let score = 100;
  const deductions: Array<{ reason: string; points: number }> = [];

  const byName = (name: string) => checks.find((c) => c.check_name === name);
  const processed = docs.filter(isProcessed);
  const supplierEvidenceFromOps = processed
    .filter((d) => d.document_type === "waste_transfer_note" || d.document_type === "invoice")
    .filter((d) => hasText(getCarrierNameFromDoc(d)));
  const irrelevantOnlyPack = docs.length > 0 && docs.every((d) => !getDocumentRelevance(d).used_in_assessment);

  if (byName("Waste Transfer Note present")?.result === "fail") deductions.push({ reason: "Missing waste transfer note", points: 35 });
  if (byName("Carrier licence valid / not expired")?.result === "fail") deductions.push({ reason: "Carrier licence not valid at transfer date", points: 28 });
  if (byName("Carrier licence valid / not expired")?.result === "attention_needed") deductions.push({ reason: "Carrier licence expired now (valid at transfer)", points: 8 });
  if (byName("Carrier licence evidence present")?.result === "fail") deductions.push({ reason: "Missing carrier licence evidence", points: 25 });
  if (business.produces_food_waste && byName("Food waste evidence present")?.result === "fail") deductions.push({ reason: "Missing food waste evidence", points: 25 });
  if (business.produces_hazardous_waste && byName("Hazardous waste consignment note present")?.result === "fail") deductions.push({ reason: "Missing hazardous waste consignment note", points: 30 });
  if (byName("Supplier/contract evidence present")?.result === "attention_needed" && supplierEvidenceFromOps.length === 0) {
    deductions.push({ reason: "Missing supplier contract evidence", points: 8 });
  }
  if (byName("Waste destination present on WTN where available")?.result === "attention_needed") deductions.push({ reason: "Missing destination detail on WTN", points: 8 });
  if (byName("EWC code present on WTN where available")?.result === "attention_needed") deductions.push({ reason: "Missing EWC code on WTN", points: 8 });
  if (irrelevantOnlyPack) deductions.push({ reason: "No relevant waste compliance evidence detected", points: 25 });

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

export function scoreFromChecksForTest(params: { checks: BaselineCheck[]; docs: ReportDocument[]; business: BusinessInfo }) {
  return scoreFromChecks(params);
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
    final_score: final,
    notes: base.notes ?? []
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
  const requiredFails = checks.filter((c) => ["Waste Transfer Note present", "Carrier licence evidence present", "Carrier licence valid / not expired", "Food waste evidence present", "Hazardous waste consignment note present"].includes(c.check_name) && c.result === "fail").length;
  const extractionCompleteness = computeRelevantExtractionCompleteness(docs);
  const duplicateCount = crossFindings.find((f) => f.key === "duplicate_documents")?.evidence.length ?? 0;
  const duplicateRatio = docs.length === 0 ? 0 : duplicateCount / docs.length;
  const irrelevantCount = docs.filter((d) => !getDocumentRelevance(d).used_in_assessment).length;
  const irrelevantRatio = docs.length === 0 ? 0 : irrelevantCount / docs.length;
  const hasMajorCarrierConflict = crossFindings.some((f) => f.key === "conflicting_waste_carriers" && f.severity === "high");
  const hasLicenceMismatch = crossFindings.some((f) => f.key === "licence_mismatch");
  const hasFutureDatedKey = crossFindings.some((f) => f.key === "future_dated_documents");
  const hasStaleWtn = crossFindings.some((f) => f.key === "stale_wtn");
  const lowQualityReadableCount = docs.filter((d) => isLowQualityReadable(d)).length;
  const majorCrossConflictCount = crossFindings.filter((f) => f.status === "fail").length;
  const sourceCoverage = checks.length
    ? checks.filter((c) => !c.source_reference.startsWith("No source reference available")).length / checks.length
    : 0;
  const baselinePassRate = checks.length ? checks.filter((c) => c.result === "pass").length / checks.length : 0;

  let level: 1 | 2 | 3 = 2; // 1 low, 2 medium, 3 high

  const hardLow =
    !docs.length ||
    requiredFails >= 2 ||
    failed >= Math.max(1, Math.ceil(docs.length * 0.5)) ||
    highOnly >= 2 ||
    majorCrossConflictCount >= 2 ||
    extractionCompleteness < 0.45 ||
    irrelevantRatio >= 1;

  if (hardLow) {
    level = 1;
  } else {
    const highConfidenceCandidate =
      missingDocs.length === 0 &&
      failed === 0 &&
      review === 0 &&
      highOrMedium === 0 &&
      requiredFails === 0 &&
      sourceCoverage >= 0.7 &&
      extractionCompleteness >= 0.7 &&
      baselinePassRate >= 0.95 &&
      duplicateRatio <= 0.2 &&
      majorCrossConflictCount === 0;

    level = highConfidenceCandidate ? 3 : 2;
  }

  if (hasMajorCarrierConflict || hasLicenceMismatch || hasFutureDatedKey || hasStaleWtn || duplicateRatio > 0.4 || irrelevantRatio > 0.6) {
    level = Math.max(1, level - 1) as 1 | 2 | 3;
  }
  if (lowQualityReadableCount > 0) {
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

function verdict(
  confidence: HealthCheckReport["confidence"],
  scoreStatus: HealthCheckReport["score"]["status"],
  missingCount: number,
  incompleteEvidence: boolean,
  maintenanceOnlyExpiredNow: boolean,
  hasHighSeverityRisk: boolean,
  perfectScoreNoRisks: boolean
) {
  if (perfectScoreNoRisks) {
    return "Based on the documents provided, compliance can be clearly demonstrated.";
  }
  if (scoreStatus === "compliant" && !hasHighSeverityRisk) {
    return "Based on the documents provided, compliance can be demonstrated.";
  }
  if (maintenanceOnlyExpiredNow) {
    return "Based on the documents provided, no major evidence gaps or consistency issues were detected. However, the carrier licence evidence has expired since the transfer date, so updated evidence should be provided for ongoing compliance.";
  }
  if (incompleteEvidence) {
    return "Core evidence is present, but some required documents are missing. Without these, compliance cannot be fully demonstrated.";
  }
  if (confidence.startsWith("Low")) {
    return "We could not fully verify compliance from the documents provided.";
  }

  if (scoreStatus === "compliant" && missingCount === 0) {
    return "Based on the documents provided, no major evidence gaps or consistency issues were detected. Keep these records available for inspection and update them when arrangements change.";
  }

  if (scoreStatus === "attention_needed") {
    return "Most core evidence was found, but some issues should be reviewed before relying on this pack.";
  }

  return "We could not fully verify compliance from the documents provided.";
}

function verdictForMixedBusinessPack() {
  return "We could not reliably assess this health check because the uploaded documents appear to contain records for multiple businesses or unrelated entities.";
}

function overallAssessment(params: {
  score: number;
  checks: BaselineCheck[];
  risks: ReportAlert[];
  docs: ReportDocument[];
  confidence: HealthCheckReport["confidence"];
  entityMismatchFail: boolean;
  crossConflicts: number;
  incompleteEvidence: boolean;
  maintenanceOnlyExpiredNow: boolean;
}) {
  if (params.entityMismatchFail) return "Documents appear to belong to multiple businesses";
  if (params.incompleteEvidence) return "Evidence pack incomplete";
  if (params.maintenanceOnlyExpiredNow) return "Evidence pack usable (updates recommended)";
  const highOrMediumRisks = params.risks.filter((risk) => risk.severity === "high" || risk.severity === "medium").length;
  const passRate = params.checks.length ? params.checks.filter((c) => c.result === "pass").length / params.checks.length : 0;
  const extractionCompleteness = computeRelevantExtractionCompleteness(params.docs);
  const coreFailures = params.checks.filter((c) =>
    ["Waste Transfer Note present", "Carrier licence evidence present", "Carrier licence valid / not expired"].includes(c.check_name) && c.result === "fail"
  ).length;

  if (
    params.score >= 80 &&
    passRate >= 0.9 &&
    highOrMediumRisks === 0 &&
    params.crossConflicts === 0 &&
    extractionCompleteness >= 0.7 &&
    coreFailures === 0
  ) {
    return "Evidence pack appears usable";
  }
  const coreEvidencePresent =
    params.checks.find((c) => c.check_name === "Waste Transfer Note present")?.result === "pass" &&
    params.checks.find((c) => c.check_name === "Carrier licence evidence present")?.result === "pass" &&
    params.checks.find((c) => c.check_name === "Waste invoice or collection evidence present")?.result === "pass";
  if (coreEvidencePresent && params.crossConflicts === 0 && highOrMediumRisks <= 1) {
    return "Evidence pack usable (minor issues identified)";
  }
  if (params.confidence.startsWith("Low")) return "Evidence pack cannot be reliably assessed";
  if (params.crossConflicts > 0) return "Evidence pack needs review";
  if (params.score >= 70 || passRate >= 0.75) return "Evidence pack needs review";
  return "Evidence pack cannot be reliably assessed";
}

function isIncompleteEvidencePack(params: {
  checks: BaselineCheck[];
  docs: ReportDocument[];
  crossConflicts: number;
  entityMismatchFail: boolean;
}) {
  const { checks, docs, crossConflicts, entityMismatchFail } = params;
  if (entityMismatchFail) return false;

  const checkByName = (name: string) => checks.find((c) => c.check_name === name);
  const criticalMissing = ["Waste Transfer Note present", "Carrier licence evidence present"].some(
    (name) => checkByName(name)?.result === "fail"
  );
  if (!criticalMissing) return false;

  const failedImportant = docs.filter(
    (d) =>
      d.processing_status === "failed" &&
      ["waste_transfer_note", "carrier_licence", "invoice", "contract", "hazardous_waste_note"].includes(d.document_type ?? "unknown")
  ).length;
  if (failedImportant > 0) return false;
  if (crossConflicts > 0) return false;

  const extractionCompleteness = computeRelevantExtractionCompleteness(docs);
  return extractionCompleteness >= 0.6;
}

export function isIncompleteEvidencePackForTest(params: {
  checks: BaselineCheck[];
  docs: ReportDocument[];
  crossConflicts: number;
  entityMismatchFail: boolean;
}) {
  return isIncompleteEvidencePack(params);
}

export function overallAssessmentForTest(params: {
  score: number;
  checks: BaselineCheck[];
  risks: ReportAlert[];
  docs: ReportDocument[];
  confidence: HealthCheckReport["confidence"];
  entityMismatchFail: boolean;
  crossConflicts: number;
  incompleteEvidence: boolean;
  maintenanceOnlyExpiredNow: boolean;
}) {
  return overallAssessment(params);
}

export function verdictForTest(
  confidence: HealthCheckReport["confidence"],
  scoreStatus: HealthCheckReport["score"]["status"],
  missingCount: number,
  incompleteEvidence: boolean,
  maintenanceOnlyExpiredNow: boolean,
  hasHighSeverityRisk: boolean,
  perfectScoreNoRisks: boolean
) {
  return verdict(confidence, scoreStatus, missingCount, incompleteEvidence, maintenanceOnlyExpiredNow, hasHighSeverityRisk, perfectScoreNoRisks);
}

function mixedBusinessPrimaryActions() {
  return [
    "Remove documents that do not belong to this business and rerun the health check.",
    "Keep only matching WTN, invoice, carrier licence and contract evidence for the business being checked.",
    "Re-upload clearer copies of any relevant documents that failed processing."
  ];
}

export function mixedBusinessPrimaryActionsForTest() {
  return mixedBusinessPrimaryActions();
}

function applyMixedBusinessRiskOverride(risks: ReportAlert[]) {
  const keyRiskPriority = ["multi_business_pack", "future_dated_documents", "stale_wtn"];
  const demoted = risks.map((risk) => {
    const isCarrierConflict = (risk.rule_id ?? "").toLowerCase() === "conflicting_waste_carriers";
    if (!isCarrierConflict) return risk;
    return {
      ...risk,
      severity: "low" as const,
      description: "Carrier inconsistencies were detected, but these may be caused by mixed-business documents."
    };
  });
  const prioritized = [
    ...demoted.filter((r) => (r.rule_id ?? "") === "multi_business_pack"),
    ...demoted.filter((r) => (r.rule_id ?? "") !== "multi_business_pack")
  ].filter((risk) => {
    const key = (risk.rule_id ?? "").toLowerCase();
    if (keyRiskPriority.includes(key)) return true;
    if (risk.title.toLowerCase().includes("processing") || risk.title.toLowerCase().includes("unreadable")) return true;
    return false;
  });
  return prioritized.slice(0, 4);
}

export function applyMixedBusinessRiskOverrideForTest(risks: ReportAlert[]) {
  return applyMixedBusinessRiskOverride(risks);
}

function mixedBusinessScoreReliabilityNote() {
  return "Low - document pack appears to contain multiple businesses";
}

export function mixedBusinessScoreReliabilityNoteForTest() {
  return mixedBusinessScoreReliabilityNote();
}

export function scoreReliabilityNoteForTest(mixedBusinessHighRisk: boolean) {
  return mixedBusinessHighRisk ? mixedBusinessScoreReliabilityNote() : null;
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

function severityRank(severity: ReportAlert["severity"]) {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function normalizedRiskKey(risk: ReportAlert) {
  const rule = (risk.rule_id ?? "").toLowerCase();
  const text = `${risk.title} ${risk.description ?? ""}`.toLowerCase();
  if (rule === "food_waste_missing" || rule === "food_waste_evidence_missing" || text.includes("food waste documentation missing")) {
    return "food_waste_evidence_missing";
  }
  return rule || risk.title.toLowerCase().trim();
}

function dedupeRisks(risks: ReportAlert[]) {
  const byKey = new Map<string, ReportAlert>();
  for (const risk of risks) {
    const key = normalizedRiskKey(risk);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...risk, rule_id: key === "food_waste_evidence_missing" ? key : risk.rule_id });
      continue;
    }
    const keepIncoming = severityRank(risk.severity) > severityRank(existing.severity);
    const base = keepIncoming ? risk : existing;
    const other = keepIncoming ? existing : risk;
    byKey.set(key, {
      ...base,
      rule_id: key === "food_waste_evidence_missing" ? key : base.rule_id,
      description: base.description ?? other.description ?? null
    });
  }
  return Array.from(byKey.values());
}

export function dedupeRisksForTest(risks: ReportAlert[]) {
  return dedupeRisks(risks);
}

function buildTopRisks(risks: ReportAlert[], mixedBusinessHighRisk: boolean) {
  return risks.filter(isBusinessRelevantRisk).slice(0, mixedBusinessHighRisk ? 4 : 5);
}

function countHighMediumRisks(risks: ReportAlert[]) {
  return risks.filter((risk) => risk.severity === "high" || risk.severity === "medium").length;
}

export function countHighMediumRisksForTest(risks: ReportAlert[]) {
  return countHighMediumRisks(risks);
}

function looksLikeHazardousEvidence(doc: ReportDocument) {
  const text = `${doc.file_name} ${doc.document_type ?? ""} ${doc.ai_summary ?? ""}`.toLowerCase();
  return /hazard|consignment|hwcn|ewc|dangerous waste/i.test(text);
}

function classifyNotUsedDocuments(docs: ReportDocument[], business: BusinessInfo): NotUsedClassification[] {
  const out: NotUsedClassification[] = [];
  for (const doc of docs) {
    const relevance = getDocumentRelevance(doc);
    const isUnknown = (doc.document_type ?? "unknown") === "unknown";
    const isFailed = doc.processing_status === "failed";
    const isReview = doc.processing_status === "review";
    if (relevance.relevance_status === "IRRELEVANT_NOT_USED") {
      out.push({
        file_name: doc.file_name,
        reason: "Unrelated to waste compliance",
        recommended_action: null,
        category: "unrelated"
      });
      continue;
    }
    if (relevance.relevance_status === "UNUSABLE") {
      out.push({
        file_name: doc.file_name,
        reason: "Unreadable / processing failed",
        recommended_action: `Re-upload ${doc.file_name} if it was intended to evidence waste compliance.`,
        category: "unreadable"
      });
      continue;
    }

    if (isFailed) {
      if (business.produces_hazardous_waste && looksLikeHazardousEvidence(doc)) {
        out.push({
          file_name: doc.file_name,
          reason: "Potentially relevant but unreadable",
          recommended_action: "Re-upload a clearer copy if hazardous waste applies to this business.",
          category: "potentially_relevant_unreadable"
        });
      } else {
        out.push({
          file_name: doc.file_name,
          reason: "Unreadable / processing failed",
          recommended_action: `Re-upload ${doc.file_name} if it was intended to evidence waste compliance.`,
          category: "unreadable"
        });
      }
      continue;
    }

    if (isUnknown) {
      const role = classifyUnknownDocumentRole(doc);
      if (role === "supporting" || role === "ambiguous") {
        continue;
      }
      const likelyWasteRelated = /waste|carrier|licen[cs]e|invoice|transfer|consignment|recycl/i.test(doc.file_name.toLowerCase());
      out.push({
        file_name: doc.file_name,
        reason: likelyWasteRelated ? "Unrelated to waste compliance" : "Unrelated to waste compliance",
        recommended_action: null,
        category: "unrelated"
      });
      continue;
    }

    if (isReview && isUnknown) {
      out.push({
        file_name: doc.file_name,
        reason: "Ambiguous document type",
        recommended_action: `Re-upload ${doc.file_name} if it was intended to evidence waste compliance.`,
        category: "ambiguous"
      });
    }
  }
  return out;
}

export function classifyNotUsedDocumentsForTest(
  docs: ReportDocument[],
  business: Pick<BusinessInfo, "produces_hazardous_waste">
) {
  return classifyNotUsedDocuments(docs, {
    id: "test",
    name: "test",
    business_type: "test",
    sites_count: 1,
    produces_food_waste: false,
    produces_hazardous_waste: business.produces_hazardous_waste
  });
}

function isCarrierExpiredRisk(alert: ReportAlert) {
  const text = `${alert.title} ${alert.description ?? ""}`.toLowerCase();
  return (
    text.includes("carrier licence expired") ||
    text.includes("carrier license expired") ||
    text.includes("carrier licence evidence expired") ||
    text.includes("licence may have been valid at transfer date") ||
    text.includes("valid at transfer but is expired now")
  );
}

export function isBusinessRelevantRiskForTest(alert: ReportAlert) {
  return isBusinessRelevantRisk(alert);
}

function buildConsistencySummary(
  docs: ReportDocument[],
  findings: ConsistencyFinding[],
  options?: { carriersDetected?: string[]; destinationsDetected?: string[] }
) {
  const assessableDocs = docs.filter((doc) => getDocumentRelevance(doc).used_in_assessment);
  const carriers =
    options?.carriersDetected ?? Array.from(new Set(assessableDocs.map((d) => d.extracted_supplier?.trim()).filter((v): v is string => !!v)));
  const licenceNumbers = Array.from(new Set(assessableDocs.map((d) => d.extracted_licence_number?.trim()).filter((v): v is string => !!v)));
  const sites = Array.from(
    new Set(
      assessableDocs
        .map((d) => {
          const payload = (d.ai_extracted_json ?? {}) as Record<string, unknown>;
          const candidates = [payload.destination_address, payload.address, payload.site, payload.destination_name, payload.destination];
          return candidates.find((c) => typeof c === "string" && c.trim()) as string | undefined;
        })
        .filter((v): v is string => !!v)
    )
  );
  const dated = assessableDocs.map((d) => d.extracted_date).filter((v): v is string => !!v).sort();
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
  const mixedBusinessHighRisk = entityValidation.finding?.status === "fail";
  const wtnMissing = checks.find((c) => c.check_name === "Waste Transfer Note present")?.result === "fail";
  const missingDocs: string[] = [];
  if (checks.find((c) => c.check_name === "Waste Transfer Note present")?.result === "fail") missingDocs.push("Waste transfer note");
  if (checks.find((c) => c.check_name === "Carrier licence evidence present")?.result === "fail") missingDocs.push("Carrier licence evidence");
  if (checks.find((c) => c.check_name === "Supplier/contract evidence present")?.result !== "pass") missingDocs.push("Supplier/contract evidence");
  if (business.produces_food_waste && checks.find((c) => c.check_name === "Food waste evidence present")?.result !== "pass") missingDocs.push("Food waste documentation");
  if (business.produces_hazardous_waste && checks.find((c) => c.check_name === "Hazardous waste consignment note present")?.result !== "pass") missingDocs.push("Hazardous waste consignment note");
  const dedupedMissingDocs = Array.from(new Set(missingDocs));

  const notUsedDocs = classifyNotUsedDocuments(docs, business);
  const supportingDocs = classifySupportingDocuments(docs);
  const usedDocs = docs.filter((doc) => getDocumentRelevance(doc).used_in_assessment);
  const cannotVerify = new Set<string>();
  if (!docs.length) cannotVerify.add("No documents uploaded for review.");
  if (docs.length > 0 && usedDocs.length === 0) {
    cannotVerify.add("No relevant waste compliance documents were detected in the upload.");
  }
  const reviewCount = docs.filter((d) => d.processing_status === "review").length;
  if (reviewCount > 0)
    cannotVerify.add(
      `${reviewCount} ${pluralize(reviewCount, "document could", "documents could")} not be fully interpreted.`
    );
  const unsupportedCount = notUsedDocs.filter((d) => d.category === "unrelated" || d.category === "ambiguous").length;
  if (unsupportedCount > 0)
    cannotVerify.add(
      `${unsupportedCount} unsupported ${pluralize(unsupportedCount, "file was", "files were")} excluded from the assessment.`
    );
  const failedCount = notUsedDocs.filter((d) => d.category === "unreadable" || d.category === "potentially_relevant_unreadable").length;
  if (failedCount > 0)
    cannotVerify.add(
      `${failedCount} ${pluralize(failedCount, "document failed", "documents failed")} processing and should be re-uploaded if relevant.`
    );
  checks.filter((c) => c.result === "cannot_verify").forEach((c) => cannotVerify.add(`${c.check_name}: cannot verify with current evidence.`));
  if (checks.some((c) => c.source_reference.startsWith("No source reference available"))) {
    cannotVerify.add("Some checks could not be linked to an official source reference.");
  }
  if (entityValidation.finding?.status === "fail") {
    cannotVerify.add("The uploaded pack appears to mix multiple business entities, so a single-business assessment is unreliable.");
  }
  cross.cannot_verify_items.forEach((item) => cannotVerify.add(item));
  if (wtnMissing) {
    cannotVerify.delete("Waste destination present on WTN where available: cannot verify with current evidence.");
    cannotVerify.delete("EWC code present on WTN where available: cannot verify with current evidence.");
  }

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
  const normalizedCrossActions = cross.recommended_actions.map((action) => {
    if (/carrier licence|carrier license/i.test(action) && /ongoing|current|valid/i.test(action)) {
      return "Upload current carrier licence evidence for ongoing compliance.";
    }
    return action;
  });
  for (const action of normalizedCrossActions) {
    if (!recommendedActions.includes(action)) recommendedActions.push(action);
  }
  for (const item of notUsedDocs) {
    if (item.recommended_action && !recommendedActions.includes(item.recommended_action)) {
      recommendedActions.push(item.recommended_action);
    }
  }
  if (entityValidation.finding?.recommended_action && !recommendedActions.includes(entityValidation.finding.recommended_action)) {
    recommendedActions.unshift(entityValidation.finding.recommended_action);
  }
  const businessActionsOnly = recommendedActions.filter(
    (action) => !/missing_fields|ewc_code_or_licence_number|document_type|no action required|no immediate action/i.test(action.toLowerCase())
  );
  const foodWasteMissing = business.produces_food_waste && checks.find((c) => c.check_name === "Food waste evidence present")?.result === "fail";
  const refinedBusinessActions = wtnMissing
    ? businessActionsOnly.filter((action) => /waste transfer note/i.test(action))
    : foodWasteMissing
      ? businessActionsOnly.filter((action) => /food waste/i.test(action) || /contract documentation/i.test(action))
    : businessActionsOnly;
  const uniqueRefinedActions = Array.from(new Set(refinedBusinessActions));
  const finalActions = mixedBusinessHighRisk
    ? mixedBusinessPrimaryActions()
    : uniqueRefinedActions;
  const finalActionsWithRelevanceFallback =
    docs.length > 0 && usedDocs.length === 0
      ? [
          "Upload waste compliance documents such as WTNs, invoices, carrier licence, or food waste records.",
          ...finalActions
        ]
      : finalActions;

  const baseScore = scoreFromChecks({ checks, docs, business });
  const mergedBreakdown = mergeDeductions(
    baseScore.breakdown,
    [...cross.score_deductions, ...(entityValidation.finding ? [{ reason: entityValidation.finding.title, points: entityValidation.finding.points }] : [])]
  );
  let mergedScore = mergedBreakdown.final_score;
  if (mixedBusinessHighRisk) {
    mergedScore = Math.min(mergedScore, 49);
    mergedBreakdown.notes = Array.from(new Set([...(mergedBreakdown.notes ?? []), "Score capped because documents may belong to multiple businesses."]));
  }
  const score = {
    score: mergedScore,
    status: mergedScore >= 80 ? "compliant" : mergedScore >= 50 ? "attention_needed" : "at_risk",
    breakdown: mergedBreakdown
  } as const;
  const maintenanceCarrierKey = "carrier_licence_valid_at_transfer_expired_now";
  const nonMaintenanceConsistencyFindings = cross.consistency_findings.filter((f) => f.key !== maintenanceCarrierKey);
  const crossConflicts = nonMaintenanceConsistencyFindings.filter((f) => f.status === "fail" || f.status === "attention_needed").length;
  const incompleteEvidence = isIncompleteEvidencePack({
    checks,
    docs,
    crossConflicts,
    entityMismatchFail: entityValidation.finding?.status === "fail"
  });
  const extractionCompleteness = computeRelevantExtractionCompleteness(docs);
  const confidence = confidenceFromSignals({
    checks,
    docs,
    alerts: [...openAlerts, ...cross.business_level_risks],
    missingDocs: dedupedMissingDocs,
    cannotVerifyCount: cannotVerify.size + cross.confidence_adjustments.length,
    crossFindings: nonMaintenanceConsistencyFindings
  });

  const carrierCheck = checks.find((c) => c.check_name === "Carrier licence valid / not expired");
  let businessRisks = [...openAlerts, ...cross.business_level_risks].filter((risk) => {
    const ruleKey = (risk.rule_id ?? "").toLowerCase();
    const removeLegacyCarrierTiming =
      isCarrierExpiredRisk(risk) ||
      ruleKey === "carrier_licence_expired_only" ||
      ruleKey === "licence_expired_before_transfer" ||
      ruleKey === "licence_valid_at_transfer_expired_now" ||
      ruleKey === "carrier_licence_timing_invalid_at_transfer" ||
      ruleKey === "carrier_licence_timing_expired_now" ||
      ruleKey === "carrier_licence_valid_at_transfer_expired_now";
    if (removeLegacyCarrierTiming) {
      return false;
    }
    return true;
  });
  if (carrierCheck?.result === "fail") {
    businessRisks.unshift({
      id: "carrier-timing-risk-fail",
      title: "Carrier licence was not valid at the time of waste transfer",
      description: "Carrier licence was not valid at the time of waste transfer.",
      severity: "high",
      status: "open",
      rule_id: "carrier_licence_timing_invalid_at_transfer",
      document_id: null
    });
  } else if (carrierCheck?.result === "attention_needed") {
    businessRisks.unshift({
      id: "carrier-timing-risk-attention",
      title: "Carrier licence valid at transfer but expired now",
      description: "Carrier licence was valid at the time of transfer but has since expired. Updated evidence should be provided.",
      severity: "medium",
      status: "open",
      rule_id: "carrier_licence_valid_at_transfer_expired_now",
      document_id: null
    });
  }
  if (foodWasteMissing) {
    businessRisks.unshift({
      id: "food-waste-missing",
      title: "Food waste documentation missing",
      description: "Based on the business profile, food waste evidence was expected but not found in the uploaded documents.",
      severity: "high",
      status: "open",
      rule_id: "food_waste_missing",
      document_id: null
    });
  }
  if (mixedBusinessHighRisk) {
    businessRisks = applyMixedBusinessRiskOverride(businessRisks);
  }
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
  businessRisks = dedupeRisks(businessRisks);
  const topRisks = buildTopRisks(businessRisks, mixedBusinessHighRisk);
  const hasOnlyExpiredNowMaintenanceIssue =
    score.score >= 90 &&
    score.status === "compliant" &&
    !mixedBusinessHighRisk &&
    extractionCompleteness >= 0.8 &&
    checks.filter((c) => c.result === "pass").length >= checks.length - 1 &&
    topRisks.filter((r) => r.severity === "high").length === 0 &&
    topRisks.filter((r) => r.severity === "medium").length <= 1 &&
    businessRisks.some((r) => (r.rule_id ?? "") === maintenanceCarrierKey) &&
    crossConflicts === 0;
  const finalConfidence = mixedBusinessHighRisk
    ? "Low Confidence / Cannot Fully Verify"
    : hasOnlyExpiredNowMaintenanceIssue
      ? "High Confidence"
      : incompleteEvidence
        ? "Medium Confidence"
        : confidence;

  const confidenceContributors = [
    `Baseline evidence checks: ${checks.filter((c) => c.result === "pass").length}/${checks.length} passed`,
    `Extraction completeness: ${Math.round(extractionCompleteness * 100)}%`,
    `Business-level risks (high/medium): ${countHighMediumRisks(topRisks)}`,
    `Cross-document ${pluralize(nonMaintenanceConsistencyFindings.length, "finding", "findings")}: ${nonMaintenanceConsistencyFindings.length}`,
    `Irrelevant/unknown docs: ${docs.filter((d) => !getDocumentRelevance(d).used_in_assessment).length}/${docs.length}`,
    `Duplicate docs flagged: ${nonMaintenanceConsistencyFindings.find((f) => f.key === "duplicate_documents")?.evidence.length ?? 0}`,
    `Source coverage: ${checks.filter((c) => !c.source_reference.startsWith("No source reference available")).length}/${checks.length}`
  ];
  if (entityValidation.finding) {
    confidenceContributors.push(
      `Entity match ratio: ${Math.round(entityValidation.match_ratio * 100)}% (${entityValidation.producer_names.length} producer/customer ${pluralize(entityValidation.producer_names.length, "name", "names")} detected)`
    );
  }
  if (score.score === 100 && finalConfidence !== "High Confidence") {
    const confidenceReasons: string[] = [];
    if (docs.some((d) => isLowQualityReadable(d))) confidenceReasons.push("low-quality scanned primary evidence");
    if (docs.some((d) => d.document_type === "contract" && isDraftOrUnsignedContract(d))) confidenceReasons.push("draft/unsigned contract document");
    if (docs.some((d) => d.processing_status === "review")) confidenceReasons.push("partially unreadable or incomplete primary extraction");
    if (confidenceReasons.length > 0) {
      confidenceContributors.push(`Confidence is slightly reduced due to: ${confidenceReasons.join("; ")}`);
    }
  }

  const informationalFindings = cross.consistency_findings.filter((f) =>
    ["duplicate_documents", "irrelevant_documents", "historic_expired_licence_uploaded", maintenanceCarrierKey].includes(f.key)
  );
  const assessment = overallAssessment({
    score: score.score,
    checks,
    risks: businessRisks,
    docs,
    confidence: finalConfidence,
    entityMismatchFail: entityValidation.finding?.status === "fail",
    crossConflicts,
    incompleteEvidence,
    maintenanceOnlyExpiredNow: hasOnlyExpiredNowMaintenanceIssue
  });
  const pack04StyleFoodWasteIncomplete =
    !mixedBusinessHighRisk &&
    foodWasteMissing &&
    !wtnMissing &&
    checks.find((c) => c.check_name === "Carrier licence evidence present")?.result === "pass" &&
    checks.find((c) => c.check_name === "Carrier licence valid / not expired")?.result !== "fail" &&
    crossConflicts === 0 &&
    extractionCompleteness >= 0.8;
  const statusReasons = [
    `Baseline evidence checks: ${checks.filter((c) => c.result === "pass").length}/${checks.length} passed`,
    crossConflicts > 0
      ? `${crossConflicts} cross-document consistency ${pluralize(crossConflicts, "issue", "issues")} found`
      : pack04StyleFoodWasteIncomplete
        ? "No major document conflicts detected, but expected food waste evidence was not found."
        : "No major cross-document consistency conflicts detected",
    (nonMaintenanceConsistencyFindings.some((f) => f.key.includes("licence")) || nonMaintenanceConsistencyFindings.some((f) => f.key.includes("future") || f.key.includes("stale")))
      ? "Date/licence evidence requires review"
      : "No major date/licence conflicts detected",
    docs.filter((d) => !getDocumentRelevance(d).used_in_assessment).length > 0
      ? `${docs.filter((d) => !getDocumentRelevance(d).used_in_assessment).length} unsupported ${pluralize(
          docs.filter((d) => !getDocumentRelevance(d).used_in_assessment).length,
          "file was",
          "files were"
        )} excluded`
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
    score_reliability_note: mixedBusinessHighRisk ? mixedBusinessScoreReliabilityNote() : null,
    confidence: pack04StyleFoodWasteIncomplete && finalConfidence !== "Low Confidence / Cannot Fully Verify" ? "High Confidence" : finalConfidence,
    plain_english_verdict:
      mixedBusinessHighRisk
        ? verdictForMixedBusinessPack()
        : pack04StyleFoodWasteIncomplete
          ? "Core waste evidence is present and internally consistent, but food waste evidence was expected based on the business profile and was not found. Upload food waste collection evidence or contract documentation before relying on this pack."
          : verdict(
              finalConfidence,
              score.status,
              dedupedMissingDocs.length,
              incompleteEvidence,
              hasOnlyExpiredNowMaintenanceIssue,
              businessRisks.some((r) => r.severity === "high"),
              score.score === 100 && businessRisks.length === 0
            ),
    top_risks: topRisks,
    missing_documents: dedupedMissingDocs,
    compliance_checks: checks,
    documents: docs,
    references: refs,
    cannot_verify: Array.from(cannotVerify),
    recommended_actions: hasOnlyExpiredNowMaintenanceIssue
      ? ["Upload current carrier licence evidence for ongoing compliance."]
      : pack04StyleFoodWasteIncomplete
        ? ["Upload food waste collection evidence or contract documentation."]
      : Array.from(new Set(finalActionsWithRelevanceFallback)),
    consistency_findings: nonMaintenanceConsistencyFindings,
    confidence_contributors: confidenceContributors,
    documents_not_used: notUsedDocs.map((d) => ({ file_name: d.file_name, reason: d.reason })),
    additional_supporting_documents: supportingDocs,
    consistency_summary: buildConsistencySummary(docs, nonMaintenanceConsistencyFindings, {
      carriersDetected: entityValidation.carrier_names,
      destinationsDetected: [...entityValidation.destination_names, ...entityValidation.site_address_names]
    }),
    entity_matching: {
      onboarded_business_name: business.name,
      detected_customer_or_producer_names: entityValidation.producer_names,
      detected_carrier_or_supplier_names: entityValidation.carrier_names,
      detected_destination_or_facility_names: entityValidation.destination_names,
      detected_site_address_names: entityValidation.site_address_names,
      unclear_entity_names: entityValidation.unclear_entity_names,
      unmatched_business_names: entityValidation.unmatched_producer_names
    },
    overall_assessment: pack04StyleFoodWasteIncomplete ? "Evidence pack incomplete (food waste evidence missing)" : assessment,
    status_reasons: statusReasons,
    informational_findings: informationalFindings
  };
}
