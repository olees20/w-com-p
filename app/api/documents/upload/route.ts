import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { processDocument, uploadDocument } from "@/lib/documents/pipeline";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpg", "image/jpeg"]);
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
    try {
      const document = await uploadDocument({ userId: user.id, businessId: business.id, file });
      await processDocument(document.id);
      successes.push({ file_name: file.name });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown document processing error.";
      failures.push({ file_name: file.name, error: message });
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
