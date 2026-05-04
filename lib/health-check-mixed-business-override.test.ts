import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMixedBusinessRiskOverrideForTest,
  mixedBusinessPrimaryActionsForTest,
  mixedBusinessScoreReliabilityNoteForTest,
  scoreReliabilityNoteForTest,
  type ReportAlert
} from "@/lib/health-check-report";

const mkRisk = (overrides: Partial<ReportAlert>): ReportAlert => ({
  id: Math.random().toString(36),
  title: "Risk",
  description: null,
  severity: "medium",
  status: "open",
  rule_id: null,
  document_id: null,
  ...overrides
});

test("mixed-business primary actions are fixed and limited to 3", () => {
  const actions = mixedBusinessPrimaryActionsForTest();
  assert.equal(actions.length, 3);
  assert.equal(actions[0], "Remove documents that do not belong to this business and rerun the health check.");
});

test("carrier conflict is downgraded and non-priority risks are suppressed in mixed-business mode", () => {
  const risks = [
    mkRisk({ title: "Documents may belong to multiple businesses", rule_id: "multi_business_pack", severity: "high" }),
    mkRisk({ title: "Conflicting waste carriers detected", rule_id: "conflicting_waste_carriers", severity: "high" }),
    mkRisk({ title: "Future-dated waste documents detected", rule_id: "future_dated_documents", severity: "medium" }),
    mkRisk({ title: "WTN evidence appears stale", rule_id: "stale_wtn", severity: "medium" }),
    mkRisk({ title: "Some processing failed", rule_id: "processing_issue", severity: "medium" }),
    mkRisk({ title: "Low value downstream detail", rule_id: "other_detail", severity: "medium" })
  ];

  const result = applyMixedBusinessRiskOverrideForTest(risks);
  assert.ok(result.length <= 4);
  const carrier = result.find((r) => (r.rule_id ?? "").toLowerCase() === "conflicting_waste_carriers");
  if (carrier) {
    assert.equal(carrier.severity, "low");
    assert.match(carrier.description ?? "", /may be caused by mixed-business documents/i);
  }
  assert.ok(result.some((r) => (r.rule_id ?? "").toLowerCase() === "multi_business_pack"));
  assert.ok(!result.some((r) => (r.rule_id ?? "").toLowerCase() === "other_detail"));
});

test("score reliability warning appears only for mixed-business packs", () => {
  assert.equal(scoreReliabilityNoteForTest(true), mixedBusinessScoreReliabilityNoteForTest());
  assert.equal(scoreReliabilityNoteForTest(false), null);
});
