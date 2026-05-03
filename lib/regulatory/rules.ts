import { supabaseAdmin } from "@/lib/supabase/admin";
import { isValidCarrierLicence, isValidHazardousWasteNote, isValidInvoice, isValidWasteTransferNote } from "@/lib/alerts/monitoring";

export type RuleStatus = "complete" | "warning" | "missing" | "unknown";

type Business = {
  id: string;
  user_id: string;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
};

type Document = {
  id: string;
  file_name: string;
  document_type: string | null;
  processing_status: "uploaded" | "processing" | "processed" | "review" | "failed" | null;
  extracted_supplier: string | null;
  extracted_date: string | null;
  expiry_date: string | null;
  waste_type: string | null;
  extracted_ewc_code: string | null;
  extracted_licence_number: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  ai_summary: string | null;
  ai_extracted_json: { missing_fields?: string[] } | null;
  created_at: string;
};

type RuleDefinition = {
  rule_key: string;
  title: string;
  plain_english_summary: string;
  requirement_text: string;
  applies_to: Record<string, unknown>;
  evidence_required: Record<string, unknown>;
  severity: "low" | "medium" | "high";
  source_url: string;
  source_quote: string;
};

type ComplianceRule = {
  id: string;
  rule_key: string;
  title: string;
  plain_english_summary: string;
  source_url: string | null;
};

type RuleDisplay = {
  rule_id: string;
  rule_key: string;
  title: string;
  explanation: string;
  why_it_applies: string;
  status: RuleStatus;
  action_required: string;
  govuk_url: string;
};

const RULE_DEFINITIONS: RuleDefinition[] = [
  {
    rule_key: "waste_transfer_note_required",
    title: "Waste transfer note required",
    plain_english_summary: "Keep a valid waste transfer note (or equivalent invoice details) for commercial waste movements.",
    requirement_text: "Businesses producing non-hazardous commercial waste should keep transfer records.",
    applies_to: { produces_commercial_waste: true },
    evidence_required: { document_types: ["waste_transfer_note", "invoice"] },
    severity: "high",
    source_url: "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes",
    source_quote: "You must complete a waste transfer note for each load of waste that leaves your premises."
  },
  {
    rule_key: "licensed_waste_carrier_required",
    title: "Waste carrier must be registered",
    plain_english_summary: "Use a registered waste carrier and keep licence evidence.",
    requirement_text: "Check and record your carrier's registration details.",
    applies_to: { uses_third_party_waste_collector: true },
    evidence_required: { document_types: ["carrier_licence"] },
    severity: "high",
    source_url: "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers",
    source_quote: "Search the public register for waste carriers, brokers and dealers."
  },
  {
    rule_key: "keep_waste_records",
    title: "Keep waste records",
    plain_english_summary: "Store waste transfer documents and related records for audit evidence.",
    requirement_text: "Maintain disposal documentation and make it available for inspections.",
    applies_to: { produces_commercial_waste: true },
    evidence_required: { document_types: ["waste_transfer_note", "invoice", "recycling_report"] },
    severity: "medium",
    source_url: "https://www.gov.uk/dispose-business-commercial-waste",
    source_quote: "You must keep records of your waste transfers."
  },
  {
    rule_key: "workplace_recycling_required",
    title: "Separate recyclable workplace waste",
    plain_english_summary: "Workplaces in England should separate key recyclable waste streams.",
    requirement_text: "Collect recyclable materials separately where required under simpler recycling guidance.",
    applies_to: { jurisdiction: "england" },
    evidence_required: { document_types: ["recycling_report", "contract"] },
    severity: "medium",
    source_url: "https://www.gov.uk/guidance/simpler-recycling-workplace-recycling-in-england",
    source_quote: "Workplaces in England must separate recyclable waste streams."
  },
  {
    rule_key: "food_waste_required",
    title: "Food waste separation",
    plain_english_summary: "If your business produces food waste, keep evidence of separate collection.",
    requirement_text: "Businesses producing food waste should have records showing compliant collection.",
    applies_to: { produces_food_waste: true },
    evidence_required: { document_types: ["waste_transfer_note", "contract", "recycling_report"] },
    severity: "medium",
    source_url: "https://www.gov.uk/guidance/simpler-recycling-workplace-recycling-in-england",
    source_quote: "Food waste should be separated in workplace recycling collections."
  },
  {
    rule_key: "hazardous_waste_note_required",
    title: "Hazardous waste documentation required",
    plain_english_summary: "Keep hazardous waste notes when hazardous waste is produced.",
    requirement_text: "Hazardous waste movements require specific documentation.",
    applies_to: { produces_hazardous_waste: true },
    evidence_required: { document_types: ["hazardous_waste_note"] },
    severity: "high",
    source_url: "https://www.gov.uk/dispose-business-commercial-waste",
    source_quote: "You must follow stricter requirements for hazardous waste."
  }
];

function isWithinDays(value: string | null, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + days);
  return date.getTime() >= now.getTime() && date.getTime() <= end.getTime();
}

function buildRuleEvaluation(ruleKey: string, business: Business, documents: Document[]) {
  const processedDocs = documents.filter((doc) => doc.processing_status === "processed");

  switch (ruleKey) {
    case "waste_transfer_note_required": {
      const validWtn = processedDocs.some(isValidWasteTransferNote);
      const validInvoice = processedDocs.some(isValidInvoice);
      return {
        applies: true,
        status: validWtn || validInvoice ? "complete" : "missing",
        evidenceDocumentIds: processedDocs.filter((doc) => isValidWasteTransferNote(doc) || isValidInvoice(doc)).map((doc) => doc.id),
        explanation: validWtn || validInvoice ? "Valid transfer evidence found." : "No valid waste transfer note or equivalent invoice found.",
        whyItApplies: "Your business produces commercial waste and requires transfer records.",
        actionRequired: validWtn || validInvoice ? "No action needed." : "Upload a valid waste transfer note or invoice with required waste transfer details."
      } as const;
    }
    case "licensed_waste_carrier_required": {
      const validLicences = processedDocs.filter(isValidCarrierLicence);
      const hasValid = validLicences.length > 0;
      const expiring = validLicences.some((doc) => isWithinDays(doc.expiry_date, 30));
      return {
        applies: true,
        status: !hasValid ? "missing" : expiring ? "warning" : "complete",
        evidenceDocumentIds: validLicences.map((doc) => doc.id),
        explanation: !hasValid
          ? "No valid carrier licence evidence found."
          : expiring
            ? "A valid carrier licence exists but expires soon."
            : "Valid carrier licence evidence found.",
        whyItApplies: "Third-party waste collection must use registered carriers.",
        actionRequired: !hasValid
          ? "Upload a valid carrier licence or register proof."
          : expiring
            ? "Renew the carrier licence before expiry."
            : "No action needed."
      } as const;
    }
    case "keep_waste_records": {
      const records = processedDocs.filter((doc) => ["waste_transfer_note", "invoice", "recycling_report"].includes(doc.document_type ?? ""));
      const complete = records.length > 0;
      return {
        applies: true,
        status: complete ? "complete" : "missing",
        evidenceDocumentIds: records.map((doc) => doc.id),
        explanation: complete ? "Waste records are stored in the platform." : "No processed waste records are stored yet.",
        whyItApplies: "Commercial waste activities should be evidenced for inspections.",
        actionRequired: complete ? "Continue storing records." : "Upload and process waste transfer notes/invoices."
      } as const;
    }
    case "workplace_recycling_required": {
      const hasRecyclingEvidence = processedDocs.some((doc) => ["recycling_report", "contract"].includes(doc.document_type ?? ""));
      return {
        applies: true,
        status: hasRecyclingEvidence ? "complete" : "warning",
        evidenceDocumentIds: processedDocs
          .filter((doc) => ["recycling_report", "contract"].includes(doc.document_type ?? ""))
          .map((doc) => doc.id),
        explanation: hasRecyclingEvidence ? "Recycling evidence found." : "No recycling evidence document found.",
        whyItApplies: "Workplace recycling requirements apply to most businesses in England.",
        actionRequired: hasRecyclingEvidence ? "No action needed." : "Upload a recycling report or waste contract covering separated recycling collections."
      } as const;
    }
    case "food_waste_required": {
      const applies = Boolean(business.produces_food_waste);
      const hasFoodEvidence = processedDocs.some((doc) => {
        const signal = `${doc.waste_type ?? ""} ${doc.ai_summary ?? ""}`.toLowerCase();
        return signal.includes("food");
      });
      return {
        applies,
        status: !applies ? "unknown" : hasFoodEvidence ? "complete" : "missing",
        evidenceDocumentIds: processedDocs
          .filter((doc) => `${doc.waste_type ?? ""} ${doc.ai_summary ?? ""}`.toLowerCase().includes("food"))
          .map((doc) => doc.id),
        explanation: !applies
          ? "This rule does not currently apply based on your business profile."
          : hasFoodEvidence
            ? "Food waste evidence found."
            : "No food waste collection evidence found.",
        whyItApplies: "This applies because your business profile indicates food waste is produced.",
        actionRequired: !applies ? "No action needed." : hasFoodEvidence ? "No action needed." : "Upload a food waste collection record or contract."
      } as const;
    }
    case "hazardous_waste_note_required": {
      const applies = Boolean(business.produces_hazardous_waste);
      const validHazardous = processedDocs.filter(isValidHazardousWasteNote);
      return {
        applies,
        status: !applies ? "unknown" : validHazardous.length > 0 ? "complete" : "missing",
        evidenceDocumentIds: validHazardous.map((doc) => doc.id),
        explanation: !applies
          ? "This rule does not currently apply based on your business profile."
          : validHazardous.length > 0
            ? "Hazardous waste note evidence found."
            : "No valid hazardous waste documentation found.",
        whyItApplies: "This applies when hazardous waste is produced by the business.",
        actionRequired: !applies ? "No action needed." : validHazardous.length > 0 ? "No action needed." : "Upload and process hazardous waste notes."
      } as const;
    }
    default:
      return {
        applies: true,
        status: "unknown",
        evidenceDocumentIds: [],
        explanation: "Rule evaluation is not configured.",
        whyItApplies: "Rule evaluation is not configured.",
        actionRequired: "Review this rule manually."
      } as const;
  }
}

export async function seedComplianceRules() {
  const { data: existing } = await supabaseAdmin.from("compliance_rules").select("id,rule_key");
  const existingByKey = new Map((existing ?? []).map((row) => [row.rule_key, row.id]));

  for (const rule of RULE_DEFINITIONS) {
    const { data: source } = await supabaseAdmin
      .from("regulatory_sources")
      .select("id")
      .eq("url", rule.source_url)
      .maybeSingle<{ id: string }>();

    const payload = {
      rule_key: rule.rule_key,
      title: rule.title,
      plain_english_summary: rule.plain_english_summary,
      requirement_text: rule.requirement_text,
      applies_to: rule.applies_to,
      evidence_required: rule.evidence_required,
      severity: rule.severity,
      source_id: source?.id ?? null,
      source_url: rule.source_url,
      source_quote: rule.source_quote,
      is_active: true
    };

    const existingId = existingByKey.get(rule.rule_key);
    if (existingId) {
      await supabaseAdmin.from("compliance_rules").update(payload).eq("id", existingId);
    } else {
      await supabaseAdmin.from("compliance_rules").insert(payload);
    }
  }
}

export async function syncBusinessRuleStatuses(businessId: string): Promise<RuleDisplay[]> {
  const [{ data: business }, { data: docs }] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("id,user_id,produces_food_waste,produces_hazardous_waste")
      .eq("id", businessId)
      .maybeSingle<Business>(),
    supabaseAdmin
      .from("documents")
      .select(
        "id,file_name,document_type,processing_status,extracted_supplier,extracted_date,expiry_date,waste_type,extracted_ewc_code,extracted_licence_number,ai_risk_level,ai_summary,ai_extracted_json,created_at"
      )
      .eq("business_id", businessId)
  ]);

  if (!business) return [];

  const { data: rules } = await supabaseAdmin
    .from("compliance_rules")
    .select("id,rule_key,title,plain_english_summary,source_url")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const documents = (docs ?? []) as Document[];
  const display: RuleDisplay[] = [];

  for (const rule of ((rules ?? []) as ComplianceRule[])) {
    const evaluation = buildRuleEvaluation(rule.rule_key, business, documents);
    if (!evaluation.applies) continue;

    const rowPayload = {
      business_id: business.id,
      rule_id: rule.id,
      status: evaluation.status,
      evidence_document_ids: evaluation.evidenceDocumentIds,
      explanation: evaluation.explanation,
      last_checked_at: new Date().toISOString()
    };

    const { data: existingStatus } = await supabaseAdmin
      .from("business_rule_statuses")
      .select("id")
      .eq("business_id", business.id)
      .eq("rule_id", rule.id)
      .maybeSingle<{ id: string }>();

    if (existingStatus?.id) {
      await supabaseAdmin.from("business_rule_statuses").update(rowPayload).eq("id", existingStatus.id);
    } else {
      await supabaseAdmin.from("business_rule_statuses").insert(rowPayload);
    }

    display.push({
      rule_id: rule.id,
      rule_key: rule.rule_key,
      title: rule.title,
      explanation: rule.plain_english_summary,
      why_it_applies: evaluation.whyItApplies,
      status: evaluation.status,
      action_required: evaluation.actionRequired,
      govuk_url: rule.source_url ?? "https://www.gov.uk"
    });
  }

  return display;
}
