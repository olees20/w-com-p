import type { ReportDocument } from "@/lib/health-check-report";

export type EntityValidationFinding = {
  key: "multi_business_pack";
  title: string;
  severity: "high" | "medium";
  status: "fail" | "attention_needed";
  message: string;
  recommended_action: string;
  points: number;
};

export type EntityValidationResult = {
  finding: EntityValidationFinding | null;
  producer_names: string[];
  carrier_names: string[];
  destination_names: string[];
  unmatched_producer_names: string[];
  match_ratio: number;
};

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\blimited\b/g, "ltd")
    .replace(/\bco\.?\b/g, "company")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter((v) => v.trim())));
}

function extractNamesFromUnknown(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((v) => extractNamesFromUnknown(v));
  return [];
}

function pickRoleNames(payload: Record<string, unknown>, keys: string[]) {
  return unique(keys.flatMap((k) => extractNamesFromUnknown(payload[k])));
}

export function producerRoleNames(payload: Record<string, unknown>) {
  return pickRoleNames(payload, [
    "client",
    "customer",
    "producer",
    "waste_producer",
    "business_name",
    "site_name",
    "customer_name",
    "client_name",
    "producer_name",
    "invoice_recipient",
    "recipient"
  ]);
}

export function carrierRoleNames(payload: Record<string, unknown>, documentType: string | null, extractedSupplier: string | null) {
  const explicitCarrierKeysByType: Record<string, string[]> = {
    waste_transfer_note: ["carrier", "carrier_name", "supplier", "contractor"],
    invoice: ["invoice_issuer", "issuer", "supplier", "provider", "contractor"],
    carrier_licence: ["licensed_business", "carrier", "carrier_name", "supplier"],
    contract: ["supplier", "provider", "contractor", "carrier"]
  };

  const keys = explicitCarrierKeysByType[documentType ?? ""] ?? ["carrier", "supplier", "contractor", "provider"];
  const explicit = pickRoleNames(payload, keys);
  if (explicit.length) return explicit;

  // fallback to extracted supplier only when no explicit producer/client role collides
  if (extractedSupplier?.trim()) {
    const supplier = extractedSupplier.trim();
    const producerSet = new Set(producerRoleNames(payload).map((v) => normalizeName(v)));
    if (!producerSet.has(normalizeName(supplier))) {
      return [supplier];
    }
  }
  return [];
}

export function validateSingleBusinessPack(params: {
  onboardedBusinessName: string | null;
  documents: ReportDocument[];
}): EntityValidationResult {
  const processed = params.documents.filter((d) => d.processing_status === "processed");
  const producerCandidates: string[] = [];
  const carrierCandidates: string[] = [];
  const destinationCandidates: string[] = [];

  for (const doc of processed) {
    const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;

    const producers = producerRoleNames(payload);
    const carriers = carrierRoleNames(payload, doc.document_type, doc.extracted_supplier);

    const destinations = pickRoleNames(payload, [
      "destination",
      "disposal_site",
      "waste_destination",
      "facility",
      "treatment_facility",
      "receiving_facility",
      "destination_name",
      "destination_address"
    ]);

    producerCandidates.push(...producers);
    carrierCandidates.push(...carriers);
    destinationCandidates.push(...destinations);
  }

  const producerNames = unique(producerCandidates);
  const carrierNames = unique(carrierCandidates);
  const destinationNames = unique(destinationCandidates);

  const onboarded = normalizeName(params.onboardedBusinessName);
  const matched = producerNames.filter((name) => {
    const n = normalizeName(name);
    return n && onboarded && (n.includes(onboarded) || onboarded.includes(n));
  });
  const unmatched = producerNames.filter((name) => !matched.includes(name));
  const matchRatio = producerNames.length === 0 ? 0 : matched.length / producerNames.length;

  let finding: EntityValidationFinding | null = null;

  if (producerNames.length > 2 && matchRatio < 0.7) {
    finding = {
      key: "multi_business_pack",
      title: "Documents may belong to multiple businesses",
      severity: "high",
      status: "fail",
      message:
        "The uploaded document pack appears to contain records for multiple businesses or unrelated entities. We cannot reliably assess one business from this pack.",
      recommended_action: "Remove documents that do not belong to this business and rerun the health check.",
      points: 20
    };
  } else if (unmatched.length >= 1) {
    finding = {
      key: "multi_business_pack",
      title: "Some documents may not match the onboarded business",
      severity: "medium",
      status: "attention_needed",
      message:
        "One or more documents appear to reference different business entities. Review the pack to confirm all files belong to the same business.",
      recommended_action: "Review unfamiliar business names and remove unrelated files before finalising the report.",
      points: 8
    };
  }

  return {
    finding,
    producer_names: producerNames,
    carrier_names: carrierNames,
    destination_names: destinationNames,
    unmatched_producer_names: unmatched,
    match_ratio: matchRatio
  };
}
