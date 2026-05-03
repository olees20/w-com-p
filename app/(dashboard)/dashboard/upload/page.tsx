import { createServerClient } from "@/lib/supabase/server";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentProcessingProgress } from "@/components/documents/document-processing-progress";
import { RescanButton } from "@/components/documents/rescan-button";

export default async function UploadPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;
  const isAdminBypass = user.email?.toLowerCase() === "admin@lithmira.com";

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle<{ id: string }>();
  if (!business) return null;
  const { data: activeHealthCheck } = await supabase
    .from("health_checks")
    .select("id,status,locked_at,expires_at")
    .eq("business_id", business.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("locked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; status: string; locked_at: string | null; expires_at: string | null }>();
  const canEdit = isAdminBypass || Boolean(activeHealthCheck);

  const { data: docs } = await supabase
    .from("documents")
    .select("id,file_name,processing_status,processing_error,created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-5">
      <section className="app-panel p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Step 2: Upload waste documents</h1>
        <p className="mt-2 text-sm text-[#6B7280]">Upload as many as you have. We can still produce a partial result if evidence is incomplete.</p>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">What to upload</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#374151]">
          <li>Waste transfer notes</li>
          <li>Waste invoices</li>
          <li>Carrier/supplier licence documents</li>
          <li>Waste contracts</li>
          <li>Hazardous waste consignment notes (if relevant)</li>
        </ul>
        {canEdit ? (
          <div className="mt-4">
            <DocumentUpload />
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This health check is locked or unavailable. Start new Health Check — £99 to upload more documents.
          </div>
        )}
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Recent processing</h2>
        <div className="mt-3 space-y-3">
          {(docs ?? []).length ? (
            (docs ?? []).map((doc) => (
              <article key={doc.id} className="rounded-lg border border-[#E5E7EB] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{doc.file_name}</p>
                    <p className="text-xs text-[#6B7280]">{doc.processing_status ?? "uploaded"}</p>
                  </div>
                  {canEdit ? <RescanButton documentId={doc.id} compact /> : null}
                </div>
                <div className="mt-2">
                  <DocumentProcessingProgress status={doc.processing_status} />
                </div>
                {doc.processing_error ? <p className="mt-2 text-xs text-[#DC2626]">{doc.processing_error}</p> : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-[#6B7280]">No uploads yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
