import test from "node:test";
import assert from "node:assert/strict";
import { classifyNotUsedDocumentsForTest, type ReportDocument } from "@/lib/health-check-report";

const mkDoc = (overrides: Partial<ReportDocument>): ReportDocument => ({
  id: Math.random().toString(36),
  file_name: "doc.pdf",
  document_type: "unknown",
  processing_status: "processed",
  processing_error: null,
  ai_risk_level: "low",
  extracted_supplier: null,
  extracted_date: null,
  extracted_ewc_code: null,
  extracted_licence_number: null,
  expiry_date: null,
  waste_type: null,
  ai_summary: null,
  ai_extracted_json: null,
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

test("menu.pdf is classified as unrelated to waste compliance", () => {
  const result = classifyNotUsedDocumentsForTest([mkDoc({ file_name: "menu.pdf" })], { produces_hazardous_waste: false });
  assert.equal(result[0]?.reason, "Unrelated to waste compliance");
  assert.equal(result[0]?.recommended_action, null);
});

test("public liability insurance is classified as unrelated", () => {
  const result = classifyNotUsedDocumentsForTest([mkDoc({ file_name: "public liability insurance.pdf" })], { produces_hazardous_waste: false });
  assert.equal(result[0]?.reason, "Unrelated to waste compliance");
});

test("failed hazardous consignment note is potentially relevant but unreadable when hazardous applies", () => {
  const result = classifyNotUsedDocumentsForTest(
    [
      mkDoc({
        file_name: "incomplete hazardous consignment note.pdf",
        processing_status: "failed",
        processing_error: "No text could be extracted"
      })
    ],
    { produces_hazardous_waste: true }
  );
  assert.equal(result[0]?.reason, "Potentially relevant but unreadable");
  assert.equal(result[0]?.recommended_action, "Re-upload a clearer copy if hazardous waste applies to this business.");
});

