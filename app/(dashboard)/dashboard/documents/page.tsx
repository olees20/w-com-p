import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { deleteDocumentAction, rescanDocumentAction } from "./actions";

type Doc = {
  id: string;
  file_name: string;
  document_type: string | null;
  extracted_supplier: string | null;
  extracted_date: string | null;
  expiry_date: string | null;
  waste_type: string | null;
  ai_risk_level: "low" | "medium" | "high" | null;
  processing_status: "uploaded" | "processing" | "processed" | "review" | "failed" | null;
  processing_error: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
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

export default async function DocumentsPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle<{ id: string }>();
  if (!business) return null;

  const { data: docs } = await supabase
    .from("documents")
    .select(
      "id,file_name,document_type,extracted_supplier,extracted_date,expiry_date,waste_type,ai_risk_level,processing_status,processing_error,created_at"
    )
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <section className="app-panel p-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Documents</h1>
        <p className="mt-1 text-sm text-[#6B7280]">View, manage, download, rescan, and delete your compliance documents.</p>
      </section>

      <section className="app-panel overflow-x-auto p-5">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="border-b border-[#E5E7EB] text-left text-xs uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="pb-3 pr-3">File name</th>
              <th className="pb-3 pr-3">Document type</th>
              <th className="pb-3 pr-3">Supplier / carrier</th>
              <th className="pb-3 pr-3">Document date</th>
              <th className="pb-3 pr-3">Expiry date</th>
              <th className="pb-3 pr-3">Waste type</th>
              <th className="pb-3 pr-3">Risk level</th>
              <th className="pb-3 pr-3">Processing status</th>
              <th className="pb-3 pr-3">Uploaded date</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {((docs ?? []) as Doc[]).map((doc) => (
              <tr key={doc.id} className="align-top">
                <td className="py-3 pr-3 font-semibold text-[#111827]">{doc.file_name}</td>
                <td className="py-3 pr-3">{doc.document_type ?? "unknown"}</td>
                <td className="py-3 pr-3">{doc.extracted_supplier ?? "—"}</td>
                <td className="py-3 pr-3">{formatDate(doc.extracted_date)}</td>
                <td className="py-3 pr-3">{formatDate(doc.expiry_date)}</td>
                <td className="py-3 pr-3">{doc.waste_type ?? "—"}</td>
                <td className="py-3 pr-3">
                  <Badge value={doc.ai_risk_level ?? "unknown"} />
                </td>
                <td className="py-3 pr-3">
                  <Badge value={doc.processing_status ?? "uploaded"} />
                  {doc.processing_status === "failed" && doc.processing_error ? (
                    <p className="mt-1 max-w-[220px] text-xs text-[#DC2626]">{doc.processing_error}</p>
                  ) : null}
                </td>
                <td className="py-3 pr-3">{formatDate(doc.created_at)}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" href={`/dashboard/documents/${doc.id}`}>
                      View details
                    </Button>
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
                </td>
              </tr>
            ))}
            {!docs?.length ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-sm text-[#6B7280]">
                  No documents yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
