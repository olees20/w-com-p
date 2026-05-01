export type ComplianceStatus = "compliant" | "attention_needed" | "at_risk";

export type BusinessProfileForScore = {
  id: string;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
};

export type DocumentForScore = {
  document_type: string | null;
  expiry_date: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  waste_type: string | null;
  ai_summary: string | null;
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

  if (uploadedDocuments.length === 0) {
    score -= 30;
    penalties.push("No documents uploaded: -30");
  }

  const hasWasteTransferNote = uploadedDocuments.some((doc) => doc.document_type === "waste_transfer_note");
  if (!hasWasteTransferNote) {
    score -= 25;
    penalties.push("No waste transfer note: -25");
  }

  const hasExpiredCarrierLicence = uploadedDocuments.some(
    (doc) => doc.document_type === "carrier_licence" && isExpiredDate(doc.expiry_date)
  );
  if (hasExpiredCarrierLicence) {
    score -= 30;
    penalties.push("Carrier licence expired: -30");
  }

  const hasHighRiskDocument = uploadedDocuments.some((doc) => doc.ai_risk_level === "high");
  if (hasHighRiskDocument) {
    score -= 20;
    penalties.push("High-risk document detected: -20");
  }

  const unresolvedHighSeverityAlert = openAlerts.some(
    (alert) => alert.status !== "resolved" && alert.severity === "high"
  );
  if (unresolvedHighSeverityAlert) {
    score -= 20;
    penalties.push("Unresolved high severity alert: -20");
  }

  const unresolvedMediumSeverityAlert = openAlerts.some(
    (alert) => alert.status !== "resolved" && alert.severity === "medium"
  );
  if (unresolvedMediumSeverityAlert) {
    score -= 10;
    penalties.push("Unresolved medium severity alert: -10");
  }

  if (businessProfile.produces_food_waste) {
    const hasFoodEvidence =
      hasKeyword(uploadedDocuments, "waste_type", "food") || hasKeyword(uploadedDocuments, "ai_summary", "food");

    if (!hasFoodEvidence) {
      score -= 15;
      penalties.push("Food-waste business with no food waste evidence: -15");
    }
  }

  if (businessProfile.produces_hazardous_waste) {
    const hasHazardousEvidence =
      hasKeyword(uploadedDocuments, "waste_type", "hazard") || hasKeyword(uploadedDocuments, "ai_summary", "hazard");

    if (!hasHazardousEvidence) {
      score -= 25;
      penalties.push("Hazardous-waste business with no relevant documents: -25");
    }
  }

  score = Math.max(0, Math.min(100, score));

  let status: ComplianceStatus = "compliant";
  if (score < 50) {
    status = "at_risk";
  } else if (score < 80) {
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
