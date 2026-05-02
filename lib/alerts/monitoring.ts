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
  extracted_licence_number: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  expiry_date: string | null;
  waste_type: string | null;
  ai_summary: string | null;
  created_at: string;
  processing_status: "uploaded" | "processing" | "processed" | "failed" | null;
};

type AlertInput = {
  rule_id: string;
  title: string;
  description: string;
  severity: Severity;
  due_date?: string | null;
  document_id?: string | null;
};

const SYSTEM_ALERT_TITLES = [
  "No documents uploaded",
  "No waste transfer note uploaded",
  "Carrier licence expires soon",
  "Document has high AI risk level",
  "Food waste business has no food waste documentation",
  "Hazardous waste business has no hazardous waste documentation",
  "Missing monthly waste record"
] as const;

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

function hasCurrentMonthWasteRecord(documents: DocumentRow[]) {
  const now = new Date();
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  return documents.some((doc) => {
    const created = new Date(doc.created_at);
    if (Number.isNaN(created.getTime())) return false;
    const matchesMonth = created.getUTCMonth() === month && created.getUTCFullYear() === year;
    const isWasteLike = doc.document_type === "waste_transfer_note" || normalize(doc.waste_type).length > 0;
    return matchesMonth && isWasteLike;
  });
}

function buildAlertsForBusiness(business: BusinessRow, processedDocuments: DocumentRow[]): AlertInput[] {
  const alerts: AlertInput[] = [];

  if (processedDocuments.length === 0) {
    alerts.push({
      rule_id: "documents_uploaded",
      title: "No documents uploaded",
      description: "Upload compliance evidence to maintain visibility and reduce risk.",
      severity: "high"
    });
  }

  const hasWasteTransferNote = processedDocuments.some(
    (doc) => doc.document_type === "waste_transfer_note" && doc.processing_status === "processed"
  );
  if (!hasWasteTransferNote) {
    alerts.push({
      rule_id: "wtn_required",
      title: "No waste transfer note uploaded",
      description: "Add a valid waste transfer note to meet baseline compliance evidence.",
      severity: "high"
    });
  }

  for (const doc of processedDocuments) {
    if (doc.document_type === "carrier_licence" && isWithinDays(doc.expiry_date, 30)) {
      const dateLabel = toDateOnly(doc.expiry_date) ?? "unknown date";
      const supplier = doc.extracted_supplier ?? "Carrier";
      const licence = doc.extracted_licence_number ?? "unknown licence";
      alerts.push({
        rule_id: "licensed_carrier",
        title: "Carrier licence expires soon",
        description: `${supplier} licence ${licence} expires on ${dateLabel}.`,
        severity: "high",
        due_date: toDateOnly(doc.expiry_date),
        document_id: doc.id
      });
    }
  }

  for (const doc of processedDocuments) {
    if (doc.ai_risk_level === "high") {
      alerts.push({
        rule_id: "high_risk_document",
        title: "Document has high AI risk level",
        description: `${doc.file_name} is flagged high risk by AI extraction.`,
        severity: "high",
        document_id: doc.id
      });
    }
  }

  if (business.produces_food_waste) {
    const hasFoodEvidence = hasKeyword(processedDocuments, "waste_type", "food") || hasKeyword(processedDocuments, "ai_summary", "food");
    if (!hasFoodEvidence) {
      alerts.push({
        rule_id: "food_waste_separation",
        title: "Food waste business has no food waste documentation",
        description: "Upload records that show food waste handling and disposal evidence.",
        severity: "medium"
      });
    }
  }

  if (business.produces_hazardous_waste) {
    const hasHazardousEvidence =
      hasKeyword(processedDocuments, "waste_type", "hazard") || hasKeyword(processedDocuments, "ai_summary", "hazard");
    if (!hasHazardousEvidence) {
      alerts.push({
        rule_id: "hazardous_waste_documentation",
        title: "Hazardous waste business has no hazardous waste documentation",
        description: "Upload hazardous waste documentation to reduce compliance exposure.",
        severity: "high"
      });
    }
  }

  if (!hasCurrentMonthWasteRecord(processedDocuments)) {
    const now = new Date();
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    alerts.push({
      rule_id: "monthly_waste_record",
      title: "Missing monthly waste record",
      description: "No waste record detected for the current month.",
      severity: "medium",
      due_date: monthEnd
    });
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
    .select("id,file_name,document_type,extracted_supplier,extracted_licence_number,ai_risk_level,expiry_date,waste_type,ai_summary,created_at,processing_status")
    .eq("business_id", business.id)
    .eq("processing_status", "processed");

  const processedDocuments = (documents ?? []) as DocumentRow[];
  const generated = buildAlertsForBusiness(business, processedDocuments);

  // Close prior system-generated open alerts so state always reflects current processed docs.
  await supabaseAdmin
    .from("alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .eq("status", "open")
    .in("title", [...SYSTEM_ALERT_TITLES]);

  const dedupe = new Set<string>();
  const toInsert = generated
    .filter((a) => {
      const key = `${a.title}|${a.document_id ?? "none"}|${a.due_date ?? "none"}`;
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    })
    .map((alert) => ({
      business_id: business.id,
      user_id: business.user_id,
      document_id: alert.document_id ?? null,
      rule_id: alert.rule_id,
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
