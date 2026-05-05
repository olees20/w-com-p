type DuplicateDoc = {
  id: string;
  file_name: string;
  document_type: string | null;
  extracted_supplier: string | null;
  extracted_date: string | null;
  extracted_ewc_code: string | null;
  extracted_licence_number: string | null;
  expiry_date: string | null;
  waste_type: string | null;
  ai_summary: string | null;
  ai_extracted_json: Record<string, unknown> | null;
};

export type DuplicatePair = {
  canonicalId: string;
  duplicateId: string;
  canonicalFile: string;
  duplicateFile: string;
  reason: string;
};

function norm(v: string | null | undefined) {
  return (v ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\blimited\b/g, "ltd")
    .replace(/\bltd\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normDate(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return norm(v);
  return d.toISOString().slice(0, 10);
}

function getJsonText(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function hasCopyFilenameHint(name: string) {
  const n = norm(name);
  return /\bcopy\b|\bduplicate\b|\(\s*1\s*\)|final copy/.test(n);
}

function getHash(doc: DuplicateDoc) {
  const p = doc.ai_extracted_json ?? {};
  const candidates = [
    p.file_hash,
    p.hash,
    p.content_hash,
    p.storage_hash
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim().toLowerCase();
  }
  return "";
}

function invoiceSignature(doc: DuplicateDoc) {
  const p = doc.ai_extracted_json ?? {};
  return {
    number: norm(getJsonText(p, ["invoice_number", "invoice_no", "reference", "ref"])),
    supplier: norm(doc.extracted_supplier ?? getJsonText(p, ["invoice_issuer", "supplier", "provider"])),
    customer: norm(getJsonText(p, ["customer_name", "client_name", "invoice_recipient", "customer", "client"])),
    date: normDate(doc.extracted_date ?? getJsonText(p, ["invoice_date", "document_date"])),
    services: norm(getJsonText(p, ["service_lines", "line_items", "service_description", "description"])),
    amount: norm(getJsonText(p, ["total_amount", "amount_due", "total"]))
  };
}

function wtnSignature(doc: DuplicateDoc) {
  const p = doc.ai_extracted_json ?? {};
  return {
    producer: norm(getJsonText(p, ["producer_name", "customer_name", "client_name", "producer", "waste_producer"])),
    carrier: norm(doc.extracted_supplier ?? getJsonText(p, ["carrier_name", "waste_carrier", "registered_carrier", "collector", "transferee"])),
    licence: norm(doc.extracted_licence_number ?? getJsonText(p, ["licence_number", "carrier_licence_number", "registration_number"])),
    date: normDate(doc.extracted_date ?? getJsonText(p, ["transfer_date", "document_date"])),
    ewc: norm(doc.extracted_ewc_code ?? getJsonText(p, ["ewc_code"])),
    waste: norm(doc.waste_type ?? getJsonText(p, ["waste_type"])),
    destination: norm(getJsonText(p, ["destination", "destination_name", "waste_destination", "disposal_site", "receiving_facility", "treatment_facility"]))
  };
}

function carrierLicenceSignature(doc: DuplicateDoc) {
  const p = doc.ai_extracted_json ?? {};
  return {
    carrier: norm(doc.extracted_supplier ?? getJsonText(p, ["carrier_name", "waste_carrier", "registered_carrier", "supplier"])),
    licence: norm(doc.extracted_licence_number ?? getJsonText(p, ["licence_number", "carrier_licence_number", "registration_number"])),
    expiry: normDate(doc.expiry_date ?? getJsonText(p, ["expiry_date"]))
  };
}

function contractSignature(doc: DuplicateDoc) {
  const p = doc.ai_extracted_json ?? {};
  return {
    supplier: norm(doc.extracted_supplier ?? getJsonText(p, ["supplier", "provider", "contract_supplier"])),
    customer: norm(getJsonText(p, ["customer_name", "client_name", "customer", "client"])),
    service: norm(getJsonText(p, ["service_description", "services", "description"])),
    start: normDate(getJsonText(p, ["start_date", "contract_start_date"])),
    status: norm(getJsonText(p, ["contract_status", "status"]))
  };
}

function sameInvoice(a: DuplicateDoc, b: DuplicateDoc) {
  const sa = invoiceSignature(a);
  const sb = invoiceSignature(b);
  if (sa.number && sb.number && sa.number === sb.number) return true;
  const strong =
    sa.supplier && sa.customer && sa.date && sa.services &&
    sa.supplier === sb.supplier &&
    sa.customer === sb.customer &&
    sa.date === sb.date &&
    sa.services === sb.services;
  if (strong) return true;
  if (hasCopyFilenameHint(b.file_name) || hasCopyFilenameHint(a.file_name)) {
    return sa.supplier === sb.supplier && sa.customer === sb.customer && sa.date === sb.date && (!!sa.number ? sa.number === sb.number : true);
  }
  return false;
}

function sameWtn(a: DuplicateDoc, b: DuplicateDoc) {
  const sa = wtnSignature(a);
  const sb = wtnSignature(b);
  return (
    sa.producer === sb.producer &&
    sa.carrier === sb.carrier &&
    sa.licence === sb.licence &&
    sa.date === sb.date &&
    sa.ewc === sb.ewc &&
    sa.waste === sb.waste &&
    sa.destination === sb.destination
  );
}

function sameCarrierLicence(a: DuplicateDoc, b: DuplicateDoc) {
  const sa = carrierLicenceSignature(a);
  const sb = carrierLicenceSignature(b);
  return sa.carrier === sb.carrier && sa.licence === sb.licence && sa.expiry === sb.expiry;
}

function sameContract(a: DuplicateDoc, b: DuplicateDoc) {
  const sa = contractSignature(a);
  const sb = contractSignature(b);
  return sa.supplier === sb.supplier && sa.customer === sb.customer && sa.service === sb.service && sa.start === sb.start && sa.status === sb.status;
}

function isDuplicatePair(a: DuplicateDoc, b: DuplicateDoc) {
  if ((a.document_type ?? "") !== (b.document_type ?? "")) return false;
  const hashA = getHash(a);
  const hashB = getHash(b);
  if (hashA && hashB && hashA === hashB) return true;

  switch (a.document_type) {
    case "invoice":
      return sameInvoice(a, b);
    case "waste_transfer_note":
      return sameWtn(a, b);
    case "carrier_licence":
      return sameCarrierLicence(a, b);
    case "contract":
      return sameContract(a, b);
    default:
      return false;
  }
}

export function detectDuplicateDocuments<T extends DuplicateDoc>(docs: T[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < docs.length; i += 1) {
    const a = docs[i];
    for (let j = i + 1; j < docs.length; j += 1) {
      const b = docs[j];
      if (!isDuplicatePair(a, b)) continue;
      pairs.push({
        canonicalId: a.id,
        duplicateId: b.id,
        canonicalFile: a.file_name,
        duplicateFile: b.file_name,
        reason: `${b.file_name} appears to duplicate ${a.file_name}`
      });
    }
  }
  return pairs;
}

export function dedupeCanonicalDocuments<T extends DuplicateDoc>(docs: T[]) {
  const pairs = detectDuplicateDocuments(docs);
  const duplicateIds = new Set(pairs.map((p) => p.duplicateId));
  return {
    canonical: docs.filter((d) => !duplicateIds.has(d.id)),
    duplicatePairs: pairs,
    duplicateIds
  };
}
