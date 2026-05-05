import test from "node:test";
import assert from "node:assert/strict";
import { detectDuplicateDocuments } from "@/lib/document-duplicates";

const mk = (overrides: Partial<{
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
}> = {}) => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  file_name: overrides.file_name ?? "doc.pdf",
  document_type: overrides.document_type ?? "invoice",
  extracted_supplier: overrides.extracted_supplier ?? null,
  extracted_date: overrides.extracted_date ?? null,
  extracted_ewc_code: overrides.extracted_ewc_code ?? null,
  extracted_licence_number: overrides.extracted_licence_number ?? null,
  expiry_date: overrides.expiry_date ?? null,
  waste_type: overrides.waste_type ?? null,
  ai_summary: overrides.ai_summary ?? null,
  ai_extracted_json: overrides.ai_extracted_json ?? {}
});

test("same supplier different invoice date is not duplicate", () => {
  const docs = [
    mk({ id: "a", file_name: "invoice_1.pdf", extracted_supplier: "GreenCycle", extracted_date: "2026-04-01", ai_extracted_json: { invoice_number: "INV-1", client_name: "Bean", service_lines: "General waste" } }),
    mk({ id: "b", file_name: "invoice_2.pdf", extracted_supplier: "GreenCycle", extracted_date: "2026-04-08", ai_extracted_json: { invoice_number: "INV-2", client_name: "Bean", service_lines: "General waste" } })
  ];
  assert.equal(detectDuplicateDocuments(docs).length, 0);
});

test("same supplier different invoice number is not duplicate", () => {
  const docs = [
    mk({ id: "a", file_name: "invoice_a.pdf", extracted_supplier: "GreenCycle", extracted_date: "2026-04-01", ai_extracted_json: { invoice_number: "INV-1", client_name: "Bean", service_lines: "General waste" } }),
    mk({ id: "b", file_name: "invoice_b.pdf", extracted_supplier: "GreenCycle", extracted_date: "2026-04-01", ai_extracted_json: { invoice_number: "INV-2", client_name: "Bean", service_lines: "General waste" } })
  ];
  assert.equal(detectDuplicateDocuments(docs).length, 0);
});

test("same invoice number + same supplier/customer is duplicate even if one side has partial extraction", () => {
  const docs = [
    mk({
      id: "a",
      file_name: "invoice_april.pdf",
      extracted_supplier: "EcoLoop Waste Services Ltd",
      extracted_date: "2026-04-26",
      ai_summary: "Invoice EL-90199 for Copper Kettle Bistro Ltd",
      ai_extracted_json: {
        customer_name: "Copper Kettle Bistro Ltd",
        service_lines: ""
      }
    }),
    mk({
      id: "b",
      file_name: "invoice_april_copy.pdf",
      extracted_supplier: "EcoLoop Waste Services Ltd",
      extracted_date: "2026-04-26",
      ai_summary: "Invoice No: EL-90199",
      ai_extracted_json: {
        customer_name: "Copper Kettle Bistro Ltd",
        service_lines: "General Waste Collection; Dry Mixed Recycling; Food Waste Caddy"
      }
    })
  ];
  assert.equal(detectDuplicateDocuments(docs).length, 1);
});

test("filename copy + same supplier/customer/date is duplicate", () => {
  const docs = [
    mk({ id: "a", file_name: "invoice_april.pdf", extracted_supplier: "EcoLoop", extracted_date: "2026-04-26", ai_extracted_json: { customer_name: "Copper Kettle" } }),
    mk({ id: "b", file_name: "invoice_april_copy.pdf", extracted_supplier: "EcoLoop", extracted_date: "2026-04-26", ai_extracted_json: { customer_name: "Copper Kettle" } })
  ];
  assert.equal(detectDuplicateDocuments(docs).length, 1);
});

test("copy filename with different invoice number/date is not duplicate", () => {
  const docs = [
    mk({ id: "a", file_name: "invoice_april.pdf", extracted_supplier: "GreenCycle", extracted_date: "2026-04-01", ai_extracted_json: { invoice_number: "INV-1", client_name: "Bean", service_lines: "General waste" } }),
    mk({ id: "b", file_name: "invoice_april_copy.pdf", extracted_supplier: "GreenCycle", extracted_date: "2026-04-08", ai_extracted_json: { invoice_number: "INV-2", client_name: "Bean", service_lines: "General waste" } })
  ];
  assert.equal(detectDuplicateDocuments(docs).length, 0);
});

test("exact same WTN fields is duplicate", () => {
  const docs = [
    mk({ id: "a", file_name: "wtn.pdf", document_type: "waste_transfer_note", extracted_supplier: "GreenCycle", extracted_date: "2026-04-01", extracted_licence_number: "CBDU1", extracted_ewc_code: "20 03 01", waste_type: "Mixed", ai_extracted_json: { producer_name: "Bean", destination: "Leeds" } }),
    mk({ id: "b", file_name: "wtn_copy.pdf", document_type: "waste_transfer_note", extracted_supplier: "GreenCycle", extracted_date: "2026-04-01", extracted_licence_number: "CBDU1", extracted_ewc_code: "20 03 01", waste_type: "Mixed", ai_extracted_json: { producer_name: "Bean", destination: "Leeds" } })
  ];
  assert.equal(detectDuplicateDocuments(docs).length, 1);
});

test("same carrier licence uploaded twice is duplicate", () => {
  const docs = [
    mk({ id: "a", file_name: "licence.pdf", document_type: "carrier_licence", extracted_supplier: "GreenCycle", extracted_licence_number: "CBDU1", expiry_date: "2027-04-01" }),
    mk({ id: "b", file_name: "licence_copy.pdf", document_type: "carrier_licence", extracted_supplier: "GreenCycle", extracted_licence_number: "CBDU1", expiry_date: "2027-04-01" })
  ];
  assert.equal(detectDuplicateDocuments(docs).length, 1);
});
