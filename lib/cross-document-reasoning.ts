import type { ReportDocument, ReportAlert } from "@/lib/health-check-report";
import { buildCanonicalCarrierSupplierNames, carrierEntitiesForDocument } from "@/lib/entity-pack-validation";

type BusinessInfo = {
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
};

export type ConsistencyFinding = {
  key: string;
  title: string;
  severity: "low" | "medium" | "high";
  status: "info" | "attention_needed" | "fail";
  message: string;
  evidence: string[];
  recommended_action: string;
  points: number;
  affects_confidence: boolean;
  cannot_verify?: string;
};

export type CrossDocumentReasoningResult = {
  consistency_findings: ConsistencyFinding[];
  business_level_risks: ReportAlert[];
  score_deductions: Array<{ reason: string; points: number }>;
  confidence_adjustments: string[];
  recommended_actions: string[];
  cannot_verify_items: string[];
};

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\blimited\b/g, "ltd")
    .replace(/\bltd\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDestination(doc: ReportDocument) {
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
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function parseDate(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getCarrierLicenceNumber(doc: ReportDocument) {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const candidates = [doc.extracted_licence_number, payload.licence_number, payload.carrier_licence_number, payload.registration_number];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isComplianceDoc(doc: ReportDocument) {
  return ["waste_transfer_note", "invoice", "carrier_licence", "contract", "hazardous_waste_note", "recycling_report"].includes(doc.document_type ?? "");
}

export function runCrossDocumentReasoning(params: {
  documents: ReportDocument[];
  openAlerts: ReportAlert[];
  business: BusinessInfo;
}): CrossDocumentReasoningResult {
  const now = new Date();
  const processedDocs = params.documents.filter((d) => d.processing_status === "processed");
  const findings: ConsistencyFinding[] = [];
  const carrierLicenceDocs = processedDocs.filter((d) => d.document_type === "carrier_licence");
  const hasValidLicenceNow = carrierLicenceDocs.some((d) => {
    const expiry = parseDate(d.expiry_date);
    return !!expiry && expiry >= now;
  });
  const hasExpiredLicenceNow = carrierLicenceDocs.some((d) => {
    const expiry = parseDate(d.expiry_date);
    return !!expiry && expiry < now;
  });

  const canonicalCarrierRows = buildCanonicalCarrierSupplierNames(processedDocs).rows;
  const byId = new Map(processedDocs.map((doc) => [doc.id, doc]));
  const carrierDocs = canonicalCarrierRows
    .map((row) => ({
      doc: byId.get(row.document_id),
      carrier: row.carrier_name
    }))
    .filter((row): row is { doc: ReportDocument; carrier: string } => Boolean(row.doc && normalizeName(row.carrier)));

  const carriers = new Map<string, Array<{ doc: ReportDocument; carrier: string }>>();
  for (const row of carrierDocs) {
    const key = normalizeName(row.carrier);
    const arr = carriers.get(key) ?? [];
    arr.push(row);
    carriers.set(key, arr);
  }

  if (carriers.size > 1) {
    const wtns = carrierDocs.filter((d) => d.doc.document_type === "waste_transfer_note" && d.doc.extracted_date);
    const invoices = carrierDocs.filter((d) => d.doc.document_type === "invoice" && d.doc.extracted_date);
    let sameDateConflict = false;
    for (const wtn of wtns) {
      for (const invoice of invoices) {
        const sameDate = wtn.doc.extracted_date === invoice.doc.extracted_date;
        const wtnDestination = normalizeName(getDestination(wtn.doc));
        const invDestination = normalizeName(getDestination(invoice.doc));
        const sameSiteHint = wtnDestination && invDestination ? wtnDestination === invDestination : true;
        if (sameDate && sameSiteHint && normalizeName(wtn.carrier) !== normalizeName(invoice.carrier)) {
          sameDateConflict = true;
        }
      }
    }

    const evidence = carrierDocs.slice(0, 8).map((d) => `${d.doc.file_name} -> ${d.carrier}`);
    findings.push({
      key: "conflicting_waste_carriers",
      title: "Conflicting waste carriers detected",
      severity: sameDateConflict ? "high" : "medium",
      status: sameDateConflict ? "fail" : "attention_needed",
      message: sameDateConflict
        ? "Different carrier names were found for the same waste movement window (same date/site). This may make it harder to evidence a consistent waste disposal chain."
        : "Multiple waste providers were detected. This may be normal for multi-site or multi-stream operations.",
      evidence,
      recommended_action:
        "Confirm which carrier handled each waste transfer and upload matching WTN, invoice, licence and contract evidence.",
      points: sameDateConflict ? 12 : 6,
      affects_confidence: true
    });
  }

  const unclearEntityEvidence = processedDocs
    .filter((d) => ["waste_transfer_note", "invoice", "contract"].includes(d.document_type ?? ""))
    .flatMap((d) => {
      const explicitCarriers = carrierEntitiesForDocument(d).map((row) => row.carrier_name);
      const payload = (d.ai_extracted_json ?? {}) as Record<string, unknown>;
      const hasProducerHint =
        typeof payload.producer_name === "string" ||
        typeof payload.customer_name === "string" ||
        typeof payload.client_name === "string" ||
        typeof payload.current_holder === "string" ||
        typeof payload.transferor === "string";
      const hasAmbiguousBusiness = typeof payload.business_name === "string" || typeof payload.company_name === "string" || typeof payload.entity_name === "string";
      if (explicitCarriers.length === 0 && (hasProducerHint || hasAmbiguousBusiness)) {
        return [`${d.file_name} -> unclear carrier/supplier role`];
      }
      return [];
    });
  if (unclearEntityEvidence.length) {
    findings.push({
      key: "unclear_entities",
      title: "Some entity roles were unclear",
      severity: "low",
      status: "attention_needed",
      message: "Some documents did not provide clear role labels to separate customer/producer from carrier/supplier.",
      evidence: unclearEntityEvidence.slice(0, 10),
      recommended_action: "Where possible, upload clearer copies showing labelled producer, carrier, and destination fields.",
      points: 0,
      affects_confidence: true,
      cannot_verify: "Some entity roles were unclear in uploaded documents."
    });
  }

  const wtnLicenceDocs = processedDocs.filter((d) => d.document_type === "waste_transfer_note" && (getCarrierLicenceNumber(d) ?? "").trim());
  const licenceEvidence = new Set(
    processedDocs
      .filter((d) => d.document_type === "carrier_licence" && (getCarrierLicenceNumber(d) ?? "").trim())
      .map((d) => (getCarrierLicenceNumber(d) ?? "").trim().toLowerCase())
  );

  const mismatchedLicences = wtnLicenceDocs.filter((d) => !licenceEvidence.has((getCarrierLicenceNumber(d) ?? "").trim().toLowerCase()));
  if (mismatchedLicences.length) {
    findings.push({
      key: "licence_mismatch",
      title: "Carrier licence evidence does not match WTN licence number",
      severity: "medium",
      status: "attention_needed",
      message: "A licence number on one or more WTNs could not be matched to uploaded carrier licence evidence.",
      evidence: mismatchedLicences.map((d) => `${d.file_name} -> ${(getCarrierLicenceNumber(d) ?? "Unknown").trim()}`),
      recommended_action: "Upload carrier licence evidence matching each WTN licence number.",
      points: 15,
      affects_confidence: true
    });
  }

  if (carrierLicenceDocs.length > 0 && hasValidLicenceNow && hasExpiredLicenceNow) {
    findings.push({
      key: "historic_expired_licence_uploaded",
      title: "Historic expired licence evidence also uploaded",
      severity: "medium",
      status: "attention_needed",
      message:
        "A valid licence appears to be present, but older expired evidence was also uploaded. Review which document should be relied on.",
      evidence: carrierLicenceDocs
        .filter((d) => d.expiry_date)
        .map((d) => `${d.file_name} -> ${d.expiry_date}`),
      recommended_action: "Review licence files and keep the current valid evidence clearly identifiable.",
      points: 0,
      affects_confidence: false
    });
  }

  // Consolidated timing-based licence risk is created below to avoid duplicate findings.

  const futureDated = processedDocs.filter(
    (d) => ["waste_transfer_note", "invoice"].includes(d.document_type ?? "") && parseDate(d.extracted_date) && (parseDate(d.extracted_date) as Date) > now
  );
  if (futureDated.length) {
    findings.push({
      key: "future_dated_documents",
      title: "Future-dated waste documents detected",
      severity: "medium",
      status: "attention_needed",
      message: "Some waste document dates are in the future and should be verified.",
      evidence: futureDated.map((d) => `${d.file_name} -> ${d.extracted_date}`),
      recommended_action: "Verify document dates and replace incorrect files.",
      points: 6,
      affects_confidence: true
    });
  }

  const carrierLicences = processedDocs.filter((d) => d.document_type === "carrier_licence");
  const expiredBeforeWtn = wtnLicenceDocs.filter((wtn) => {
    const wtnDate = parseDate(wtn.extracted_date);
    if (!wtnDate) return false;
    const linked = carrierLicences.find(
      (c) => (getCarrierLicenceNumber(c) ?? "").trim().toLowerCase() === (getCarrierLicenceNumber(wtn) ?? "").trim().toLowerCase()
    );
    if (!linked) return false;
    const exp = parseDate(linked.expiry_date);
    return !!exp && exp < wtnDate;
  });
  const validAtTransferButExpiredNow = wtnLicenceDocs.filter((wtn) => {
    const wtnDate = parseDate(wtn.extracted_date);
    if (!wtnDate) return false;
    const linked = carrierLicences.find(
      (c) => (getCarrierLicenceNumber(c) ?? "").trim().toLowerCase() === (getCarrierLicenceNumber(wtn) ?? "").trim().toLowerCase()
    );
    if (!linked) return false;
    const exp = parseDate(linked.expiry_date);
    return !!exp && exp >= wtnDate && exp < now;
  });
  const hasTransferLinkedWtn = wtnLicenceDocs.length > 0;
  const hasInvalidAtTransfer = expiredBeforeWtn.length > 0;
  const hasExpiredNowOnly = !hasInvalidAtTransfer && hasTransferLinkedWtn && validAtTransferButExpiredNow.length > 0;
  const hasOnlyExpiredNoWtnContext = !hasTransferLinkedWtn && !hasValidLicenceNow && hasExpiredLicenceNow && carrierLicenceDocs.length > 0;

  if (hasInvalidAtTransfer) {
    findings.push({
      key: "carrier_licence_timing_invalid_at_transfer",
      title: "Carrier licence was not valid at the time of waste transfer",
      severity: "high",
      status: "fail",
      message: "Carrier licence was not valid at the time of waste transfer.",
      evidence: expiredBeforeWtn.map((d) => `${d.file_name} -> ${d.extracted_date}`),
      recommended_action: "Upload licence evidence that was valid on each transfer date.",
      points: 12,
      affects_confidence: true
    });
  } else if (hasExpiredNowOnly || hasOnlyExpiredNoWtnContext) {
    findings.push({
      key: "carrier_licence_timing_expired_now",
      title: "Carrier licence valid at transfer but expired now",
      severity: "medium",
      status: "attention_needed",
      message: "Carrier licence was valid at the time of transfer but has since expired. Updated evidence should be provided.",
      evidence: hasExpiredNowOnly
        ? validAtTransferButExpiredNow.map((d) => `${d.file_name} -> ${d.extracted_date}`)
        : carrierLicenceDocs.filter((d) => d.expiry_date).map((d) => `${d.file_name} -> ${d.expiry_date}`),
      recommended_action: "Upload current carrier licence evidence for ongoing compliance.",
      points: 0,
      affects_confidence: true
    });
  }

  const inconsistentLicenceState = processedDocs.filter((d) => d.document_type === "carrier_licence").filter((d) => {
    const expiry = parseDate(d.expiry_date);
    const activeText = `${d.ai_summary ?? ""} ${(d.ai_extracted_json ? JSON.stringify(d.ai_extracted_json) : "")}`;
    return !!expiry && expiry < now && /status\\s*:?\\s*active|\\bactive\\b/i.test(activeText);
  });
  if (inconsistentLicenceState.length) {
    findings.push({
      key: "licence_internal_inconsistency",
      title: "Licence evidence appears internally inconsistent",
      severity: "medium",
      status: "attention_needed",
      message: "The document states active but the expiry date has passed.",
      evidence: inconsistentLicenceState.map((d) => `${d.file_name} -> ${d.expiry_date ?? "unknown expiry"}`),
      recommended_action: "Upload replacement licence evidence with clear current validity.",
      points: 10,
      affects_confidence: true
    });
  }

  const staleWtn = processedDocs.filter((d) => d.document_type === "waste_transfer_note" && parseDate(d.extracted_date) && now.getTime() - (parseDate(d.extracted_date) as Date).getTime() > 365 * 24 * 60 * 60 * 1000);
  if (staleWtn.length) {
    findings.push({
      key: "stale_wtn",
      title: "WTN evidence appears stale",
      severity: "medium",
      status: "attention_needed",
      message: "Some waste transfer notes are older than 12 months and may not evidence current arrangements.",
      evidence: staleWtn.map((d) => `${d.file_name} -> ${d.extracted_date}`),
      recommended_action: "Upload more recent waste transfer evidence for current operations.",
      points: 6,
      affects_confidence: true
    });
  }

  const duplicateKeys = new Map<string, ReportDocument[]>();
  for (const doc of processedDocs.filter((d) => d.document_type === "waste_transfer_note")) {
    const key = [
      doc.document_type,
      doc.extracted_date ?? "",
      normalizeName(doc.extracted_supplier),
      doc.extracted_ewc_code ?? "",
      normalizeName(getDestination(doc))
    ].join("|");
    const arr = duplicateKeys.get(key) ?? [];
    arr.push(doc);
    duplicateKeys.set(key, arr);
  }

  const duplicateGroups = Array.from(duplicateKeys.values()).filter((group) => group.length > 1);
  if (duplicateGroups.length) {
    findings.push({
      key: "duplicate_documents",
      title: "Duplicate document detected",
      severity: "low",
      status: "info",
      message: "Likely duplicate documents were detected and are not counted as additional evidence.",
      evidence: duplicateGroups.flatMap((g) => g.map((d) => d.file_name)),
      recommended_action: "No action required unless duplicates were uploaded in error.",
      points: 0,
      affects_confidence: false
    });
  }

  const irrelevantDocs = params.documents.filter((d) => d.document_type === "unknown");
  if (irrelevantDocs.length) {
    findings.push({
      key: "irrelevant_documents",
      title: "Irrelevant or unsupported document",
      severity: "low",
      status: "info",
      message: "Some uploaded files do not appear to be waste compliance evidence.",
      evidence: irrelevantDocs.map((d) => d.file_name),
      recommended_action: "No action required unless this document was intended to evidence waste compliance.",
      points: 0,
      affects_confidence: false,
      cannot_verify: "Some uploaded files were irrelevant or unsupported for compliance evidence."
    });
  }

  const businessLevelRisks: ReportAlert[] = findings
    .filter((f) => f.status !== "info")
    .map((f, idx) => ({
      id: `cross-${idx}-${f.key}`,
      title: f.title,
      description: f.message,
      severity: f.severity,
      status: "open",
      rule_id: f.key,
      document_id: null
    }));

  const recommendedActions = Array.from(new Set(findings.map((f) => f.recommended_action)));
  const scoreDeductions = findings.filter((f) => f.points > 0).map((f) => ({ reason: f.title, points: f.points }));
  const confidenceAdjustments = findings.filter((f) => f.affects_confidence).map((f) => f.title);
  const cannotVerifyItems = Array.from(new Set(findings.map((f) => f.cannot_verify).filter((x): x is string => !!x)));

  return {
    consistency_findings: findings,
    business_level_risks: businessLevelRisks,
    score_deductions: scoreDeductions,
    confidence_adjustments: confidenceAdjustments,
    recommended_actions: recommendedActions,
    cannot_verify_items: cannotVerifyItems
  };
}
