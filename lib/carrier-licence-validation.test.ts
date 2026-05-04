import test from "node:test";
import assert from "node:assert/strict";
import { validateExtractedDocument } from "@/lib/documents/pipeline";
import { isValidCarrierLicence } from "@/lib/alerts/monitoring";

test("carrier licence with role aliases validates as processed", () => {
  const input = {
    document_type: "carrier_licence",
    supplier: "GreenCycle Waste Ltd",
    carrier_name: "GreenCycle Waste Ltd",
    waste_carrier: "GreenCycle Waste Ltd",
    registered_carrier: "GreenCycle Waste Ltd",
    licence_number: "CBDU123456",
    carrier_licence_number: "CBDU123456",
    registration_number: "CBDU123456",
    expiry_date: "2027-04-01",
    document_date: null,
    waste_type: null,
    ewc_code: null,
    risk_level: "low",
    summary: "Carrier licence evidence",
    missing_fields: []
  } as const;

  const result = validateExtractedDocument(input as never);
  assert.equal(result.status, "processed");
  assert.deepEqual(result.missingFields, []);
});

test("carrier licence evidence is valid with aliases even in review status", () => {
  const doc = {
    id: "1",
    file_name: "carrier_licence.pdf",
    document_type: "carrier_licence",
    extracted_supplier: null,
    extracted_date: null,
    extracted_ewc_code: null,
    extracted_licence_number: null,
    ai_risk_level: "low",
    expiry_date: "2027-04-01",
    waste_type: null,
    ai_summary: null,
    ai_extracted_json: {
      carrier_name: "GreenCycle Waste Ltd",
      carrier_licence_number: "CBDU123456",
      registration_number: "CBDU123456"
    },
    created_at: "2026-05-04T00:00:00Z",
    processing_status: "review"
  } as const;

  assert.equal(isValidCarrierLicence(doc), true);
});

