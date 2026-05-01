import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const rawFiles = formData.getAll("files");
  const singleFile = formData.get("file");
  const files = (rawFiles.length ? rawFiles : singleFile ? [singleFile] : []).filter((f): f is File => f instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  }

  const invalid = files.find((f) => !ALLOWED_MIME_TYPES.has(f.type));
  if (invalid) {
    return NextResponse.json({ error: `Unsupported file type for ${invalid.name}. Upload PDF, PNG, JPG, or JPEG.` }, { status: 400 });
  }

  const successes: Array<{ file_name: string }> = [];
  const failures: Array<{ file_name: string; error: string }> = [];

  for (const file of files) {
    const filePath = `${user.id}/${Date.now()}-${safeFileName(file.name)}`;

    // Use admin client for Storage writes to avoid bucket RLS upload failures.
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, file, {
      upsert: false,
      contentType: file.type
    });

    if (uploadError) {
      failures.push({ file_name: file.name, error: `Storage upload failed: ${uploadError.message}` });
      continue;
    }

    try {
      const ai = await extractDocumentWithAI(file);

      const { error: insertError } = await supabase.from("documents").insert({
        user_id: user.id,
        business_id: business.id,
        file_name: file.name,
        storage_path: filePath,
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
        failures.push({ file_name: file.name, error: `Document save failed: ${insertError.message}` });
        continue;
      }

      successes.push({ file_name: file.name });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown extraction error.";
      failures.push({ file_name: file.name, error: `AI extraction failed: ${message}` });
    }
  }

  if (!successes.length) {
    return NextResponse.json({ error: "All uploads failed.", failures }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    uploaded_count: successes.length,
    failed_count: failures.length,
    successes,
    failures
  });
}
