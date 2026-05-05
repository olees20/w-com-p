import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChecksForTest,
  scoreFromChecksForTest,
  classifyDocumentRelevanceForTest,
  deriveMissingAndUnverifiableForTest,
  type ReportDocument
} from "@/lib/health-check-report";

const mk = (overrides: Partial<ReportDocument>): ReportDocument => ({
  id: Math.random().toString(36).slice(2),
  file_name: "doc.pdf",
  document_type: "unknown",
  processing_status: "review",
  processing_error: "low quality scan",
  ai_risk_level: "medium",
  extracted_supplier: null,
  extracted_date: null,
  extracted_ewc_code: null,
  extracted_licence_number: null,
  expiry_date: null,
  waste_type: null,
  ai_summary: "unreadable",
  ai_extracted_json: { missing_fields: ["supplier", "document_date"] },
  created_at: "2026-05-05T00:00:00.000Z",
  ...overrides
});

test("low quality relevant docs are classified as RELEVANT_UNREADABLE and checks are attention_needed", () => {
  const docs: ReportDocument[] = [
    mk({
      file_name: "low_quality_invoice.pdf",
      document_type: "unknown",
      ai_summary: "Invoice for waste collection - poor scan unreadable",
      ai_extracted_json: { raw_text: "Invoice ... waste collection ... unreadable" }
    }),
    mk({
      file_name: "scanned_wtn_unreadable.pdf",
      document_type: "unknown",
      ai_summary: "Waste transfer note faint scan",
      ai_extracted_json: { raw_text: "waste transfer note ... collection ... unreadable" }
    })
  ];

  const relA = classifyDocumentRelevanceForTest(docs[0]);
  const relB = classifyDocumentRelevanceForTest(docs[1]);
  assert.equal(relA.relevance_status, "RELEVANT_UNREADABLE");
  assert.equal(relB.relevance_status, "RELEVANT_UNREADABLE");

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

  const wtn = checks.find((c) => c.check_name === "Waste Transfer Note present");
  const inv = checks.find((c) => c.check_name === "Waste invoice or collection evidence present");
  assert.equal(wtn?.result, "attention_needed");
  assert.equal(inv?.result, "attention_needed");
  assert.ok((wtn?.recommended_action ?? "").includes("could not be reliably extracted"));

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
  assert.ok(score.score >= 20 && score.score <= 50);

  const derived = deriveMissingAndUnverifiableForTest({
    checks,
    producesFoodWaste: true,
    producesHazardousWaste: false
  });
  assert.ok(!derived.missingDocs.includes("Waste transfer note"));
  assert.ok(!derived.missingDocs.includes("Waste invoice / collection evidence"));
  assert.ok(derived.missingDocs.includes("Carrier licence evidence"));
  assert.ok(derived.unverifiableDocs.includes("Waste transfer note - uploaded but unreadable"));
  assert.ok(derived.unverifiableDocs.includes("Waste invoice / collection evidence - uploaded but unreadable"));
});
