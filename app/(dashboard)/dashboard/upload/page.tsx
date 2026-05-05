import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentProcessingProgress } from "@/components/documents/document-processing-progress";
import { validateSingleBusinessPack } from "@/lib/entity-pack-validation";

export default async function UploadPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;
  const isAdminBypass = user.email?.toLowerCase() === "admin@lithmira.com";

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; name: string | null }>();
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
    .select(
      "id,file_name,document_type,processing_status,processing_error,created_at,extracted_supplier,extracted_date,extracted_licence_number,ai_extracted_json"
    )
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const recentDocs = (docs ?? []).slice(0, 8);
  const entityValidation = validateSingleBusinessPack({
    onboardedBusinessName: business.name ?? null,
    documents: (docs ?? []).map((doc) => ({
      ...doc,
      ai_risk_level: null,
      extracted_ewc_code: null,
      expiry_date: null,
      waste_type: null,
      ai_summary: null
    }))
  });
  const showMultiBusinessWarning = Boolean(entityValidation.finding);

  return (
    <div className="space-y-5">
      <section className="app-panel p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Step 2: Upload waste documents</h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          For the most accurate result, upload documents that belong to the business being checked. Do not mix documents from different businesses, clients or unrelated sites.
        </p>
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Upload documents for one business only</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#374151]">
          <li>Waste Transfer Notes</li>
          <li>Waste invoices</li>
          <li>Waste carrier licence evidence</li>
          <li>Supplier / waste contracts</li>
          <li>Food waste collection evidence</li>
          <li>Hazardous waste consignment notes if applicable</li>
        </ul>
        <h3 className="mt-4 text-sm font-semibold text-[#111827]">Avoid uploading</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#374151]">
          <li>menus</li>
          <li>insurance certificates unless relevant to waste</li>
          <li>unrelated receipts</li>
          <li>documents for other businesses</li>
          <li>duplicate files</li>
        </ul>
        {canEdit ? (
          <div className="mt-4">
            <DocumentUpload />
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This health check is locked or unavailable. Start new Health Check - £99 to upload more documents.
          </div>
        )}
        {showMultiBusinessWarning ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">We found documents that may belong to different businesses.</p>
            <p className="mt-1">This may reduce the reliability of your health check.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/dashboard/documents" className="inline-flex rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900">
                Remove unrelated documents
              </Link>
              <Link href="/dashboard/results" className="inline-flex rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white">
                Continue anyway
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="app-panel p-5">
        <h2 className="text-lg font-bold text-[#111827]">Recent processing</h2>
        <div className="mt-3 space-y-3">
          {recentDocs.length ? (
            recentDocs.map((doc) => (
              <article key={doc.id} className="rounded-lg border border-[#E5E7EB] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{doc.file_name}</p>
                    <p className="text-xs text-[#6B7280]">{doc.processing_status ?? "uploaded"}</p>
                  </div>
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
