import test from "node:test";
import assert from "node:assert/strict";
import { assessConfidenceForTest, type BaselineCheck, type ReportAlert, type ReportDocument } from "@/lib/health-check-report";
import type { ConsistencyFinding } from "@/lib/cross-document-reasoning";

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
  waste_type: "Mixed municipal waste",
  ai_summary: "ok",
  ai_extracted_json: { missing_fields: [] },
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

const baseChecks: BaselineCheck[] = [
  { check_name: "Waste Transfer Note present", result: "pass", evidence_used: ["a"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://gov.uk" },
  { check_name: "Carrier licence evidence present", result: "pass", evidence_used: ["b"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://gov.uk" },
  { check_name: "Carrier licence valid / not expired", result: "pass", evidence_used: ["c"], affected_document: null, recommended_action: "No immediate action.", source_reference: "https://gov.uk" }
];

const noAlerts: ReportAlert[] = [];
const noFindings: ConsistencyFinding[] = [];

test("chaotic 25-doc pack is not high confidence", () => {
  const docs: ReportDocument[] = [
    ...Array.from({ length: 10 }, () => mkDoc()),
    ...Array.from({ length: 10 }, () => mkDoc({ document_type: "unknown", ai_extracted_json: { missing_fields: ["x"] } })),
    ...Array.from({ length: 5 }, () => mkDoc({ processing_status: "failed", processing_error: "failed" }))
  ];

  const findings: ConsistencyFinding[] = [
    { key: "conflicting_waste_carriers", title: "Conflicting", severity: "high", status: "fail", message: "x", evidence: ["x"], recommended_action: "x", points: 10, affects_confidence: true }
  ];

  const c = assessConfidenceForTest({ checks: baseChecks, docs, alerts: [{ id: "a", title: "x", description: "x", severity: "high", status: "open", rule_id: null, document_id: null }], missingDocs: ["x"], cannotVerifyCount: 5, crossFindings: findings });
  assert.notEqual(c, "High Confidence");
});

test("clean small pack can be high confidence", () => {
  const docs = [mkDoc(), mkDoc({ document_type: "invoice" }), mkDoc({ document_type: "carrier_licence", expiry_date: "2027-01-01" })];
  const c = assessConfidenceForTest({ checks: baseChecks, docs, alerts: noAlerts, missingDocs: [], cannotVerifyCount: 0, crossFindings: noFindings });
  assert.ok(c === "High Confidence" || c === "Medium Confidence");
});

test("duplicate-heavy and irrelevant-heavy packs downgrade confidence", () => {
  const docs = [
    ...Array.from({ length: 3 }, () => mkDoc()),
    ...Array.from({ length: 3 }, () => mkDoc({ document_type: "unknown" }))
  ];
  const findings: ConsistencyFinding[] = [
    { key: "duplicate_documents", title: "Duplicate", severity: "low", status: "info", message: "x", evidence: ["a", "b", "c"], recommended_action: "x", points: 0, affects_confidence: false }
  ];
  const c = assessConfidenceForTest({ checks: baseChecks, docs, alerts: noAlerts, missingDocs: [], cannotVerifyCount: 0, crossFindings: findings });
  assert.notEqual(c, "High Confidence");
});
