import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "waste-documents";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: doc, error } = await supabaseAdmin
    .from("documents")
    .select("id,user_id,storage_path,file_name")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; user_id: string; storage_path: string | null; file_name: string }>();

  if (error || !doc || !doc.storage_path) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data, error: signedError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60, { download: doc.file_name });

  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: `Could not create signed URL: ${signedError?.message ?? "Unknown error"}` }, { status: 400 });
  }

  return NextResponse.redirect(data.signedUrl);
}
