import test from "node:test";
import assert from "node:assert/strict";
import { buildChecksForTest, type ReportDocument } from "@/lib/health-check-report";

const mkDoc = (overrides: Partial<ReportDocument> = {}): ReportDocument => ({
  id: Math.random().toString(36),
  file_name: "doc.pdf",
  document_type: "invoice",
  processing_status: "processed",
  processing_error: null,
  ai_risk_level: "low",
  extracted_supplier: "GreenCycle Waste Ltd",
  extracted_date: "2026-03-14",
  extracted_ewc_code: null,
  extracted_licence_number: null,
  expiry_date: null,
  waste_type: null,
  ai_summary: "Waste service document",
  ai_extracted_json: { missing_fields: [] },
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

test("suppresses WTN child checks when WTN is missing", () => {
  const docs: ReportDocument[] = [
    mkDoc({ file_name: "invoice.pdf", document_type: "invoice" }),
    mkDoc({
      file_name: "carrier-licence.pdf",
      document_type: "carrier_licence",
      expiry_date: "2027-04-01",
      extracted_licence_number: "CBDU123456",
      ai_extracted_json: { missing_fields: [], carrier_name: "GreenCycle Waste Ltd", licence_number: "CBDU123456" }
    }),
    mkDoc({
      file_name: "contract.pdf",
      document_type: "contract",
      ai_extracted_json: {
        missing_fields: [],
        contract_supplier: "GreenCycle Waste Ltd",
        client_name: "Bean & Brew Cafe Ltd",
        service_description: "Waste collection agreement",
        start_date: "2026-01-01"
      }
    })
  ];

  const checks = buildChecksForTest({
    business: {
      id: "b1",
      name: "Bean & Brew Cafe Ltd",
      business_type: "Cafe",
      sites_count: 1,
      produces_food_waste: true,
      produces_hazardous_waste: false
    },
    docs
  });

  const byName = (name: string) => checks.find((c) => c.check_name === name);

  assert.equal(byName("Waste Transfer Note present")?.result, "fail");
  assert.equal(byName("Waste destination present on WTN where available"), undefined);
  assert.equal(byName("EWC code present on WTN where available"), undefined);
});

