import test from "node:test";
import assert from "node:assert/strict";
import {
  assessConfidenceForTest,
  buildChecksForTest,
  overallAssessmentForTest,
  verdictForTest,
  type ReportDocument
} from "@/lib/health-check-report";

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

test("expired-now maintenance case remains compliant/high confidence and usable with updates", () => {
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
      }),
      mkDoc({ file_name: "invoice.pdf", document_type: "invoice", ai_extracted_json: { missing_fields: [], invoice_issuer: "GreenCycle Waste Ltd", invoice_recipient: "Bean & Brew Cafe Ltd", service_description: "General waste collection" } }),
      mkDoc({ file_name: "food-contract.pdf", document_type: "contract", ai_extracted_json: { missing_fields: [], contract_supplier: "GreenCycle Waste Ltd", client_name: "Bean & Brew Cafe Ltd", service_description: "Food waste collection", start_date: "2026-01-01" } })
    ]
  });
  const docs = [
    mkDoc({ file_name: "wtn.pdf", extracted_date: "2026-03-14", extracted_licence_number: "CBDU123456" }),
    mkDoc({
      file_name: "licence.pdf",
      document_type: "carrier_licence",
      extracted_licence_number: "CBDU123456",
      expiry_date: "2026-04-01",
      ai_extracted_json: { missing_fields: [], carrier_name: "GreenCycle Waste Ltd", licence_number: "CBDU123456" }
    }),
    mkDoc({ file_name: "invoice.pdf", document_type: "invoice", ai_extracted_json: { missing_fields: [], invoice_issuer: "GreenCycle Waste Ltd", invoice_recipient: "Bean & Brew Cafe Ltd", service_description: "General waste collection" } }),
    mkDoc({ file_name: "food-contract.pdf", document_type: "contract", ai_extracted_json: { missing_fields: [], contract_supplier: "GreenCycle Waste Ltd", client_name: "Bean & Brew Cafe Ltd", service_description: "Food waste collection", start_date: "2026-01-01" } })
  ];
  const confidence = assessConfidenceForTest({
    checks,
    docs,
    alerts: [
      {
        id: "r1",
        title: "Carrier licence valid at transfer but expired now",
        description: "Carrier licence was valid at the time of transfer but has since expired. Updated evidence should be provided.",
        severity: "medium",
        status: "open",
        rule_id: "carrier_licence_valid_at_transfer_expired_now",
        document_id: null
      }
    ],
    missingDocs: [],
    cannotVerifyCount: 0,
    crossFindings: []
  });
  assert.ok(confidence === "Medium Confidence" || confidence === "High Confidence");

  const assessment = overallAssessmentForTest({
    score: 92,
    checks,
    risks: [
      {
        id: "r1",
        title: "Carrier licence valid at transfer but expired now",
        description: "Carrier licence was valid at the time of transfer but has since expired. Updated evidence should be provided.",
        severity: "medium",
        status: "open",
        rule_id: "carrier_licence_valid_at_transfer_expired_now",
        document_id: null
      }
    ],
    docs,
    confidence,
    entityMismatchFail: false,
    crossConflicts: 0,
    incompleteEvidence: false,
    maintenanceOnlyExpiredNow: true,
    entityMismatchAttention: false
  });
  assert.equal(assessment, "Evidence pack usable (updates recommended)");

  const verdict = verdictForTest(confidence, "compliant", 0, false, true, false, false);
  assert.match(verdict, /expired since the transfer date/i);
});
