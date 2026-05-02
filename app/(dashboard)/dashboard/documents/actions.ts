"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { processDocument, recalculateComplianceScore } from "@/lib/documents/pipeline";

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

export async function rescanDocumentAction(formData: FormData) {
  const documentId = String(formData.get("document_id") ?? "");
  if (!documentId) return;

  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const doc = await getOwnedDocument(documentId, user.id);

  await supabaseAdmin
    .from("alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("document_id", doc.id)
    .eq("status", "open");

  await supabaseAdmin.from("documents").update({ processing_status: "processing", processing_error: null }).eq("id", doc.id);
  await processDocument(doc.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/documents");
  revalidatePath(`/dashboard/documents/${doc.id}`);
  revalidatePath("/dashboard/assistant");
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
