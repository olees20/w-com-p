import test from "node:test";
import assert from "node:assert/strict";
import { buildChecksForTest, type ReportDocument } from "@/lib/health-check-report";
import { runCrossDocumentReasoning } from "@/lib/cross-document-reasoning";

const business = {
  id: "b1",
  name: "Bean & Brew Cafe Ltd",
  business_type: "Cafe",
  sites_count: 1,
  produces_food_waste: false,
  produces_hazardous_waste: false
} as const;

const mkDoc = (overrides: Partial<ReportDocument> = {}): ReportDocument => ({
  id: Math.random().toString(36),
  file_name: "doc.pdf",
  document_type: "waste_transfer_note",
  processing_status: "processed",
  processing_error: null,
  ai_risk_level: "low",
  extracted_supplier: "GreenCycle Waste Ltd",
  extracted_date: "2026-03-14",
  extracted_ewc_code: "20 03 01",
  extracted_licence_number: "CBDU123456",
  expiry_date: null,
  waste_type: "Mixed Municipal Waste",
  ai_summary: "ok",
  ai_extracted_json: { missing_fields: [], destination: "Leeds Waste Processing Facility", carrier_name: "GreenCycle Waste Ltd" },
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

test("stale WTN risk suppressed when at least one WTN is recent", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      mkDoc({ file_name: "old-wtn.pdf", extracted_date: "2023-01-10" }),
      mkDoc({ file_name: "recent-wtn.pdf", extracted_date: "2026-03-14" })
    ]
  });
  assert.equal(result.consistency_findings.some((f) => f.key === "stale_wtn"), false);
});

test("supplier evidence passes with invoice+WTN supplier relationship even when contract is draft", () => {
  const checks = buildChecksForTest({
    business,
    docs: [
      mkDoc({ file_name: "wtn.pdf" }),
      mkDoc({ file_name: "invoice.pdf", document_type: "invoice", ai_extracted_json: { missing_fields: [], invoice_issuer: "GreenCycle Waste Ltd", invoice_recipient: "Bean & Brew Cafe Ltd", service_description: "Waste collection" } }),
      mkDoc({ file_name: "contract-draft.pdf", document_type: "contract", ai_summary: "Draft agreement unsigned", ai_extracted_json: { missing_fields: [], contract_status: "draft", supplier: "GreenCycle Waste Ltd" } })
    ]
  });
  const supplier = checks.find((c) => c.check_name === "Supplier/contract evidence present");
  assert.equal(supplier?.result, "pass");
});

