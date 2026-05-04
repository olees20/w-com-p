import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChecksForTest,
  classifyDocumentRelevanceForTest,
  classifyNotUsedDocumentsForTest,
  computeRelevantExtractionCompletenessForTest,
  scoreFromChecksForTest,
  type ReportDocument
} from "@/lib/health-check-report";

const mkIrrelevant = (file_name: string, summary: string): ReportDocument => ({
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
  ai_summary: summary,
  ai_extracted_json: { missing_fields: [] },
  created_at: "2026-05-04T00:00:00Z"
});

test("all-irrelevant pack marks docs as not used and fails baseline evidence checks", () => {
  const docs = [
    mkIrrelevant("public_liability.pdf", "PUBLIC LIABILITY INSURANCE CERTIFICATE"),
    mkIrrelevant("menu.pdf", "Restaurant Menu")
  ];
  const checks = buildChecksForTest({
    business: {
      id: "b1",
      name: "Bean & Brew Cafe Ltd",
      business_type: "Cafe",
      sites_count: 1,
      produces_food_waste: false,
      produces_hazardous_waste: false
    },
    docs
  });
  const byName = (name: string) => checks.find((c) => c.check_name === name);
  assert.equal(byName("Waste Transfer Note present")?.result, "fail");
  assert.equal(byName("Carrier licence evidence present")?.result, "fail");
  assert.equal(byName("Waste invoice or collection evidence present")?.result, "fail");
  const score = scoreFromChecksForTest({
    checks,
    docs,
    business: {
      id: "b1",
      name: "Bean & Brew Cafe Ltd",
      business_type: "Cafe",
      sites_count: 1,
      produces_food_waste: false,
      produces_hazardous_waste: false
    }
  });
  assert.ok(score.score <= 20);

  const notUsed = classifyNotUsedDocumentsForTest(docs, { produces_hazardous_waste: false });
  assert.equal(notUsed.length, 2);
  assert.ok(notUsed.every((d) => d.reason.toLowerCase().includes("unrelated")));
  const relevance = docs.map((d) => classifyDocumentRelevanceForTest(d));
  assert.equal(relevance[0].relevance_status, "IRRELEVANT_NOT_USED");
  assert.equal(relevance[1].relevance_status, "IRRELEVANT_NOT_USED");
  assert.equal(relevance[0].used_in_assessment, false);
  assert.equal(relevance[1].used_in_assessment, false);
});

test("irrelevant content is excluded even when document_type looks like primary evidence", () => {
  const docs: ReportDocument[] = [
    {
      ...mkIrrelevant("public_liability_invoice.pdf", "PUBLIC LIABILITY INSURANCE CERTIFICATE"),
      document_type: "invoice",
      ai_extracted_json: {
        supplier: "InsureCo",
        document_date: "2026-05-01",
        missing_fields: []
      }
    }
  ];

  const checks = buildChecksForTest({
    business: {
      id: "b1",
      name: "Bean & Brew Cafe Ltd",
      business_type: "Cafe",
      sites_count: 1,
      produces_food_waste: false,
      produces_hazardous_waste: false
    },
    docs
  });

  const invoiceCheck = checks.find((c) => c.check_name === "Waste invoice or collection evidence present");
  assert.equal(invoiceCheck?.result, "fail");

  const completeness = computeRelevantExtractionCompletenessForTest(docs);
  assert.equal(completeness, 0);
});
