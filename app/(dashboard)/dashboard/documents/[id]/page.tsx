import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { deleteDocumentAction, rescanDocumentAction } from "../actions";

type DocumentDetail = {
  id: string;
  file_name: string;
  created_at: string;
  processing_status: "uploaded" | "processing" | "processed" | "failed" | null;
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
  ai_extracted_json: unknown;
};

function fmt(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function badgeColor(level: string) {
  if (level === "high" || level === "failed") return "bg-red-50 text-[#DC2626] border-red-200";
  if (level === "medium" || level === "processing" || level === "uploaded") return "bg-amber-50 text-[#F59E0B] border-amber-200";
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
            <Button variant="secondary" href={`/api/documents/${doc.id}/download`}>
              Download
            </Button>
            <form action={rescanDocumentAction}>
              <input type="hidden" name="document_id" value={doc.id} />
              <Button type="submit" variant="secondary">
                Rescan
              </Button>
            </form>
            <form action={deleteDocumentAction}>
              <input type="hidden" name="document_id" value={doc.id} />
              <Button type="submit" variant="secondary">
                Delete
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="app-panel space-y-4 p-5">
        <Row label="Processing status" value={<Badge value={doc.processing_status ?? "uploaded"} />} />
        {doc.processing_status === "failed" && doc.processing_error ? <Row label="Processing error" value={doc.processing_error} /> : null}
        <Row label="Document type" value={doc.document_type ?? "unknown"} />
        <Row label="Supplier / carrier" value={doc.extracted_supplier ?? "—"} />
        <Row label="Document date" value={fmt(doc.extracted_date)} />
        <Row label="Expiry date" value={fmt(doc.expiry_date)} />
        <Row label="Waste type" value={doc.waste_type ?? "—"} />
        <Row label="EWC code" value={doc.extracted_ewc_code ?? "—"} />
        <Row label="Licence number" value={doc.extracted_licence_number ?? "—"} />
        <Row label="AI risk level" value={<Badge value={doc.ai_risk_level ?? "unknown"} />} />
        <Row label="AI summary" value={doc.ai_summary ?? "—"} />

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
