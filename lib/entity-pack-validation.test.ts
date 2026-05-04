import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalCarrierSupplierNames,
  carrierRoleNames,
  isLikelyAddress,
  producerRoleNames,
  validateSingleBusinessPack
} from "@/lib/entity-pack-validation";
import type { ReportDocument } from "@/lib/health-check-report";

const mkDoc = (overrides: Partial<ReportDocument>): ReportDocument => ({
  id: Math.random().toString(36),
  file_name: "doc.pdf",
  document_type: "waste_transfer_note",
  processing_status: "processed",
  processing_error: null,
  ai_risk_level: "low",
  extracted_supplier: null,
  extracted_date: "2026-03-14",
  extracted_ewc_code: null,
  extracted_licence_number: null,
  expiry_date: null,
  waste_type: null,
  ai_summary: null,
  ai_extracted_json: null,
  created_at: "2026-05-04T00:00:00Z",
  ...overrides
});

test("flags multi-business pack as high risk", () => {
  const names = [
    "Northgate Bakery Ltd",
    "Riverside Cafe Ltd",
    "Oak Table Restaurant Group",
    "Arc Auto Repairs Ltd",
    "Cloud Nine Gym Ltd"
  ];

  const docs = names.map((name, idx) =>
    mkDoc({
      file_name: `doc-${idx}.pdf`,
      ai_extracted_json: { customer: name, carrier: "GreenCycle Waste Ltd", destination: "Leeds Waste Processing Facility" } as unknown as {
        missing_fields?: string[];
      },
      extracted_supplier: "GreenCycle Waste Ltd"
    })
  );

  const result = validateSingleBusinessPack({ onboardedBusinessName: "Bean & Brew Café Ltd", documents: docs });
  assert.ok(result.finding);
  assert.equal(result.finding?.key, "multi_business_pack");
  assert.equal(result.finding?.status, "fail");
  assert.ok(result.producer_names.includes("Northgate Bakery Ltd"));
  assert.ok(result.producer_names.includes("Riverside Cafe Ltd"));
  assert.ok(result.producer_names.includes("Oak Table Restaurant Group"));
  assert.ok(result.producer_names.includes("Arc Auto Repairs Ltd"));
  assert.ok(result.producer_names.includes("Cloud Nine Gym Ltd"));
  assert.ok(result.carrier_names.includes("GreenCycle Waste Ltd"));
  assert.ok(!result.carrier_names.includes("Northgate Bakery Ltd"));
  assert.ok(!result.carrier_names.includes("Riverside Cafe Ltd"));
});

test("clean single-business pack does not trigger multi-business risk", () => {
  const docs = [
    mkDoc({
      file_name: "wtn.pdf",
      ai_extracted_json: { customer: "Bean & Brew Café Ltd", carrier: "GreenCycle Waste Ltd", destination: "Leeds Waste Processing Facility" } as unknown as {
        missing_fields?: string[];
      },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      file_name: "invoice.pdf",
      document_type: "invoice",
      ai_extracted_json: { client: "Bean & Brew Café Ltd", supplier: "GreenCycle Waste Ltd" } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    })
  ];

  const result = validateSingleBusinessPack({ onboardedBusinessName: "Bean & Brew Café Ltd", documents: docs });
  assert.equal(result.finding, null);
  assert.ok(result.carrier_names.includes("GreenCycle Waste Ltd"));
  assert.ok(result.producer_names.includes("Bean & Brew Café Ltd"));
  assert.ok(result.destination_names.includes("Leeds Waste Processing Facility"));
  assert.ok(!result.carrier_names.includes("Bean & Brew Café Ltd"));
});

test("role-aware mapping keeps producer separate from carrier", () => {
  const docs = [
    mkDoc({
      file_name: "wtn-role-aware.pdf",
      ai_extracted_json: {
        producer: "Northgate Bakery Ltd",
        carrier: "GreenCycle Waste Ltd",
        destination: "Leeds Waste Processing Facility"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "Northgate Bakery Ltd"
    }),
    mkDoc({
      file_name: "invoice-role-aware.pdf",
      document_type: "invoice",
      ai_extracted_json: {
        invoice_issuer: "GreenCycle Waste Ltd",
        client: "Northgate Bakery Ltd"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "Northgate Bakery Ltd"
    })
  ];

  const result = validateSingleBusinessPack({ onboardedBusinessName: "Northgate Bakery Ltd", documents: docs });
  assert.ok(result.producer_names.includes("Northgate Bakery Ltd"));
  assert.ok(result.carrier_names.includes("GreenCycle Waste Ltd"));
  assert.ok(!result.carrier_names.includes("Northgate Bakery Ltd"));
});

test("WTN top producer name is not treated as carrier when Carrier label is present", () => {
  const payload = {
    producer_name: "Northgate Bakery Ltd",
    carrier_name: "GreenCycle Waste Ltd",
    destination: "Leeds Waste Processing Facility"
  } as Record<string, unknown>;

  const producers = producerRoleNames(payload);
  const carriers = carrierRoleNames(payload, "waste_transfer_note", "Northgate Bakery Ltd");

  assert.ok(producers.includes("Northgate Bakery Ltd"));
  assert.ok(carriers.includes("GreenCycle Waste Ltd"));
  assert.ok(!carriers.includes("Northgate Bakery Ltd"));
});

test("WTN current holder/transferee mapping is role-correct", () => {
  const payload = {
    current_holder: "Bean & Brew Café Ltd",
    transferee: "GreenCycle Waste Ltd",
    carrier_licence_number: "CBDU123456"
  } as Record<string, unknown>;

  const producers = producerRoleNames(payload);
  const carriers = carrierRoleNames(payload, "waste_transfer_note", "Bean & Brew Café Ltd");

  assert.ok(producers.includes("Bean & Brew Café Ltd"));
  assert.ok(carriers.includes("GreenCycle Waste Ltd"));
  assert.ok(!carriers.includes("Bean & Brew Café Ltd"));
});

test("ambiguous role extraction is captured as unclear entities", () => {
  const docs = [
    mkDoc({
      file_name: "unclear-entity.pdf",
      ai_extracted_json: {
        business_name: "Northgate Bakery Ltd"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "Northgate Bakery Ltd"
    })
  ];

  const result = validateSingleBusinessPack({ onboardedBusinessName: "Northgate Bakery Ltd", documents: docs });
  assert.ok(result.unclear_entity_names.includes("Northgate Bakery Ltd"));
  assert.equal(result.carrier_names.includes("Northgate Bakery Ltd"), false);
});

test("known site names count as match for mixed-business threshold", () => {
  const docs = [
    mkDoc({
      file_name: "site-a.pdf",
      ai_extracted_json: { customer: "Bean & Brew Café Ltd - Leeds Site", carrier: "GreenCycle Waste Ltd" } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      file_name: "site-b.pdf",
      ai_extracted_json: { customer: "Bean & Brew Café Ltd - York Site", carrier: "GreenCycle Waste Ltd" } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      file_name: "site-c.pdf",
      ai_extracted_json: { customer: "Bean & Brew Café Ltd - Wakefield Site", carrier: "GreenCycle Waste Ltd" } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    })
  ];

  const result = validateSingleBusinessPack({
    onboardedBusinessName: "Bean & Brew Café Ltd",
    knownSiteNames: ["Leeds Site", "York Site", "Wakefield Site"],
    documents: docs
  });

  assert.equal(result.finding, null);
});

test("detects UK-style addresses and does not treat them as producer names", () => {
  assert.equal(isLikelyAddress("18 Market Street, York, YO1 8AA"), true);
  assert.equal(isLikelyAddress("Unit A, 10 King Street, Leeds"), true);
  assert.equal(isLikelyAddress("44 Industrial Estate, Wakefield"), true);
  assert.equal(isLikelyAddress("5 Copy Lane, York"), true);

  const payload = {
    producer_name: "Northgate Bakery Ltd",
    current_holder_address: "18 Market Street, York, YO1 8AA"
  } as Record<string, unknown>;
  const producers = producerRoleNames(payload);
  assert.ok(producers.includes("Northgate Bakery Ltd"));
  assert.ok(!producers.includes("18 Market Street, York, YO1 8AA"));
});

test("does not classify normal business names as addresses", () => {
  assert.equal(isLikelyAddress("Northgate Bakery Ltd"), false);
  assert.equal(isLikelyAddress("Riverside Cafe Limited"), false);
  assert.equal(isLikelyAddress("Oak Table Restaurant Group"), false);
});

test("canonical carrier list includes all role-aware provider entities used by conflict checks", () => {
  const docs: ReportDocument[] = [
    mkDoc({
      id: "wtn",
      document_type: "waste_transfer_note",
      ai_extracted_json: {
        producer_name: "Bean & Brew Café Ltd",
        carrier_name: "GreenCycle Waste Ltd",
        destination: "Leeds Waste Processing Facility"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      id: "invoice",
      file_name: "invoice.pdf",
      document_type: "invoice",
      ai_extracted_json: {
        invoice_issuer: "GreenCycle Waste Ltd",
        client_name: "Bean & Brew Café Ltd"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      id: "contract",
      file_name: "contract.pdf",
      document_type: "contract",
      ai_extracted_json: {
        supplier_name: "GreenCycle Waste Ltd",
        client_name: "Bean & Brew Café Ltd"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      id: "licence",
      file_name: "licence.pdf",
      document_type: "carrier_licence",
      ai_extracted_json: {
        licensed_business: "York Waste Services Ltd"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "York Waste Services Ltd"
    })
  ];

  const canonical = buildCanonicalCarrierSupplierNames(docs, { onboardedBusinessName: "Bean & Brew Café Ltd" });
  assert.ok(canonical.names.includes("GreenCycle Waste Ltd"));
  assert.ok(canonical.names.includes("York Waste Services Ltd"));
  assert.ok(!canonical.names.includes("Leeds Waste Processing Facility"));
  assert.ok(!canonical.names.includes("Bean & Brew Café Ltd"));
});

test("entity role precedence classifies GreenCycle as carrier/supplier and not producer/unmatched", () => {
  const docs: ReportDocument[] = [
    mkDoc({
      id: "wtn",
      file_name: "wtn.pdf",
      document_type: "waste_transfer_note",
      ai_extracted_json: {
        producer_name: "Bean & Brew Café Ltd",
        carrier_name: "GreenCycle Waste Ltd",
        destination: "Leeds Waste Processing Facility"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      id: "invoice",
      file_name: "invoice.pdf",
      document_type: "invoice",
      ai_extracted_json: {
        invoice_issuer: "GreenCycle Waste Ltd",
        customer_name: "Bean & Brew Café Ltd"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      id: "contract",
      file_name: "contract.pdf",
      document_type: "contract",
      ai_extracted_json: {
        supplier_name: "GreenCycle Waste Ltd",
        client_name: "Bean & Brew Café Ltd"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    }),
    mkDoc({
      id: "licence",
      file_name: "licence.pdf",
      document_type: "carrier_licence",
      ai_extracted_json: {
        licensed_business: "GreenCycle Waste Ltd"
      } as unknown as { missing_fields?: string[] },
      extracted_supplier: "GreenCycle Waste Ltd"
    })
  ];

  const result = validateSingleBusinessPack({
    onboardedBusinessName: "Bean & Brew Café Ltd",
    documents: docs
  });

  assert.ok(result.carrier_names.includes("GreenCycle Waste Ltd"));
  assert.ok(!result.producer_names.includes("GreenCycle Waste Ltd"));
  assert.ok(!result.unmatched_producer_names.includes("GreenCycle Waste Ltd"));
});

test("destination vs site address mapping: producer address is site, labelled destination is facility", () => {
  const docs: ReportDocument[] = [
    mkDoc({
      id: "d1",
      file_name: "wtn-address-vs-destination.pdf",
      document_type: "waste_transfer_note",
      ai_extracted_json: {
        producer_name: "Northgate Bakery Ltd",
        current_holder_address: "18 Market Street, York, YO1 8AA",
        destination: "Leeds Waste Processing Facility"
      } as unknown as { missing_fields?: string[] }
    })
  ];

  const result = validateSingleBusinessPack({ onboardedBusinessName: "Northgate Bakery Ltd", documents: docs });
  assert.ok(result.site_address_names.includes("18 Market Street, York, YO1 8AA"));
  assert.ok(result.destination_names.includes("Leeds Waste Processing Facility"));
  assert.ok(!result.destination_names.includes("18 Market Street, York, YO1 8AA"));
});

test("collection point address stays site address; transfer station stays destination", () => {
  const docs: ReportDocument[] = [
    mkDoc({
      id: "d2",
      file_name: "wtn-collection-point.pdf",
      document_type: "waste_transfer_note",
      ai_extracted_json: {
        collection_address: "Unit A, 10 King Street, Leeds",
        destination: "York Transfer Station"
      } as unknown as { missing_fields?: string[] }
    })
  ];

  const result = validateSingleBusinessPack({ onboardedBusinessName: "Bean & Brew Café Ltd", documents: docs });
  assert.ok(result.site_address_names.includes("Unit A, 10 King Street, Leeds"));
  assert.ok(result.destination_names.includes("York Transfer Station"));
  assert.ok(!result.destination_names.includes("Unit A, 10 King Street, Leeds"));
});
