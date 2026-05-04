"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recalculateComplianceScore } from "@/lib/documents/pipeline";
import { requireEditableHealthCheckForDocument } from "@/lib/health-checks";

async function getOwnedDocument(documentId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id,business_id,user_id,storage_path")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; business_id: string; user_id: string; storage_path: string | null }>();

  if (error || !data) {
    throw new Error("Document not found or access denied.");
  }
  return data;
}

export async function deleteDocumentAction(formData: FormData) {
  const documentId = String(formData.get("document_id") ?? "");
  if (!documentId) return;

  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const doc = await getOwnedDocument(documentId, user.id);
  await requireEditableHealthCheckForDocument(doc.id, user.id);

  if (doc.storage_path) {
    await supabaseAdmin.storage.from("waste-documents").remove([doc.storage_path]);
  }

  await supabaseAdmin
    .from("alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("document_id", doc.id)
    .eq("status", "open");

  await supabaseAdmin.from("documents").delete().eq("id", doc.id).eq("user_id", user.id);
  await recalculateComplianceScore(doc.business_id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/assistant");
}
