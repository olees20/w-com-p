import test from "node:test";
import assert from "node:assert/strict";
import {
  assessConfidenceForTest,
  computeRelevantExtractionCompletenessForTest,
  type BaselineCheck,
  type ReportAlert,
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
  ai_summary: "Waste collection service evidence",
  ai_extracted_json: {
    missing_fields: [],
    producer_name: "Bean & Brew Cafe Ltd",
    carrier_name: "GreenCycle Waste Ltd",
    destination: "Leeds Waste Processing Facility"
  },
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

const checks: BaselineCheck[] = [
  { check_name: "Waste Transfer Note present", result: "pass", evidence_used: ["wtn"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes" },
  { check_name: "Carrier licence evidence present", result: "pass", evidence_used: ["licence"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers" },
  { check_name: "Carrier licence valid / not expired", result: "pass", evidence_used: ["licence"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/register-renew-waste-carrier-broker-dealer-england" },
  { check_name: "Waste invoice or collection evidence present", result: "pass", evidence_used: ["invoice"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/dispose-business-commercial-waste" },
  { check_name: "Supplier/contract evidence present", result: "pass", evidence_used: ["contract"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/dispose-business-commercial-waste" },
  { check_name: "EWC code present on WTN where available", result: "pass", evidence_used: ["wtn"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes" },
  { check_name: "Waste destination present on WTN where available", result: "pass", evidence_used: ["wtn"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/government/publications/waste-duty-of-care-code-of-practice" },
  { check_name: "Food waste evidence present", result: "pass", evidence_used: ["contract"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/guidance/simpler-recycling-workplace-recycling-in-england" }
];

const alerts: ReportAlert[] = [];

test("clean pack extraction completeness is high", () => {
  const docs: ReportDocument[] = [
    mkDoc(),
    mkDoc({
      file_name: "licence.pdf",
      document_type: "carrier_licence",
      expiry_date: "2027-04-01",
      ai_extracted_json: { missing_fields: [], carrier_name: "GreenCycle Waste Ltd", licence_number: "CBDU123456" }
    }),
    mkDoc({
      file_name: "invoice.pdf",
      document_type: "invoice",
      ai_extracted_json: {
        missing_fields: [],
        invoice_issuer: "GreenCycle Waste Ltd",
        invoice_recipient: "Bean & Brew Cafe Ltd",
        service_description: "General waste and recycling collection"
      }
    }),
    mkDoc({
      file_name: "food-waste-contract.pdf",
      document_type: "contract",
      ai_extracted_json: {
        missing_fields: [],
        contract_supplier: "GreenCycle Waste Ltd",
        client_name: "Bean & Brew Cafe Ltd",
        service_description: "Food waste collection service",
        start_date: "2026-01-01"
      }
    })
  ];

  const completeness = computeRelevantExtractionCompletenessForTest(docs);
  assert.ok(completeness > 0.7);
});

test("clean pack is not low confidence", () => {
  const docs: ReportDocument[] = [
    mkDoc(),
    mkDoc({ file_name: "licence.pdf", document_type: "carrier_licence", expiry_date: "2027-04-01", ai_extracted_json: { missing_fields: [], carrier_name: "GreenCycle Waste Ltd", licence_number: "CBDU123456" } }),
    mkDoc({ file_name: "invoice.pdf", document_type: "invoice", ai_extracted_json: { missing_fields: [], invoice_issuer: "GreenCycle Waste Ltd", invoice_recipient: "Bean & Brew Cafe Ltd", service_description: "General waste and recycling collection" } }),
    mkDoc({ file_name: "food-waste-contract.pdf", document_type: "contract", ai_extracted_json: { missing_fields: [], contract_supplier: "GreenCycle Waste Ltd", client_name: "Bean & Brew Cafe Ltd", service_description: "Food waste collection service", start_date: "2026-01-01" } })
  ];

  const confidence = assessConfidenceForTest({
    checks,
    docs,
    alerts,
    missingDocs: [],
    cannotVerifyCount: 0,
    crossFindings: []
  });

  assert.ok(confidence === "High Confidence" || confidence === "Medium Confidence");
});
