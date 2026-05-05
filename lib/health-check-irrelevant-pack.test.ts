import test from "node:test";
import assert from "node:assert/strict";
import {
  applyIrrelevantOnlyOverridesForTest,
  buildChecksForTest,
  buildUsageSummaryForTest,
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
  assert.equal(score.score, 15);

  const notUsed = classifyNotUsedDocumentsForTest(docs, { produces_hazardous_waste: false });
  assert.equal(notUsed.length, 2);
  assert.ok(notUsed.every((d) => d.reason.toLowerCase().includes("unrelated")));
  const relevance = docs.map((d) => classifyDocumentRelevanceForTest(d));
  assert.equal(relevance[0].relevance_status, "IRRELEVANT_NOT_USED");
  assert.equal(relevance[1].relevance_status, "IRRELEVANT_NOT_USED");
  assert.equal(relevance[0].used_in_assessment, false);
  assert.equal(relevance[1].used_in_assessment, false);
  const summary = buildUsageSummaryForTest(docs);
  assert.equal(summary.irrelevantUnknownDocsCount, 2);
  assert.equal(summary.totalDocs, 2);
  assert.equal(summary.documentsNotUsedCount, 2);
  assert.equal(summary.usedDocumentsCount, 0);
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

test("irrelevant-only override collapses actions/cannot-verify/status messaging", () => {
  const result = applyIrrelevantOnlyOverridesForTest({
    irrelevantOnlyPack: true,
    recommendedActions: ["Upload at least one valid waste transfer note.", "Upload carrier licence evidence."],
    cannotVerify: [
      "2 documents could not be fully interpreted.",
      "2 unsupported files were excluded from the assessment.",
      "Some checks could not be linked to an official source reference."
    ],
    statusReasons: [
      "Baseline evidence checks: 0/5 passed",
      "No major cross-document consistency conflicts detected",
      "No major date/licence conflicts detected",
      "2 uploaded files were excluded because they were not waste compliance evidence."
    ]
  });

  assert.equal(result.recommendedActions.length, 1);
  assert.equal(
    result.recommendedActions[0],
    "Upload waste compliance documents such as WTNs, waste invoices, carrier licence evidence, and food waste collection records."
  );
  assert.equal(result.cannotVerify.length, 1);
  assert.equal(result.cannotVerify[0], "No relevant waste compliance documents were detected in the upload.");
  assert.ok(result.statusReasons.some((line) => line.includes("excluded because they were not waste compliance evidence")));
});
