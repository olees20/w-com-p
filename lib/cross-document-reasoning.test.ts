import test from "node:test";
import assert from "node:assert/strict";
import { runCrossDocumentReasoning } from "@/lib/cross-document-reasoning";

const baseDoc = {
  processing_status: "processed",
  processing_error: null,
  ai_risk_level: "low",
  extracted_ewc_code: null as string | null,
  expiry_date: null as string | null,
  waste_type: null as string | null,
  ai_summary: null,
  ai_extracted_json: null as { missing_fields?: string[] } | null,
  created_at: "2026-05-01T00:00:00.000Z"
} as const;

test("flags cross-document inconsistencies", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: true, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "1",
        file_name: "cafe_waste_transfer_note.pdf",
        document_type: "waste_transfer_note",
        extracted_supplier: "York Waste Services Ltd",
        extracted_date: "2026-03-14",
        extracted_licence_number: "CBDU123456",
        extracted_ewc_code: "20 03 01",
        waste_type: "Mixed Municipal Waste",
        ai_extracted_json: {
          destination: "Leeds Waste Processing Facility",
          carrier_name: "York Waste Services Ltd",
          producer_name: "Bean & Brew Café Ltd"
        } as unknown as { missing_fields?: string[] }
      },
      {
        ...baseDoc,
        id: "2",
        file_name: "cafe_invoice.pdf",
        document_type: "invoice",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: "2026-03-14",
        extracted_licence_number: null,
        ai_extracted_json: {
          invoice_issuer: "GreenCycle Waste Ltd",
          client_name: "Bean & Brew Café Ltd"
        } as unknown as { missing_fields?: string[] }
      },
      {
        ...baseDoc,
        id: "3",
        file_name: "cafe_licence_expiring.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_licence_number: "CBDU999999",
        expiry_date: "2026-04-01",
        extracted_date: null
      }
    ]
  });

  assert.ok(result.consistency_findings.some((f) => f.key === "conflicting_waste_carriers"));
  assert.ok(result.consistency_findings.some((f) => f.key === "licence_mismatch"));
});

test("expired + valid licence for same carrier is not hard fail", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "1",
        file_name: "wtn.pdf",
        document_type: "waste_transfer_note",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: "2026-03-14",
        extracted_licence_number: "CBDU123456"
      },
      {
        ...baseDoc,
        id: "2",
        file_name: "old-licence.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: null,
        extracted_licence_number: "CBDU123456",
        expiry_date: "2025-04-01"
      },
      {
        ...baseDoc,
        id: "3",
        file_name: "new-licence.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: null,
        extracted_licence_number: "CBDU123456",
        expiry_date: "2027-04-01"
      }
    ]
  });

  assert.ok(!result.consistency_findings.some((f) => f.key === "licence_mismatch"));
});

test("flags internal active/expired inconsistency", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "1",
        file_name: "licence-inconsistent.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: null,
        extracted_licence_number: "CBDU123456",
        expiry_date: "2025-01-01",
        ai_summary: "Status: Active"
      }
    ]
  });

  assert.ok(result.consistency_findings.some((f) => f.key === "licence_internal_inconsistency"));
});

test("valid licence only has no expired-only risk", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "1",
        file_name: "licence-valid.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_licence_number: "CBDU123456",
        extracted_date: null,
        expiry_date: "2027-01-01"
      }
    ]
  });

  assert.ok(!result.consistency_findings.some((f) => f.key === "carrier_licence_expired_only"));
});

test("expired licence only creates high expired risk", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "1",
        file_name: "licence-expired.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_licence_number: "CBDU123456",
        extracted_date: null,
        expiry_date: "2025-01-01"
      }
    ]
  });

  const finding = result.consistency_findings.find((f) => f.key === "carrier_licence_expired_only");
  assert.ok(finding);
  assert.equal(finding?.severity, "high");
});

test("valid + expired shows historic expired evidence, not expired-only", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "1",
        file_name: "licence-old.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_licence_number: "CBDU123456",
        extracted_date: null,
        expiry_date: "2025-01-01"
      },
      {
        ...baseDoc,
        id: "2",
        file_name: "licence-new.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_licence_number: "CBDU123456",
        extracted_date: null,
        expiry_date: "2027-01-01"
      }
    ]
  });

  assert.ok(result.consistency_findings.some((f) => f.key === "historic_expired_licence_uploaded"));
  assert.ok(!result.consistency_findings.some((f) => f.key === "carrier_licence_expired_only"));
});

test("does not treat producer/client names as carriers", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "1",
        file_name: "wtn.pdf",
        document_type: "waste_transfer_note",
        extracted_supplier: "Northgate Bakery Ltd",
        extracted_date: "2026-03-14",
        extracted_licence_number: "CBDU123456",
        ai_extracted_json: {
          producer: "Northgate Bakery Ltd",
          carrier: "GreenCycle Waste Ltd",
          destination: "Leeds Waste Processing Facility"
        } as unknown as { missing_fields?: string[] }
      },
      {
        ...baseDoc,
        id: "2",
        file_name: "invoice.pdf",
        document_type: "invoice",
        extracted_supplier: "Northgate Bakery Ltd",
        extracted_date: "2026-03-14",
        extracted_licence_number: null,
        ai_extracted_json: {
          invoice_issuer: "GreenCycle Waste Ltd",
          client: "Northgate Bakery Ltd"
        } as unknown as { missing_fields?: string[] }
      }
    ]
  });

  assert.ok(!result.consistency_findings.some((f) => f.key === "conflicting_waste_carriers"));
});

test("carrier conflict evidence excludes destination/facility entities", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "1",
        file_name: "01_clean_valid_wtn.pdf",
        document_type: "waste_transfer_note",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: "2026-03-14",
        extracted_licence_number: "CBDU123456",
        ai_extracted_json: {
          producer_name: "Northgate Bakery Ltd",
          carrier_name: "GreenCycle Waste Ltd",
          destination: "Leeds Waste Processing Facility"
        } as unknown as { missing_fields?: string[] }
      },
      {
        ...baseDoc,
        id: "2",
        file_name: "02_wtn_other_carrier.pdf",
        document_type: "waste_transfer_note",
        extracted_supplier: "York Waste Services Ltd",
        extracted_date: "2026-03-14",
        extracted_licence_number: "CBDU555555",
        ai_extracted_json: {
          producer_name: "Northgate Bakery Ltd",
          carrier_name: "York Waste Services Ltd",
          destination: "York Transfer Station"
        } as unknown as { missing_fields?: string[] }
      }
    ]
  });

  const conflict = result.consistency_findings.find((f) => f.key === "conflicting_waste_carriers");
  assert.ok(conflict);
  assert.ok(conflict?.evidence.some((line) => line.includes("GreenCycle Waste Ltd")));
  assert.ok(!conflict?.evidence.some((line) => line.includes("Leeds Waste Processing Facility")));
});

test("pack I detects invoice duplicate as informational only", () => {
  const result = runCrossDocumentReasoning({
    business: { produces_food_waste: false, produces_hazardous_waste: false },
    openAlerts: [],
    documents: [
      {
        ...baseDoc,
        id: "i1",
        file_name: "invoice_april.pdf",
        document_type: "invoice",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: "2026-04-14",
        extracted_licence_number: null,
        ai_extracted_json: {
          invoice_number: "INV-APR-001",
          invoice_issuer: "GreenCycle Waste Ltd",
          client_name: "Bean & Brew Cafe Ltd",
          service_lines: "General waste collection; Recycling collection"
        } as unknown as { missing_fields?: string[] }
      },
      {
        ...baseDoc,
        id: "i2",
        file_name: "invoice_april_copy.pdf",
        document_type: "invoice",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: "2026-04-14",
        extracted_licence_number: null,
        ai_extracted_json: {
          invoice_number: "INV-APR-001",
          invoice_issuer: "GreenCycle Waste Ltd",
          client_name: "Bean & Brew Cafe Ltd",
          service_lines: "General waste collection; Recycling collection"
        } as unknown as { missing_fields?: string[] }
      },
      {
        ...baseDoc,
        id: "i3",
        file_name: "wtn_valid.pdf",
        document_type: "waste_transfer_note",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: "2026-04-14",
        extracted_licence_number: "CBDU123456",
        extracted_ewc_code: "20 03 01",
        waste_type: "Mixed Municipal Waste",
        ai_extracted_json: {
          destination: "Leeds Waste Processing Facility"
        } as unknown as { missing_fields?: string[] }
      },
      {
        ...baseDoc,
        id: "i4",
        file_name: "carrier_licence_valid.pdf",
        document_type: "carrier_licence",
        extracted_supplier: "GreenCycle Waste Ltd",
        extracted_date: null,
        extracted_licence_number: "CBDU123456",
        expiry_date: "2027-04-01"
      }
    ]
  });

  const dup = result.consistency_findings.find((f) => f.key === "duplicate_documents");
  assert.ok(dup);
  assert.equal(dup?.status, "info");
  assert.equal(dup?.severity, "low");
  assert.equal(dup?.evidence.length, 1);
  assert.ok(dup?.evidence[0].includes("invoice_april_copy.pdf"));
  assert.ok(dup?.evidence[0].includes("invoice_april.pdf"));
  assert.equal(result.score_deductions.some((d) => d.reason.toLowerCase().includes("duplicate")), false);
});
