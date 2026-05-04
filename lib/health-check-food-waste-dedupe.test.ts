import test from "node:test";
import assert from "node:assert/strict";
import { dedupeRisksForTest, type ReportAlert } from "@/lib/health-check-report";

test("dedupes food waste missing risks and keeps highest severity", () => {
  const risks: ReportAlert[] = [
    {
      id: "a",
      title: "Food waste documentation missing",
      description: "Based on the business profile, food waste evidence was expected but not found in the uploaded documents.",
      severity: "high",
      status: "open",
      rule_id: "food_waste_missing",
      document_id: null
    },
    {
      id: "b",
      title: "Food waste documentation missing",
      description: "Food waste documentation appears missing.",
      severity: "medium",
      status: "open",
      rule_id: "food_waste_separation",
      document_id: null
    }
  ];

  const deduped = dedupeRisksForTest(risks);
  const foodWaste = deduped.filter((r) => (r.rule_id ?? "") === "food_waste_evidence_missing");
  assert.equal(foodWaste.length, 1);
  assert.equal(foodWaste[0]?.severity, "high");
});

