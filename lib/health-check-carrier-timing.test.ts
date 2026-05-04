import test from "node:test";
import assert from "node:assert/strict";
import { buildChecksForTest, type ReportDocument } from "@/lib/health-check-report";

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
  ai_extracted_json: { missing_fields: [] },
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

const business = {
  id: "b1",
  name: "Bean & Brew Cafe Ltd",
  business_type: "Cafe",
  sites_count: 1,
  produces_food_waste: true,
  produces_hazardous_waste: false
} as const;

test("carrier licence invalid at transfer returns fail", () => {
  const checks = buildChecksForTest({
    business,
    docs: [
      mkDoc({ file_name: "wtn.pdf", extracted_date: "2026-03-14", extracted_licence_number: "CBDU123456" }),
      mkDoc({
        file_name: "licence.pdf",
        document_type: "carrier_licence",
        extracted_licence_number: "CBDU123456",
        expiry_date: "2026-03-01",
        ai_extracted_json: { missing_fields: [], carrier_name: "GreenCycle Waste Ltd", licence_number: "CBDU123456" }
      })
    ]
  });
  const carrier = checks.find((c) => c.check_name === "Carrier licence valid / not expired");
  assert.equal(carrier?.result, "fail");
});

test("carrier licence valid at transfer but expired now returns attention_needed", () => {
  const checks = buildChecksForTest({
    business,
    docs: [
      mkDoc({ file_name: "wtn.pdf", extracted_date: "2026-03-14", extracted_licence_number: "CBDU123456" }),
      mkDoc({
        file_name: "licence.pdf",
        document_type: "carrier_licence",
        extracted_licence_number: "CBDU123456",
        expiry_date: "2026-04-01",
        ai_extracted_json: { missing_fields: [], carrier_name: "GreenCycle Waste Ltd", licence_number: "CBDU123456" }
      })
    ]
  });
  const carrier = checks.find((c) => c.check_name === "Carrier licence valid / not expired");
  assert.equal(carrier?.result, "attention_needed");
});

