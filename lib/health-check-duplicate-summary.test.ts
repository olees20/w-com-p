import test from "node:test";
import assert from "node:assert/strict";
import { buildDuplicateSummaryForTest, type ReportDocument } from "@/lib/health-check-report";

const baseDoc: Omit<ReportDocument, "id" | "file_name" | "document_type" | "extracted_supplier" | "extracted_date" | "extracted_licence_number"> = {
  processing_status: "processed",
  processing_error: null,
  ai_risk_level: "low",
  extracted_ewc_code: null,
  expiry_date: null,
  waste_type: null,
  ai_summary: null,
  ai_extracted_json: null,
  created_at: "2026-05-05T00:00:00.000Z"
};

test("duplicate summary returns expected pack I metadata", () => {
  const docs: ReportDocument[] = [
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
      }
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
      }
    }
  ];

  const out = buildDuplicateSummaryForTest(docs);
  assert.equal(out.duplicateDocumentsCount, 1);
  assert.equal(out.duplicatePairs.length, 1);
  assert.equal(out.duplicatePairs[0].canonicalFile, "invoice_april.pdf");
  assert.equal(out.duplicatePairs[0].duplicateFile, "invoice_april_copy.pdf");
  assert.equal(out.duplicateDocumentFilenames.includes("invoice_april_copy.pdf"), true);
  assert.equal(out.canonicalDocumentFilenames.includes("invoice_april.pdf"), true);
});
