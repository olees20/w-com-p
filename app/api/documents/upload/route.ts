import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { extractDocumentWithAI } from "@/lib/openai/document-extraction";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpg", "image/jpeg"]);
const BUCKET = "waste-documents";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (businessError) {
    return NextResponse.json({ error: businessError.message }, { status: 400 });
  }

  if (!business) {
    return NextResponse.json({ error: "Business profile not found." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Upload PDF, PNG, JPG, or JPEG." }, { status: 400 });
  }

  const filePath = `${user.id}/${Date.now()}-${safeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    upsert: false,
    contentType: file.type
  });

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 400 });
  }

  const ai = await extractDocumentWithAI(file);

  const { error: insertError } = await supabase.from("documents").insert({
    user_id: user.id,
    business_id: business.id,
    file_name: file.name,
    storage_path: filePath,
    mime_type: file.type,
    size_bytes: file.size,
    document_type: ai.document_type,
    extracted_supplier: ai.extracted_supplier,
    extracted_date: ai.extracted_date,
    expiry_date: ai.expiry_date,
    waste_type: ai.waste_type,
    ai_summary: ai.ai_summary,
    ai_risk_level: ai.ai_risk_level,
    ai_extracted_json: ai
  });

  if (insertError) {
    return NextResponse.json({ error: `Document save failed: ${insertError.message}` }, { status: 400 });
  }

  return NextResponse.json({ success: true, extracted: ai });
}
