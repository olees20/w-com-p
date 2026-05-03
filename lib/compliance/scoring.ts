export type ComplianceStatus = "compliant" | "attention_needed" | "at_risk";

export type BusinessProfileForScore = {
  id: string;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
};

export type DocumentForScore = {
  document_type: string | null;
  extracted_supplier: string | null;
  extracted_date: string | null;
  extracted_ewc_code: string | null;
  extracted_licence_number: string | null;
  expiry_date: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  waste_type: string | null;
  ai_summary: string | null;
  processing_status: "uploaded" | "processing" | "processed" | "review" | "failed" | null;
};

export type AlertForScore = {
  severity: "low" | "medium" | "high" | null;
  status: string | null;
};

export type ComplianceScoreResult = {
  score: number;
  status: ComplianceStatus;
  explanation: string;
  penalties: string[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function isExpiredDate(value: string | null) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = new Date();
  return parsed.getTime() < now.getTime();
}

function hasKeyword(documents: DocumentForScore[], field: "waste_type" | "ai_summary", keyword: string) {
  return documents.some((doc) => normalize(doc[field]).includes(keyword));
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function isWithinDays(value: string | null, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + days);
  return date.getTime() >= now.getTime() && date.getTime() <= end.getTime();
}

function isValidWasteTransferNote(doc: DocumentForScore) {
  return (
    doc.processing_status === "processed" &&
    doc.document_type === "waste_transfer_note" &&
    doc.ai_risk_level !== "high" &&
    hasText(doc.extracted_supplier) &&
    hasText(doc.extracted_date) &&
    hasText(doc.waste_type) &&
    (hasText(doc.extracted_ewc_code) || hasText(doc.extracted_licence_number))
  );
}

function isValidCarrierLicence(doc: DocumentForScore) {
  return (
    doc.processing_status === "processed" &&
    doc.document_type === "carrier_licence" &&
    doc.ai_risk_level !== "high" &&
    hasText(doc.extracted_supplier) &&
    hasText(doc.expiry_date) &&
    hasText(doc.extracted_licence_number)
  );
}

function isValidHazardousWasteNote(doc: DocumentForScore) {
  return (
    doc.processing_status === "processed" &&
    doc.document_type === "hazardous_waste_note" &&
    doc.ai_risk_level !== "high" &&
    hasText(doc.extracted_supplier) &&
    hasText(doc.extracted_date) &&
    hasText(doc.waste_type) &&
    hasText(doc.extracted_ewc_code)
  );
}

export function calculateComplianceScore(params: {
  businessProfile: BusinessProfileForScore | null;
  uploadedDocuments: DocumentForScore[];
  openAlerts: AlertForScore[];
}): ComplianceScoreResult {
  const { businessProfile, uploadedDocuments, openAlerts } = params;

  if (!businessProfile) {
    return {
      score: 0,
      status: "at_risk",
      explanation: "No business profile found.",
      penalties: ["No business profile: -100 (score forced to 0)"]
    };
  }

  let score = 100;
  const penalties: string[] = [];
  const validWTNs = uploadedDocuments.filter(isValidWasteTransferNote);
  const validCarrierLicences = uploadedDocuments.filter(isValidCarrierLicence);
  const validHazardousNotes = uploadedDocuments.filter(isValidHazardousWasteNote);

  if (validWTNs.length === 0) {
    score -= 30;
    penalties.push("No valid waste transfer note: -30");
  }

  if (validCarrierLicences.length === 0) {
    score -= 25;
    penalties.push("No valid carrier licence: -25");
  }

  if (validCarrierLicences.some((doc) => isExpiredDate(doc.expiry_date))) {
    score -= 30;
    penalties.push("Carrier licence expired: -30");
  }

  if (validCarrierLicences.some((doc) => isWithinDays(doc.expiry_date, 30))) {
    score -= 15;
    penalties.push("Carrier licence expires within 30 days: -15");
  }

  const reviewCount = uploadedDocuments.filter((doc) => doc.processing_status === "review").length;
  if (reviewCount > 0) {
    const penalty = Math.min(30, reviewCount * 15);
    score -= penalty;
    penalties.push(`Documents in review (${reviewCount}): -${penalty}`);
  }

  const failedCount = uploadedDocuments.filter((doc) => doc.processing_status === "failed").length;
  if (failedCount > 0) {
    const penalty = Math.min(50, failedCount * 25);
    score -= penalty;
    penalties.push(`Failed documents (${failedCount}): -${penalty}`);
  }

  if (businessProfile.produces_food_waste) {
    const processedDocs = uploadedDocuments.filter((d) => d.processing_status === "processed");
    const hasFoodEvidence = hasKeyword(processedDocs, "waste_type", "food") || hasKeyword(processedDocs, "ai_summary", "food");

    if (!hasFoodEvidence) {
      score -= 15;
      penalties.push("Food waste business has no food waste evidence: -15");
    }
  }

  if (businessProfile.produces_hazardous_waste) {
    if (validHazardousNotes.length === 0) {
      score -= 25;
      penalties.push("No valid hazardous waste note: -25");
    }
  }

  const openMediumCount = openAlerts.filter((a) => a.status !== "resolved" && a.severity === "medium").length;
  if (openMediumCount > 0) {
    const penalty = openMediumCount * 10;
    score -= penalty;
    penalties.push(`Open medium alerts (${openMediumCount}): -${penalty}`);
  }

  const openHighCount = openAlerts.filter((a) => a.status !== "resolved" && a.severity === "high").length;
  if (openHighCount > 0) {
    const penalty = openHighCount * 20;
    score -= penalty;
    penalties.push(`Open high alerts (${openHighCount}): -${penalty}`);
  }

  score = Math.max(0, Math.min(100, score));

  let status: ComplianceStatus = "compliant";
  if (score < 60) {
    status = "at_risk";
  } else if (score < 85) {
    status = "attention_needed";
  }

  const explanation =
    penalties.length > 0
      ? `Score reduced by: ${penalties.join("; ")}.`
      : "No penalties applied. Your current records indicate a compliant position.";

  return {
    score,
    status,
    explanation,
    penalties
  };
}
