import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractDocumentWithAI, type ExtractedDocument } from "@/lib/openai/document-extraction";
import { runAlertMonitoringForBusiness } from "@/lib/alerts/monitoring";
import { calculateComplianceScore, type ComplianceStatus } from "@/lib/compliance/scoring";

const BUCKET = "waste-documents";

export type BusinessProfile = {
  id: string;
  user_id: string;
  name: string | null;
  business_type: string | null;
  produces_food_waste: boolean | null;
  produces_hazardous_waste: boolean | null;
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadDocument(params: { userId: string; businessId: string; file: File }) {
  const { userId, businessId, file } = params;
  const filePath = `${userId}/${Date.now()}-${safeFileName(file.name)}`;

  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, file, {
    upsert: false,
    contentType: file.type
  });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert({
      user_id: userId,
      business_id: businessId,
      file_name: file.name,
      storage_path: filePath,
      processing_status: "uploaded"
    })
    .select("id,business_id,user_id,storage_path,file_name")
    .single();

  if (error || !data) {
    throw new Error(`Document save failed: ${error?.message ?? "No row returned."}`);
  }

  return data as { id: string; business_id: string; user_id: string; storage_path: string; file_name: string };
}

export async function extractTextFromFile(storagePath: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`Could not download file for extraction: ${error?.message ?? "Unknown storage error."}`);
  }

  try {
    const text = await data.text();
    return text.slice(0, 200000);
  } catch {
    return "";
  }
}

async function readFileFromStorage(storagePath: string, fallbackName: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`Could not download uploaded file: ${error?.message ?? "Unknown storage error."}`);
  }

  const name = storagePath.split("/").pop() || fallbackName;
  const mime = data.type || "application/octet-stream";
  return new File([data], name, { type: mime });
}

export async function analyseDocumentWithOpenAI(text: string, businessProfile: BusinessProfile, file: File) {
  const aiResult = await extractDocumentWithAI(file, {
    name: businessProfile.name,
    business_type: businessProfile.business_type
  });

  const normalized = {
    ...aiResult,
    ai_summary: text && aiResult.ai_summary.length < 32 ? `${aiResult.ai_summary} (limited text extracted)` : aiResult.ai_summary
  };

  return normalized;
}

export async function updateDocumentWithAIResults(documentId: string, aiResult: ExtractedDocument) {
  const { error } = await supabaseAdmin
    .from("documents")
    .update({
      document_type: aiResult.document_type,
      extracted_supplier: aiResult.extracted_supplier,
      extracted_date: aiResult.extracted_date,
      expiry_date: aiResult.expiry_date,
      waste_type: aiResult.waste_type,
      extracted_ewc_code: aiResult.extracted_ewc_code,
      extracted_licence_number: aiResult.extracted_licence_number,
      ai_summary: aiResult.ai_summary,
      ai_risk_level: aiResult.ai_risk_level,
      ai_extracted_json: aiResult,
      processing_status: "processed",
      processing_error: null
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Could not update extracted fields: ${error.message}`);
  }
}

export async function generateAlertsForDocument(documentId: string, _aiResult: ExtractedDocument) {
  const { data: doc, error: docError } = await supabaseAdmin
    .from("documents")
    .select("business_id")
    .eq("id", documentId)
    .maybeSingle<{ business_id: string }>();

  if (docError || !doc) {
    throw new Error(`Could not load document for alerts: ${docError?.message ?? "Document not found."}`);
  }

  await runAlertMonitoringForBusiness(doc.business_id);
}

export async function recalculateComplianceScore(businessId: string) {
  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id,produces_food_waste,produces_hazardous_waste")
    .eq("id", businessId)
    .maybeSingle<{ id: string; produces_food_waste: boolean | null; produces_hazardous_waste: boolean | null }>();

  if (businessError || !business) {
    throw new Error(`Could not load business for scoring: ${businessError?.message ?? "Business not found."}`);
  }

  const { data: documents } = await supabaseAdmin
    .from("documents")
    .select("document_type,expiry_date,ai_risk_level,waste_type,ai_summary")
    .eq("business_id", business.id);

  const { data: alerts } = await supabaseAdmin
    .from("alerts")
    .select("severity,status")
    .eq("business_id", business.id)
    .eq("status", "open");

  const result = calculateComplianceScore({
    businessProfile: {
      id: business.id,
      produces_food_waste: business.produces_food_waste,
      produces_hazardous_waste: business.produces_hazardous_waste
    },
    uploadedDocuments: (documents ?? []) as Array<{
      document_type: string | null;
      expiry_date: string | null;
      ai_risk_level: "low" | "medium" | "high" | null;
      waste_type: string | null;
      ai_summary: string | null;
    }>,
    openAlerts: (alerts ?? []) as Array<{ severity: "low" | "medium" | "high" | null; status: string | null }>
  });

  const { error: updateError } = await supabaseAdmin
    .from("businesses")
    .update({ compliance_score: result.score, compliance_status: result.status as ComplianceStatus })
    .eq("id", businessId);

  if (updateError) {
    throw new Error(`Could not persist compliance score: ${updateError.message}`);
  }

  return result;
}

export async function processDocument(documentId: string) {
  const { data: doc, error: docError } = await supabaseAdmin
    .from("documents")
    .select("id,business_id,storage_path,file_name")
    .eq("id", documentId)
    .maybeSingle<{ id: string; business_id: string; storage_path: string | null; file_name: string }>();

  if (docError || !doc) {
    throw new Error(`Could not load document: ${docError?.message ?? "Document not found."}`);
  }

  if (!doc.storage_path) {
    throw new Error("Document has no storage_path.");
  }

  await supabaseAdmin.from("documents").update({ processing_status: "processing", processing_error: null }).eq("id", documentId);

  try {
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id,user_id,name,business_type,produces_food_waste,produces_hazardous_waste")
      .eq("id", doc.business_id)
      .maybeSingle<BusinessProfile>();

    if (businessError || !business) {
      throw new Error(`Could not load business for document: ${businessError?.message ?? "Business not found."}`);
    }

    const text = await extractTextFromFile(doc.storage_path);
    const file = await readFileFromStorage(doc.storage_path, doc.file_name);
    const aiResult = await analyseDocumentWithOpenAI(text, business, file);
    await updateDocumentWithAIResults(documentId, aiResult);
    await generateAlertsForDocument(documentId, aiResult);
    await recalculateComplianceScore(doc.business_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown document processing error.";
    await supabaseAdmin.from("documents").update({ processing_status: "failed", processing_error: message }).eq("id", documentId);
    throw error;
  }
}
