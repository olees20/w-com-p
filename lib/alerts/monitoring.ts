import { createServerClient } from "@/lib/supabase/server";

type Severity = "low" | "medium" | "high";

type BusinessRow = {
  id: string;
  user_id: string;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
};

type DocumentRow = {
  id: string;
  document_type: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  expiry_date: string | null;
  waste_type: string | null;
  ai_summary: string | null;
  created_at: string;
};

type AlertInput = {
  title: string;
  description: string;
  severity: Severity;
  due_date?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function hasKeyword(documents: DocumentRow[], field: "waste_type" | "ai_summary", keyword: string) {
  return documents.some((doc) => normalize(doc[field]).includes(keyword));
}

function isWithinDays(value: string | null, days: number) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + days);
  return date.getTime() >= now.getTime() && date.getTime() <= end.getTime();
}

function toDateOnly(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function hasCurrentMonthWasteRecord(documents: DocumentRow[]) {
  const now = new Date();
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();

  return documents.some((doc) => {
    const created = new Date(doc.created_at);
    if (Number.isNaN(created.getTime())) {
      return false;
    }

    const matchesMonth = created.getUTCMonth() === month && created.getUTCFullYear() === year;
    const isWasteLike = doc.document_type === "waste_transfer_note" || normalize(doc.waste_type).length > 0;
    return matchesMonth && isWasteLike;
  });
}

function buildAlertsForBusiness(business: BusinessRow, documents: DocumentRow[]): AlertInput[] {
  const alerts: AlertInput[] = [];

  if (documents.length === 0) {
    alerts.push({
      title: "No documents uploaded",
      description: "Upload compliance evidence to maintain visibility and reduce risk.",
      severity: "high"
    });
  }

  if (!documents.some((doc) => doc.document_type === "waste_transfer_note")) {
    alerts.push({
      title: "No waste transfer note uploaded",
      description: "Add a valid waste transfer note to meet baseline compliance evidence.",
      severity: "high"
    });
  }

  const carrierExpiring = documents.find(
    (doc) => doc.document_type === "carrier_licence" && isWithinDays(doc.expiry_date, 30)
  );
  if (carrierExpiring) {
    alerts.push({
      title: "Carrier licence expires within 30 days",
      description: "A carrier licence appears to be close to expiry. Renew or replace it.",
      severity: "high",
      due_date: toDateOnly(carrierExpiring.expiry_date)
    });
  }

  if (documents.some((doc) => doc.ai_risk_level === "high")) {
    alerts.push({
      title: "Document has high AI risk level",
      description: "At least one uploaded document is flagged as high risk by AI extraction.",
      severity: "high"
    });
  }

  if (business.produces_food_waste) {
    const hasFoodEvidence = hasKeyword(documents, "waste_type", "food") || hasKeyword(documents, "ai_summary", "food");
    if (!hasFoodEvidence) {
      alerts.push({
        title: "Food waste business has no food waste documentation",
        description: "Upload records that show food waste handling and disposal evidence.",
        severity: "medium"
      });
    }
  }

  if (business.produces_hazardous_waste) {
    const hasHazardousEvidence =
      hasKeyword(documents, "waste_type", "hazard") || hasKeyword(documents, "ai_summary", "hazard");
    if (!hasHazardousEvidence) {
      alerts.push({
        title: "Hazardous waste business has no hazardous waste documentation",
        description: "Upload hazardous waste documentation to reduce compliance exposure.",
        severity: "high"
      });
    }
  }

  if (!hasCurrentMonthWasteRecord(documents)) {
    const now = new Date();
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    alerts.push({
      title: "Missing monthly waste record",
      description: "No waste record detected for the current month.",
      severity: "medium",
      due_date: monthEnd
    });
  }

  return alerts;
}

async function createMissingOpenAlertsForBusiness(business: BusinessRow) {
  const supabase = await createServerClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("id,document_type,ai_risk_level,expiry_date,waste_type,ai_summary,created_at")
    .eq("business_id", business.id);

  const { data: existingOpenAlerts } = await supabase
    .from("alerts")
    .select("title")
    .eq("business_id", business.id)
    .eq("status", "open");

  const existingTitles = new Set((existingOpenAlerts ?? []).map((a: { title: string }) => a.title));
  const generated = buildAlertsForBusiness(business, (documents ?? []) as DocumentRow[]);

  const toInsert = generated
    .filter((alert) => !existingTitles.has(alert.title))
    .map((alert) => ({
      business_id: business.id,
      user_id: business.user_id,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      status: "open",
      due_date: alert.due_date ?? null
    }));

  if (toInsert.length > 0) {
    await supabase.from("alerts").insert(toInsert);
  }
}

export async function runAlertMonitoringForBusiness(businessId: string) {
  const supabase = await createServerClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id,user_id,produces_food_waste,produces_hazardous_waste")
    .eq("id", businessId)
    .maybeSingle<BusinessRow>();

  if (!business) {
    return;
  }

  await createMissingOpenAlertsForBusiness(business);
}

export async function runAlertMonitoringForAllBusinesses() {
  const supabase = await createServerClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id,user_id,produces_food_waste,produces_hazardous_waste");

  for (const business of (businesses ?? []) as BusinessRow[]) {
    await createMissingOpenAlertsForBusiness(business);
  }
}
