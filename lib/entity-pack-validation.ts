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
  site_address_names: string[];
  unclear_entity_names: string[];
  unmatched_producer_names: string[];
  match_ratio: number;
};

type CarrierEntityRow = {
  document_id: string;
  document_type: string | null;
  carrier_name: string;
};

const ROLE_PRECEDENCE: Record<EntityRole, number> = {
  carrier_supplier: 5,
  destination_facility: 4,
  producer_customer: 3,
  site_address: 2,
  unclear: 1,
  licence_number: 0
};

export type EntityRole =
  | "producer_customer"
  | "carrier_supplier"
  | "destination_facility"
  | "site_address"
  | "licence_number"
  | "unclear";

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

export function isLikelyAddress(value: string | null | undefined) {
  if (!value) return false;
  const text = value.trim();
  if (!text) return false;
  const postcodePattern = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i;
  const unitPattern = /\bunit\s+[a-z0-9]+\b/i;
  const numericStreetPrefix = /^\s*\d+[a-z]?\s+/i;
  const streetKeywordPattern =
    /\b(street|road|lane|avenue|drive|way|industrial estate|business park|high street|market street|bishopthorpe road|mill road)\b/i;

  if (postcodePattern.test(text)) return true;
  if (unitPattern.test(text)) return true;
  if (numericStreetPrefix.test(text) && streetKeywordPattern.test(text)) return true;
  if (streetKeywordPattern.test(text) && /,/.test(text)) return true;

  return false;
}

function isLikelyFacilityName(value: string | null | undefined) {
  if (!value) return false;
  return /\b(facility|transfer station|processing facility|treatment facility|recycling centre|waste site|landfill)\b/i.test(
    value
  );
}

function extractNamesFromUnknown(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((v) => extractNamesFromUnknown(v));
  return [];
}

function pickRoleNames(payload: Record<string, unknown>, keys: string[]) {
  return unique(keys.flatMap((k) => extractNamesFromUnknown(payload[k])));
}

export function carrierEntitiesForDocument(doc: Pick<ReportDocument, "id" | "document_type" | "extracted_supplier" | "ai_extracted_json">): CarrierEntityRow[] {
  const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;
  const carriers = carrierRoleNames(payload, doc.document_type, doc.extracted_supplier);
  const destinationSet = new Set(destinationRoleNames(payload).map((name) => normalizeName(name)));
  const producerSet = new Set(producerRoleNames(payload).map((name) => normalizeName(name)));
  const siteSet = new Set(siteAddressRoleNames(payload).map((name) => normalizeName(name)));

  return carriers
    .map((carrier) => ({
      document_id: doc.id,
      document_type: doc.document_type,
      carrier_name: carrier
    }))
    .filter((entry) => {
      const n = normalizeName(entry.carrier_name);
      if (!n) return false;
      if (destinationSet.has(n)) return false;
      if (producerSet.has(n)) return false;
      if (siteSet.has(n)) return false;
      return true;
    });
}

export function buildCanonicalCarrierSupplierNames(
  docs: Array<Pick<ReportDocument, "id" | "document_type" | "processing_status" | "extracted_supplier" | "ai_extracted_json">>,
  options?: { onboardedBusinessName?: string | null }
) {
  const processed = docs.filter((d) => d.processing_status === "processed");
  const rows = processed
    .filter((d) => ["waste_transfer_note", "invoice", "carrier_licence", "contract"].includes(d.document_type ?? ""))
    .flatMap((d) => carrierEntitiesForDocument(d));
  const onboarded = normalizeName(options?.onboardedBusinessName);
  const names = unique(
    rows
      .map((row) => row.carrier_name)
      .filter((name) => {
        const n = normalizeName(name);
        if (!n) return false;
        if (onboarded && (n.includes(onboarded) || onboarded.includes(n))) return false;
        return true;
      })
  );
  return { names, rows };
}

function applyEntityRolePrecedence(params: {
  producers: string[];
  carriers: string[];
  destinations: string[];
  siteAddresses: string[];
  unclear: string[];
}) {
  const byNormalized = new Map<
    string,
    {
      display: string;
      role: EntityRole;
    }
  >();

  const add = (values: string[], role: EntityRole) => {
    for (const value of values) {
      const normalized = normalizeName(value);
      if (!normalized) continue;
      const existing = byNormalized.get(normalized);
      if (!existing || ROLE_PRECEDENCE[role] > ROLE_PRECEDENCE[existing.role]) {
        byNormalized.set(normalized, { display: value, role });
      }
    }
  };

  add(params.unclear, "unclear");
  add(params.siteAddresses, "site_address");
  add(params.producers, "producer_customer");
  add(params.destinations, "destination_facility");
  add(params.carriers, "carrier_supplier");

  const entries = Array.from(byNormalized.values());
  return {
    producers: entries.filter((e) => e.role === "producer_customer").map((e) => e.display),
    carriers: entries.filter((e) => e.role === "carrier_supplier").map((e) => e.display),
    destinations: entries.filter((e) => e.role === "destination_facility").map((e) => e.display),
    siteAddresses: entries.filter((e) => e.role === "site_address").map((e) => e.display),
    unclear: entries.filter((e) => e.role === "unclear").map((e) => e.display)
  };
}

export function destinationRoleNames(payload: Record<string, unknown>) {
  const explicitDestinationKeys = [
    "destination",
    "waste_destination",
    "disposal_site",
    "receiving_facility",
    "treatment_facility",
    "transfer_station",
    "waste_processing_facility"
  ];
  const genericFacilityKeys = ["facility", "destination_name", "destination_address"];

  const explicit = pickRoleNames(payload, explicitDestinationKeys).filter((value) => !isLikelyAddress(value) || isLikelyFacilityName(value));
  const generic = pickRoleNames(payload, genericFacilityKeys).filter((value) => isLikelyFacilityName(value));

  return unique([...explicit, ...generic]);
}

export function siteAddressRoleNames(payload: Record<string, unknown>) {
  const explicit = pickRoleNames(payload, ["site_address", "collection_address", "address"]).filter((name) => isLikelyAddress(name));
  const broad = pickRoleNames(payload, [
    "premises",
    "from",
    "collected_from",
    "transfer_address",
    "section_d_transfer_address",
    "current_holder_address"
  ]).filter((name) => isLikelyAddress(name));
  return unique([...explicit, ...broad]);
}

export function producerRoleNames(payload: Record<string, unknown>) {
  return pickRoleNames(payload, [
    "producer_name",
    "customer_name",
    "client_name",
    "current_holder",
    "transferor",
    "site_name",
    "client",
    "customer",
    "producer",
    "waste_producer",
    "premises",
    "collection_point_business",
    "site_business",
    "from",
    "collected_from",
    "business_name",
    "invoice_recipient",
    "recipient"
  ]).filter((name) => !isLikelyAddress(name));
}

export function carrierRoleNames(payload: Record<string, unknown>, documentType: string | null, extractedSupplier: string | null) {
  const explicitCarrierKeysByType: Record<string, string[]> = {
    waste_transfer_note: [
      "carrier_name",
      "carrier",
      "waste_carrier",
      "registered_carrier",
      "collector",
      "transporter",
      "transferee",
      "business_taking_waste",
      "collected_by"
    ],
    invoice: ["invoice_issuer", "issuer", "supplier_name", "supplier", "provider", "contractor", "carrier_name"],
    carrier_licence: ["licensed_business", "carrier_name", "carrier", "waste_carrier", "registered_carrier", "supplier"],
    contract: ["supplier_name", "supplier", "provider", "contractor", "carrier_name", "carrier"]
  };

  const keys = explicitCarrierKeysByType[documentType ?? ""] ?? ["carrier_name", "carrier", "supplier_name", "supplier", "contractor", "provider"];
  const producerSet = new Set(producerRoleNames(payload).map((v) => normalizeName(v)));
  const destinationSet = new Set(destinationRoleNames(payload).map((v) => normalizeName(v)));
  const addressSet = new Set(siteAddressRoleNames(payload).map((v) => normalizeName(v)));

  const explicit = pickRoleNames(payload, keys).filter((name) => {
    const n = normalizeName(name);
    if (!n) return false;
    if (producerSet.has(n)) return false;
    if (destinationSet.has(n)) return false;
    if (addressSet.has(n)) return false;
    return true;
  });
  if (explicit.length) return explicit;

  // fallback is only allowed for roles where extracted supplier is likely to be provider-side
  const allowSupplierFallback = documentType === "carrier_licence" || documentType === "contract";
  if (!allowSupplierFallback) {
    return [];
  }

  // fallback to extracted supplier only when no explicit producer/client role collides
  if (extractedSupplier?.trim()) {
    const supplier = extractedSupplier.trim();
    const normalizedSupplier = normalizeName(supplier);
    if (!producerSet.has(normalizedSupplier) && !destinationSet.has(normalizedSupplier) && !addressSet.has(normalizedSupplier)) {
      return [supplier];
    }
  }
  return [];
}

export function validateSingleBusinessPack(params: {
  onboardedBusinessName: string | null;
  knownSiteNames?: string[];
  documents: ReportDocument[];
}): EntityValidationResult {
  const processed = params.documents.filter((d) => d.processing_status === "processed");
  const producerCandidates: string[] = [];
  const destinationCandidates: string[] = [];
  const siteAddressCandidates: string[] = [];
  const unclearCandidates: string[] = [];
  const canonicalCarriers = buildCanonicalCarrierSupplierNames(params.documents, { onboardedBusinessName: params.onboardedBusinessName });

  for (const doc of processed) {
    const payload = (doc.ai_extracted_json ?? {}) as Record<string, unknown>;

    const rawProducers = pickRoleNames(payload, [
      "producer_name",
      "customer_name",
      "client_name",
      "current_holder",
      "transferor",
      "site_name",
      "client",
      "customer",
      "producer",
      "waste_producer",
      "premises",
      "collection_point_business",
      "site_business",
      "from",
      "collected_from",
      "business_name",
      "invoice_recipient",
      "recipient"
    ]);
    const producers = rawProducers.filter((value) => !isLikelyAddress(value));
    const producerAddresses = rawProducers.filter((value) => isLikelyAddress(value));
    const carriers = carrierEntitiesForDocument(doc).map((row) => row.carrier_name);

    const destinations = destinationRoleNames(payload);

    producerCandidates.push(...producers);
    destinationCandidates.push(...destinations);
    siteAddressCandidates.push(...producerAddresses, ...siteAddressRoleNames(payload));

    const unclearFromPayload = pickRoleNames(payload, ["business_name", "company_name", "organisation_name", "entity_name", "name"]);
    const knownSet = new Set(
      [...producers, ...carriers, ...destinations]
        .map((value) => normalizeName(value))
        .filter(Boolean)
    );
    unclearCandidates.push(
      ...unclearFromPayload.filter((value) => {
        const normalized = normalizeName(value);
        return normalized && !knownSet.has(normalized);
      })
    );
  }

  const precedenceResolved = applyEntityRolePrecedence({
    producers: unique(producerCandidates),
    carriers: canonicalCarriers.names,
    destinations: unique(destinationCandidates),
    siteAddresses: unique(siteAddressCandidates),
    unclear: unique(unclearCandidates)
  });

  const producerNames = unique(precedenceResolved.producers);
  const onboarded = normalizeName(params.onboardedBusinessName);
  const carrierNames = unique(precedenceResolved.carriers);
  const destinationNames = unique(precedenceResolved.destinations);
  const siteAddressNames = unique(precedenceResolved.siteAddresses);
  const unclearEntityNames = unique(precedenceResolved.unclear);

  const normalizedKnownSites = (params.knownSiteNames ?? []).map((name) => normalizeName(name)).filter(Boolean);
  const matched = producerNames.filter((name) => {
    const n = normalizeName(name);
    if (!n) return false;
    const businessMatch = onboarded && (n.includes(onboarded) || onboarded.includes(n));
    const siteMatch = normalizedKnownSites.some((site) => n.includes(site) || site.includes(n));
    return Boolean(businessMatch || siteMatch);
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
    site_address_names: siteAddressNames,
    unclear_entity_names: unclearEntityNames,
    unmatched_producer_names: unmatched,
    match_ratio: matchRatio
  };
}
