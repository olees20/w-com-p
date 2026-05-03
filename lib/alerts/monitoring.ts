import { supabaseAdmin } from "@/lib/supabase/admin";

type Severity = "low" | "medium" | "high";

type BusinessRow = {
  id: string;
  user_id: string;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
};

type DocumentRow = {
  id: string;
  file_name: string;
  document_type: string | null;
  extracted_supplier: string | null;
  extracted_date: string | null;
  extracted_ewc_code: string | null;
  extracted_licence_number: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  expiry_date: string | null;
  waste_type: string | null;
  ai_summary: string | null;
  ai_extracted_json: { missing_fields?: string[] } | null;
  created_at: string;
  processing_status: "uploaded" | "processing" | "processed" | "review" | "failed" | null;
};

type AlertInput = {
  rule_id: string;
  rule_key: string;
  title: string;
  description: string;
  severity: Severity;
  due_date?: string | null;
  document_id?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function hasKeyword(documents: DocumentRow[], field: "waste_type" | "ai_summary", keyword: string) {
  return documents.some((doc) => normalize(doc[field]).includes(keyword));
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

function toDateOnly(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isBeforeToday(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getTime() < now.getTime();
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function isValidWasteTransferNote(document: DocumentRow) {
  return (
    document.processing_status === "processed" &&
    document.document_type === "waste_transfer_note" &&
    document.ai_risk_level !== "high" &&
    hasText(document.extracted_supplier) &&
    hasText(document.extracted_date) &&
    hasText(document.waste_type) &&
    (hasText(document.extracted_ewc_code) || hasText(document.extracted_licence_number))
  );
}

export function isValidCarrierLicence(document: DocumentRow) {
  return (
    document.processing_status === "processed" &&
    document.document_type === "carrier_licence" &&
    document.ai_risk_level !== "high" &&
    hasText(document.extracted_supplier) &&
    hasText(document.expiry_date) &&
    hasText(document.extracted_licence_number)
  );
}

export function isValidInvoice(document: DocumentRow) {
  return (
    document.processing_status === "processed" &&
    document.document_type === "invoice" &&
    document.ai_risk_level !== "high" &&
    hasText(document.extracted_supplier) &&
    hasText(document.extracted_date)
  );
}

export function isValidHazardousWasteNote(document: DocumentRow) {
  return (
    document.processing_status === "processed" &&
    document.document_type === "hazardous_waste_note" &&
    document.ai_risk_level !== "high" &&
    hasText(document.extracted_supplier) &&
    hasText(document.extracted_date) &&
    hasText(document.waste_type) &&
    hasText(document.extracted_ewc_code)
  );
}

function buildAlertsForBusiness(business: BusinessRow, documents: DocumentRow[]): AlertInput[] {
  const alerts: AlertInput[] = [];
  const validWTNs = documents.filter(isValidWasteTransferNote);
  const validCarrierLicences = documents.filter(isValidCarrierLicence);

  if (validWTNs.length === 0) {
    alerts.push({
      rule_id: "wtn_required",
      rule_key: "no_valid_waste_transfer_note",
      title: "No valid waste transfer note",
      description: "Upload a processed waste transfer note with required fields.",
      severity: "high"
    });
  }

  if (validCarrierLicences.length === 0) {
    alerts.push({
      rule_id: "licensed_carrier",
      rule_key: "carrier_licence_missing",
      title: "Carrier licence missing",
      description: "Upload a valid processed carrier licence with supplier, licence number, and expiry date.",
      severity: "high"
    });
  }

  for (const doc of validCarrierLicences) {
    const supplier = doc.extracted_supplier ?? "Carrier";
    const licence = doc.extracted_licence_number ?? "unknown licence";
    const expiry = toDateOnly(doc.expiry_date) ?? "unknown date";
    if (isBeforeToday(doc.expiry_date)) {
      alerts.push({
        rule_id: "licensed_carrier",
        rule_key: "carrier_licence_expired",
        title: "Carrier licence expired",
        description: `${supplier} licence ${licence} expired on ${expiry}.`,
        severity: "high",
        due_date: toDateOnly(doc.expiry_date),
        document_id: doc.id
      });
    } else if (isWithinDays(doc.expiry_date, 30)) {
      alerts.push({
        rule_id: "licensed_carrier",
        rule_key: "carrier_licence_expiring",
        title: "Carrier licence expires soon",
        description: `${supplier} licence ${licence} expires on ${expiry}.`,
        severity: "high",
        due_date: toDateOnly(doc.expiry_date),
        document_id: doc.id
      });
    }
  }

  for (const doc of documents.filter((d) => d.processing_status === "review")) {
    const missing = doc.ai_extracted_json?.missing_fields?.length ? doc.ai_extracted_json.missing_fields.join(", ") : "required fields";
    alerts.push({
      rule_id: "document_field_completeness",
      rule_key: "document_requires_review",
      title: "Document requires review",
      description: `${doc.file_name} is missing required fields: ${missing}`,
      severity: "medium",
      document_id: doc.id
    });
  }

  if (business.produces_food_waste) {
    const processedDocs = documents.filter((d) => d.processing_status === "processed");
    const hasFoodEvidence = hasKeyword(processedDocs, "waste_type", "food") || hasKeyword(processedDocs, "ai_summary", "food");
    if (!hasFoodEvidence) {
      alerts.push({
        rule_id: "food_waste_separation",
        rule_key: "food_waste_missing",
        title: "Food waste documentation missing",
        description: "Upload records that show food waste handling and disposal evidence.",
        severity: "medium"
      });
    }
  }

  return alerts;
}

export async function regenerateAlertsForBusiness(businessId: string) {
  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id,user_id,produces_food_waste,produces_hazardous_waste")
    .eq("id", businessId)
    .maybeSingle<BusinessRow>();

  if (businessError || !business) return;

  const { data: documents } = await supabaseAdmin
    .from("documents")
    .select(
      "id,file_name,document_type,extracted_supplier,extracted_date,extracted_ewc_code,extracted_licence_number,ai_risk_level,expiry_date,waste_type,ai_summary,ai_extracted_json,created_at,processing_status"
    )
    .eq("business_id", business.id);

  const allDocuments = (documents ?? []) as DocumentRow[];
  const generated = buildAlertsForBusiness(business, allDocuments);

  // Close prior system-generated open alerts so state always reflects current processed docs.
  await supabaseAdmin
    .from("alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .eq("status", "open")
    .eq("source", "system");

  const dedupe = new Set<string>();
  const deduped = generated.filter((a) => {
    const key = `${a.rule_key}|${a.document_id ?? "none"}`;
    if (dedupe.has(key)) return false;
    dedupe.add(key);
    return true;
  });

  const { data: existingOpenSystem } = await supabaseAdmin
    .from("alerts")
    .select("rule_key,document_id")
    .eq("business_id", business.id)
    .eq("status", "open")
    .eq("source", "system");

  const openKeySet = new Set((existingOpenSystem ?? []).map((a) => `${a.rule_key ?? "none"}|${a.document_id ?? "none"}`));

  const toInsert = deduped
    .filter((alert) => !openKeySet.has(`${alert.rule_key}|${alert.document_id ?? "none"}`))
    .map((alert) => ({
      business_id: business.id,
      user_id: business.user_id,
      document_id: alert.document_id ?? null,
      rule_id: alert.rule_id,
      rule_key: alert.rule_key,
      source: "system",
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      status: "open",
      due_date: alert.due_date ?? null
    }));

  if (toInsert.length > 0) {
    await supabaseAdmin.from("alerts").insert(toInsert);
  }
}

export async function runAlertMonitoringForBusiness(businessId: string) {
  await regenerateAlertsForBusiness(businessId);
}

export async function runAlertMonitoringForAllBusinesses() {
  const { data: businesses } = await supabaseAdmin.from("businesses").select("id");
  for (const business of (businesses ?? []) as Array<{ id: string }>) {
    await regenerateAlertsForBusiness(business.id);
  }
}
