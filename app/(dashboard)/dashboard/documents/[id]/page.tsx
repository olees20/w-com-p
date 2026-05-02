import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { deleteDocumentAction } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { RescanButton } from "@/components/documents/rescan-button";
import { DocumentProcessingProgress } from "@/components/documents/document-processing-progress";
import { DownloadButton } from "@/components/documents/download-button";

type DocumentDetail = {
  id: string;
  file_name: string;
  created_at: string;
  processing_status: "uploaded" | "processing" | "processed" | "review" | "failed" | null;
  processing_error: string | null;
  document_type: string | null;
  extracted_supplier: string | null;
  extracted_date: string | null;
  expiry_date: string | null;
  waste_type: string | null;
  extracted_ewc_code: string | null;
  extracted_licence_number: string | null;
  ai_summary: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  ai_extracted_json: { missing_fields?: string[] } | null;
};

function fmt(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function badgeColor(level: string) {
  if (level === "failed" || level === "high") return "bg-red-50 text-[#DC2626] border-red-200";
  if (level === "review" || level === "medium") return "bg-amber-50 text-[#F59E0B] border-amber-200";
  if (level === "processing") return "bg-blue-50 text-[#2563EB] border-blue-200";
  if (level === "uploaded" || level === "unknown") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-green-50 text-[#16A34A] border-green-200";
}

function Badge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeColor(value)}`}>{value}</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[220px_1fr] sm:gap-4">
      <p className="text-sm font-semibold text-[#111827]">{label}</p>
      <div className="text-sm text-[#374151]">{value}</div>
    </div>
  );
}

function extractedOrFallback(value: string | null) {
  if (!value || value.trim().length === 0) {
    return <span className="text-amber-700">Not extracted</span>;
  }
  return value;
}

export default async function DocumentDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: doc } = await supabase
    .from("documents")
    .select(
      "id,file_name,created_at,processing_status,processing_error,document_type,extracted_supplier,extracted_date,expiry_date,waste_type,extracted_ewc_code,extracted_licence_number,ai_summary,ai_risk_level,ai_extracted_json"
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle<DocumentDetail>();

  if (!doc) notFound();

  const { data: relatedAlerts } = await supabase
    .from("alerts")
    .select("id,title,severity,status,due_date,description")
    .eq("document_id", doc.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <section className="app-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">{doc.file_name}</h1>
            <p className="mt-1 text-sm text-[#6B7280]">Uploaded {fmt(doc.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DownloadButton documentId={doc.id} />
            <RescanButton documentId={doc.id} />
            <form action={deleteDocumentAction}>
              <input type="hidden" name="document_id" value={doc.id} />
              <SubmitButton variant="secondary" loadingText="Deleting...">
                Delete
              </SubmitButton>
            </form>
          </div>
        </div>
      </section>

      <section className="app-panel space-y-4 p-5">
        {doc.processing_status === "review" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This document was recognised but needs review because required fields are missing.
          </div>
        ) : null}
        {doc.processing_status === "failed" ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p className="font-semibold">Processing failed.</p>
            {doc.processing_error ? <p className="mt-1">{doc.processing_error}</p> : null}
          </div>
        ) : null}

        <Row label="Processing status" value={<Badge value={doc.processing_status ?? "uploaded"} />} />
        <DocumentProcessingProgress status={doc.processing_status} />
        {doc.processing_status === "failed" && doc.processing_error ? <Row label="Processing error" value={doc.processing_error} /> : null}

        <div className="rounded-lg border border-[#E5E7EB] p-4">
          <h2 className="text-base font-bold text-[#111827]">Extraction result</h2>
          <div className="mt-3 space-y-3">
            <Row label="Document type" value={doc.document_type ?? <span className="text-amber-700">Not extracted</span>} />
            <Row label="Supplier / carrier" value={extractedOrFallback(doc.extracted_supplier)} />
            <Row label="Document date" value={doc.extracted_date ? fmt(doc.extracted_date) : <span className="text-amber-700">Not extracted</span>} />
            <Row label="Expiry date" value={doc.expiry_date ? fmt(doc.expiry_date) : <span className="text-amber-700">Not extracted</span>} />
            <Row label="Waste type" value={extractedOrFallback(doc.waste_type)} />
            <Row label="EWC code" value={extractedOrFallback(doc.extracted_ewc_code)} />
            <Row label="Licence number" value={extractedOrFallback(doc.extracted_licence_number)} />
            <Row label="Risk level" value={<Badge value={doc.ai_risk_level ?? "unknown"} />} />
            <Row label="Summary" value={doc.ai_summary ? doc.ai_summary : <span className="text-amber-700">Not extracted</span>} />
            <Row
              label="Missing fields"
              value={
                doc.ai_extracted_json?.missing_fields?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {doc.ai_extracted_json.missing_fields.map((field) => (
                      <span key={field} className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {field}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[#6B7280]">None</span>
                )
              }
            />
          </div>
        </div>

        <details className="rounded-lg border border-[#E5E7EB] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#111827]">Raw extracted JSON</summary>
          <pre className="mt-3 overflow-x-auto rounded bg-[#F9FAFB] p-3 text-xs text-[#374151]">
            {JSON.stringify(doc.ai_extracted_json ?? {}, null, 2)}
          </pre>
        </details>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Related alerts</h2>
        <div className="mt-3 space-y-2">
          {relatedAlerts?.length ? (
            relatedAlerts.map((alert) => (
              <article key={alert.id} className="rounded-lg border border-[#E5E7EB] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#111827]">{alert.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge value={alert.severity ?? "medium"} />
                    <Badge value={alert.status ?? "open"} />
                  </div>
                </div>
                {alert.description ? <p className="mt-1 text-sm text-[#6B7280]">{alert.description}</p> : null}
                {alert.due_date ? <p className="mt-1 text-xs text-[#6B7280]">Due {fmt(alert.due_date)}</p> : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-[#6B7280]">No alerts linked to this document.</p>
          )}
        </div>
      </section>
    </div>
  );
}
