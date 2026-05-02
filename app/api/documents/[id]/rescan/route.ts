import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { processDocument } from "@/lib/documents/pipeline";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: doc, error } = await supabaseAdmin
    .from("documents")
    .select("id,user_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; user_id: string }>();

  if (error || !doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  await supabaseAdmin.from("documents").update({ processing_status: "processing", processing_error: null }).eq("id", doc.id);
  void processDocument(doc.id);

  return NextResponse.json({ ok: true });
}
