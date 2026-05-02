export type RuleStatus = "complete" | "warning" | "missing";

export type BusinessForRules = {
  produces_food_waste: boolean | null;
};

export type DocumentForRules = {
  id: string;
  document_type: string | null;
  expiry_date: string | null;
  processing_status: "uploaded" | "processing" | "processed" | "review" | "failed" | null;
};

export type ComplianceRule = {
  rule_id: string;
  title: string;
  explanation: string;
  why_it_applies: string;
  status: RuleStatus;
  action_required: string;
  govuk_url: string;
};

function isWithinDays(value: string | null, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + days);
  return date.getTime() >= now.getTime() && date.getTime() <= end.getTime();
}

function hasProcessed(docs: DocumentForRules[], type: string) {
  return docs.some((d) => d.processing_status === "processed" && d.document_type === type);
}

export function buildComplianceRules(params: { business: BusinessForRules; documents: DocumentForRules[] }): ComplianceRule[] {
  const { business, documents } = params;
  const rules: ComplianceRule[] = [];

  const hasWTN = hasProcessed(documents, "waste_transfer_note");
  rules.push({
    rule_id: "wtn_required",
    title: "Waste transfer note required",
    explanation: "You should keep waste transfer notes as evidence of waste movement and handling.",
    why_it_applies: "Your business produces controlled waste and needs a paper trail for disposal.",
    status: hasWTN ? "complete" : "missing",
    action_required: hasWTN ? "No action needed." : "Upload a current waste transfer note.",
    govuk_url: "https://www.gov.uk/guidance/waste-duty-of-care-code-of-practice"
  });

  const processedLicences = documents.filter((d) => d.processing_status === "processed" && d.document_type === "carrier_licence");
  let licenceStatus: RuleStatus = "missing";
  if (processedLicences.length > 0) {
    licenceStatus = processedLicences.some((d) => isWithinDays(d.expiry_date, 30)) ? "warning" : "complete";
  }
  rules.push({
    rule_id: "licensed_carrier",
    title: "Licensed waste carrier",
    explanation: "Your waste should be collected by a licensed carrier.",
    why_it_applies: "Duty of care checks include verifying carriers used by your business.",
    status: licenceStatus,
    action_required:
      licenceStatus === "complete"
        ? "No action needed."
        : licenceStatus === "warning"
          ? "Renew or replace the carrier licence before it expires."
          : "Upload a carrier licence document.",
    govuk_url: "https://www.gov.uk/guidance/access-the-public-register-for-environmental-information"
  });

  if (business.produces_food_waste) {
    const hasFoodEvidence = documents.some(
      (d) => d.processing_status === "processed" && (d.document_type === "waste_transfer_note" || d.document_type === "recycling_report")
    );
    rules.push({
      rule_id: "food_waste_separation",
      title: "Food waste separation",
      explanation: "Food waste should be separated and managed in line with local authority and duty of care requirements.",
      why_it_applies: "You indicated your business produces food waste.",
      status: hasFoodEvidence ? "complete" : "missing",
      action_required: hasFoodEvidence ? "No action needed." : "Upload food waste collection evidence.",
      govuk_url: "https://www.gov.uk/guidance/waste-duty-of-care-code-of-practice"
    });
  }

  return rules;
}
