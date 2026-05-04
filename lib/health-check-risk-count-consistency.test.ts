import test from "node:test";
import assert from "node:assert/strict";
import { countHighMediumRisksForTest, type ReportAlert } from "@/lib/health-check-report";

test("risk contributor count is zero when key risks list is empty", () => {
  const topRisks: ReportAlert[] = [];
  assert.equal(countHighMediumRisksForTest(topRisks), 0);
});

test("risk contributor count ignores low/info-only entries", () => {
  const topRisks: ReportAlert[] = [
    {
      id: "1",
      title: "Additional supporting documents identified",
      description: "Context only",
      severity: "low",
      status: "open",
      rule_id: "additional_supporting_documents",
      document_id: null
    }
  ];
  assert.equal(countHighMediumRisksForTest(topRisks), 0);
});

