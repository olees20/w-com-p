import test from "node:test";
import assert from "node:assert/strict";
import { buildChecksForTest, scoreFromChecksForTest, type ReportDocument } from "@/lib/health-check-report";

const business = {
  id: "b1",
  name: "Bean & Brew Cafe Ltd",
  business_type: "Cafe",
  sites_count: 1,
  produces_food_waste: true,
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
  ai_summary: "General waste transfer",
  ai_extracted_json: { missing_fields: [], producer_name: "Bean & Brew Cafe Ltd", carrier_name: "GreenCycle Waste Ltd", destination: "Leeds Waste Processing Facility" },
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

test("pack 04: missing food waste evidence is primary issue with fallback source and no supplier-contract penalty", () => {
  const docs: ReportDocument[] = [
    mkDoc({ file_name: "wtn.pdf" }),
    mkDoc({
      file_name: "licence.pdf",
      document_type: "carrier_licence",
      expiry_date: "2027-04-01",
      ai_extracted_json: { missing_fields: [], carrier_name: "GreenCycle Waste Ltd", licence_number: "CBDU123456" }
    }),
    mkDoc({
      file_name: "invoice.pdf",
      document_type: "invoice",
      ai_summary: "General waste and recycling collection invoice",
      ai_extracted_json: {
        missing_fields: [],
        invoice_issuer: "GreenCycle Waste Ltd",
        invoice_recipient: "Bean & Brew Cafe Ltd",
        service_description: "General waste and recycling collection"
      }
    })
  ];

  const checks = buildChecksForTest({ business, docs });
  const foodCheck = checks.find((c) => c.check_name === "Food waste evidence present");
  assert.equal(foodCheck?.result, "fail");
  assert.equal(
    foodCheck?.source_reference,
    "https://www.gov.uk/guidance/simpler-recycling-workplace-recycling-in-england"
  );

  const supplierCheck = checks.find((c) => c.check_name === "Supplier/contract evidence present");
  assert.equal(supplierCheck?.result, "attention_needed");
  assert.equal(supplierCheck?.recommended_action, "No immediate action.");

  const score = scoreFromChecksForTest({ checks, docs, business });
  assert.ok(score.score <= 80 && score.score >= 70);
  assert.ok(score.breakdown.deductions.some((d) => d.reason === "Missing food waste evidence"));
  assert.ok(!score.breakdown.deductions.some((d) => d.reason === "Missing supplier contract evidence"));
});

