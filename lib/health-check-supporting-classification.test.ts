import test from "node:test";
import assert from "node:assert/strict";
import { classifyDocumentRelevanceForTest, classifyNotUsedDocumentsForTest, type ReportDocument } from "@/lib/health-check-report";
import { runCrossDocumentReasoning } from "@/lib/cross-document-reasoning";

const mkUnknownDoc = (file_name: string, ai_summary: string): ReportDocument => ({
  id: Math.random().toString(36),
  file_name,
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
  ai_summary,
  ai_extracted_json: { missing_fields: [] },
  created_at: "2026-05-04T00:00:00Z"
});

test("supporting correspondence is not listed as not-used", () => {
  const docs = [
    mkUnknownDoc("supplier-email.pdf", "Supplier confirmation email for waste collection and licence reference CBDU123456"),
    mkUnknownDoc("insurance.pdf", "Public liability insurance certificate")
  ];
  const notUsed = classifyNotUsedDocumentsForTest(docs, { produces_hazardous_waste: false });
  assert.equal(notUsed.some((d) => d.file_name === "supplier-email.pdf"), false);
  assert.equal(notUsed.some((d) => d.file_name === "insurance.pdf"), true);
});

test("public liability with policy number/expiry is not treated as carrier licence evidence", () => {
  const doc = mkUnknownDoc(
    "public_liability.pdf",
    "PUBLIC LIABILITY INSURANCE CERTIFICATE Policy No: PL-100332 Expiry: 2027-01-01"
  );
  const relevance = classifyDocumentRelevanceForTest(doc);
  assert.equal(relevance.relevance_status, "IRRELEVANT_NOT_USED");
  assert.equal(relevance.used_in_assessment, false);
});

test("menu with prices is not supporting evidence", () => {
  const doc = mkUnknownDoc("menu.pdf", "MENU Latte 3.20 Flat White 3.00 Cake 2.50");
  const relevance = classifyDocumentRelevanceForTest(doc);
  assert.equal(relevance.relevance_status, "IRRELEVANT_NOT_USED");
  assert.equal(relevance.used_in_assessment, false);
});

test("supplier email with CBDU and waste context is supporting evidence", () => {
  const doc = mkUnknownDoc(
    "supplier_email_export.pdf",
    "Supplier confirmation: GreenCycle collects waste weekly. Carrier registration: CBDU123456"
  );
  const relevance = classifyDocumentRelevanceForTest(doc);
  assert.equal(relevance.relevance_status, "SUPPORTING_EVIDENCE");
  assert.equal(relevance.used_in_assessment, true);
});

test("cross-document reasoning marks supporting docs separately from irrelevant", () => {
  const docs = [
    mkUnknownDoc("service-confirmation.pdf", "Service confirmation correspondence for waste collection"),
    mkUnknownDoc("menu.pdf", "Restaurant menu with prices")
  ];
  const result = runCrossDocumentReasoning({
    documents: docs,
    openAlerts: [],
    business: { produces_food_waste: false, produces_hazardous_waste: false }
  });
  assert.equal(result.consistency_findings.some((f) => f.key === "additional_supporting_documents"), false);
  assert.equal(result.consistency_findings.some((f) => f.key === "irrelevant_documents"), false);
});
