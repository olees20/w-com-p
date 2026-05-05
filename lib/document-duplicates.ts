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

export type DuplicateComparisonDebug = {
  a_file: string;
  b_file: string;
  document_type: string | null;
  exact_hash_match: boolean;
  filename_copy_signal: boolean;
  invoice_number_match: boolean;
  supplier_match: boolean;
  customer_match: boolean;
  date_match: boolean;
  service_lines_match: boolean;
  final_duplicate_score: number;
  duplicate: boolean;
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
  const invoiceNumberMatch = Boolean(sa.number && sb.number && sa.number === sb.number);
  const supplierMatch = Boolean(sa.supplier && sb.supplier && sa.supplier === sb.supplier);
  const customerMatch = Boolean(sa.customer && sb.customer && sa.customer === sb.customer);
  const dateMatch = Boolean(sa.date && sb.date && sa.date === sb.date);
  const servicesMatch = Boolean(sa.services && sb.services && sa.services === sb.services);
  const copySignal = hasCopyFilenameHint(b.file_name) || hasCopyFilenameHint(a.file_name);

  let score = 0;
  if (invoiceNumberMatch) score += 4;
  if (supplierMatch) score += 1;
  if (customerMatch) score += 1;
  if (dateMatch) score += 1;
  if (servicesMatch) score += 1;
  if (copySignal && supplierMatch && customerMatch && dateMatch) score += 2;

  const duplicate =
    invoiceNumberMatch ||
    (supplierMatch && customerMatch && dateMatch && servicesMatch) ||
    (copySignal && supplierMatch && customerMatch && dateMatch && (invoiceNumberMatch || !sa.number || !sb.number)) ||
    score >= 6;

  return duplicate;
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

function compareInvoiceDebug(a: DuplicateDoc, b: DuplicateDoc): DuplicateComparisonDebug {
  const hashA = getHash(a);
  const hashB = getHash(b);
  const exactHashMatch = Boolean(hashA && hashB && hashA === hashB);
  const copySignal = hasCopyFilenameHint(a.file_name) || hasCopyFilenameHint(b.file_name);
  const sa = invoiceSignature(a);
  const sb = invoiceSignature(b);
  const invoiceNumberMatch = Boolean(sa.number && sb.number && sa.number === sb.number);
  const supplierMatch = Boolean(sa.supplier && sb.supplier && sa.supplier === sb.supplier);
  const customerMatch = Boolean(sa.customer && sb.customer && sa.customer === sb.customer);
  const dateMatch = Boolean(sa.date && sb.date && sa.date === sb.date);
  const servicesMatch = Boolean(sa.services && sb.services && sa.services === sb.services);
  let score = 0;
  if (exactHashMatch) score += 10;
  if (invoiceNumberMatch) score += 4;
  if (supplierMatch) score += 1;
  if (customerMatch) score += 1;
  if (dateMatch) score += 1;
  if (servicesMatch) score += 1;
  if (copySignal && supplierMatch && customerMatch && dateMatch) score += 2;
  const duplicate = exactHashMatch || sameInvoice(a, b);
  return {
    a_file: a.file_name,
    b_file: b.file_name,
    document_type: a.document_type,
    exact_hash_match: exactHashMatch,
    filename_copy_signal: copySignal,
    invoice_number_match: invoiceNumberMatch,
    supplier_match: supplierMatch,
    customer_match: customerMatch,
    date_match: dateMatch,
    service_lines_match: servicesMatch,
    final_duplicate_score: score,
    duplicate
  };
}

export function detectDuplicateDocuments<T extends DuplicateDoc>(docs: T[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  if (process.env.NODE_ENV !== "production") {
    for (const doc of docs) {
      const p = doc.ai_extracted_json ?? {};
      const inv = invoiceSignature(doc);
      console.log("[duplicates][input]", {
        filename: doc.file_name,
        document_type: doc.document_type,
        invoice_number: inv.number || null,
        supplier_or_invoice_issuer: inv.supplier || null,
        customer_or_client: inv.customer || null,
        document_or_invoice_date: inv.date || null,
        service_lines: inv.services || null,
        total_amount: inv.amount || null,
        file_hash: getHash(doc) || null
      });
      void p;
    }
  }
  for (let i = 0; i < docs.length; i += 1) {
    const a = docs[i];
    for (let j = i + 1; j < docs.length; j += 1) {
      const b = docs[j];
      if (process.env.NODE_ENV !== "production" && (a.document_type === "invoice" || b.document_type === "invoice")) {
        const debug = compareInvoiceDebug(a, b);
        if (
          a.file_name.toLowerCase().includes("invoice_april") ||
          b.file_name.toLowerCase().includes("invoice_april")
        ) {
          console.log("[duplicates][pair-debug]", debug);
        }
      }
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
