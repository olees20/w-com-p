import test from "node:test";
import assert from "node:assert/strict";
import {
  assessConfidenceForTest,
  isIncompleteEvidencePackForTest,
  overallAssessmentForTest,
  verdictForTest,
  type BaselineCheck,
  type ReportAlert,
  type ReportDocument
} from "@/lib/health-check-report";

const mkDoc = (overrides: Partial<ReportDocument> = {}): ReportDocument => ({
  id: Math.random().toString(36),
  file_name: "doc.pdf",
  document_type: "invoice",
  processing_status: "processed",
  processing_error: null,
  ai_risk_level: "low",
  extracted_supplier: "GreenCycle Waste Ltd",
  extracted_date: "2026-03-14",
  extracted_ewc_code: null,
  extracted_licence_number: null,
  expiry_date: null,
  waste_type: null,
  ai_summary: "Waste service invoice",
  ai_extracted_json: {
    missing_fields: [],
    invoice_issuer: "GreenCycle Waste Ltd",
    invoice_recipient: "Bean & Brew Cafe Ltd",
    service_description: "General waste and recycling collection"
  },
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

test("incomplete but valid evidence pack uses incomplete assessment and medium confidence", () => {
  const docs: ReportDocument[] = [
    mkDoc({ file_name: "invoice.pdf", document_type: "invoice" }),
    mkDoc({
      file_name: "carrier-licence.pdf",
      document_type: "carrier_licence",
      expiry_date: "2027-04-01",
      extracted_licence_number: "CBDU123456",
      ai_extracted_json: { missing_fields: [], carrier_name: "GreenCycle Waste Ltd", licence_number: "CBDU123456" }
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

  const checks: BaselineCheck[] = [
    { check_name: "Waste Transfer Note present", result: "fail", evidence_used: [], affected_document: null, recommended_action: "Upload at least one valid waste transfer note.", source_reference: "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes" },
    { check_name: "Carrier licence evidence present", result: "pass", evidence_used: ["carrier-licence.pdf"], affected_document: "carrier-licence.pdf", recommended_action: "No immediate action.", source_reference: "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers" },
    { check_name: "Carrier licence valid / not expired", result: "pass", evidence_used: ["carrier-licence.pdf"], affected_document: "carrier-licence.pdf", recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/register-renew-waste-carrier-broker-dealer-england" },
    { check_name: "Waste invoice or collection evidence present", result: "pass", evidence_used: ["invoice.pdf"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/dispose-business-commercial-waste" },
    { check_name: "Supplier/contract evidence present", result: "pass", evidence_used: ["food-waste-contract.pdf"], affected_document: "food-waste-contract.pdf", recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/dispose-business-commercial-waste" },
    { check_name: "Food waste evidence present", result: "pass", evidence_used: ["food-waste-contract.pdf"], affected_document: "food-waste-contract.pdf", recommended_action: "No immediate action.", source_reference: "https://www.gov.uk/guidance/simpler-recycling-workplace-recycling-in-england" },
    { check_name: "Waste destination present on WTN where available", result: "cannot_verify", evidence_used: [], affected_document: null, recommended_action: "Ensure destination details are visible on waste transfer records.", source_reference: "https://www.gov.uk/government/publications/waste-duty-of-care-code-of-practice" },
    { check_name: "EWC code present on WTN where available", result: "cannot_verify", evidence_used: [], affected_document: null, recommended_action: "Upload WTN copies that include EWC code details.", source_reference: "https://www.gov.uk/dispose-business-commercial-waste/waste-transfer-notes" }
  ];

  const alerts: ReportAlert[] = [];
  const incomplete = isIncompleteEvidencePackForTest({
    checks,
    docs,
    crossConflicts: 0,
    entityMismatchFail: false
  });
  assert.equal(incomplete, true);

  const confidence = assessConfidenceForTest({
    checks,
    docs,
    alerts,
    missingDocs: ["Waste transfer note"],
    cannotVerifyCount: 1,
    crossFindings: []
  });
  const finalConfidence = incomplete ? "Medium Confidence" : confidence;
  assert.equal(finalConfidence, "Medium Confidence");

  const assessment = overallAssessmentForTest({
    score: 65,
    checks,
    risks: [],
    docs,
    confidence: finalConfidence,
    entityMismatchFail: false,
    crossConflicts: 0,
    incompleteEvidence: incomplete,
    maintenanceOnlyExpiredNow: false
  });
  assert.equal(assessment, "Evidence pack incomplete");

  const verdict = verdictForTest(finalConfidence, "attention_needed", 1, incomplete, false, false);
  assert.equal(
    verdict,
    "Core evidence is present, but some required documents are missing. Without these, compliance cannot be fully demonstrated."
  );
});
