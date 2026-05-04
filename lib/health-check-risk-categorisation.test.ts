import test from "node:test";
import assert from "node:assert/strict";
import { isBusinessRelevantRiskForTest } from "@/lib/health-check-report";

const mkAlert = (title: string, description = "", severity: "low" | "medium" | "high" = "medium") => ({
  id: title,
  title,
  description,
  severity,
  status: "open",
  rule_id: null,
  document_id: null
});

test("irrelevant menu does not appear as key risk", () => {
  assert.equal(isBusinessRelevantRiskForTest(mkAlert("Document requires review", "menu missing fields")), false);
});

test("insurance cert extraction issue does not appear as key risk", () => {
  assert.equal(isBusinessRelevantRiskForTest(mkAlert("Document requires review", "insurance certificate missing EWC code")), false);
});

test("WTN EWC issue appears as key risk", () => {
  assert.equal(isBusinessRelevantRiskForTest(mkAlert("Missing EWC code on WTN")), true);
});

test("carrier conflict appears as key risk", () => {
  assert.equal(isBusinessRelevantRiskForTest(mkAlert("Conflicting waste carriers detected")), true);
});
