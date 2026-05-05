import test from "node:test";
import assert from "node:assert/strict";
import { validateSingleBusinessPack } from "@/lib/entity-pack-validation";
import { applyEntityMismatchOutcomeForTest, overallAssessmentForTest, type ReportDocument } from "@/lib/health-check-report";

const mkDoc = (overrides: Partial<ReportDocument>): ReportDocument => ({
  id: Math.random().toString(36).slice(2),
  file_name: "doc.pdf",
  document_type: "invoice",
  processing_status: "processed",
  processing_error: null,
  ai_risk_level: "low",
  extracted_supplier: "EcoLoop Waste Services Ltd",
  extracted_date: "2026-04-26",
  extracted_ewc_code: null,
  extracted_licence_number: null,
  expiry_date: null,
  waste_type: null,
  ai_summary: "invoice",
  ai_extracted_json: {
    customer_name: "Copper Kettle Holdings Ltd",
    invoice_issuer: "EcoLoop Waste Services Ltd",
    document_type: "invoice",
    missing_fields: []
  },
  created_at: "2026-05-05T00:00:00.000Z",
  ...overrides
});

test("entity mismatch at 0% match ratio creates high mismatch finding and strong deduction", () => {
  const docs: ReportDocument[] = [
    mkDoc({ file_name: "invoice_april.pdf" }),
    mkDoc({
      file_name: "wtn.pdf",
      document_type: "waste_transfer_note",
      extracted_licence_number: "CBDU123456",
      ai_extracted_json: {
        producer_name: "Copper Kettle Holdings Ltd",
        carrier_name: "EcoLoop Waste Services Ltd",
        destination: "Leeds Waste Processing Facility",
        document_type: "waste_transfer_note",
        missing_fields: []
      }
    })
  ];

  const result = validateSingleBusinessPack({
    onboardedBusinessName: "Copper Kettle Bistro Ltd",
    documents: docs
  });

  assert.equal(result.match_ratio, 0);
  assert.equal(result.finding?.key, "document_entity_mismatch");
  assert.equal(result.finding?.severity, "high");
  assert.equal(result.finding?.status, "attention_needed");
  assert.ok((result.finding?.points ?? 0) >= 15);
});

test("entity mismatch forces status to attention_needed and confidence to medium from otherwise compliant/high", () => {
  const outcome = applyEntityMismatchOutcomeForTest({
    status: "compliant",
    confidence: "High Confidence",
    entityMismatchAttention: true
  });
  assert.equal(outcome.status, "attention_needed");
  assert.equal(outcome.confidence, "Medium Confidence");
});

test("overall assessment uses business name mismatch wording", () => {
  const text = overallAssessmentForTest({
    score: 80,
    checks: [],
    risks: [],
    docs: [],
    confidence: "Medium Confidence",
    entityMismatchFail: false,
    crossConflicts: 0,
    incompleteEvidence: false,
    maintenanceOnlyExpiredNow: false,
    entityMismatchAttention: true
  });
  assert.equal(text, "Evidence pack needs review (business name mismatch detected)");
});

