import assert from "node:assert/strict";
import test from "node:test";
import { extractDestinationFromEvidenceForTest } from "@/lib/health-check-report";

test("extracts destination from raw WTN text fixture", () => {
  const destination = extractDestinationFromEvidenceForTest({
    ai_summary: null,
    ai_extracted_json: {
      raw_text_excerpt: `Waste: Mixed Municipal Waste\nEWC Code: 20 03 01\nQuantity: 3 x 240L bins weekly\nDate: 14 March 2026\nCarrier: GreenCycle Waste Ltd\nLicence: CBDU123456\nDestination: Leeds Waste Processing Facility`
    } as unknown as { missing_fields?: string[] }
  });

  assert.equal(destination, "Leeds Waste Processing Facility");
});
