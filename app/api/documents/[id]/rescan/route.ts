import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { processDocument } from "@/lib/documents/pipeline";
import { requireEditableHealthCheckForDocument } from "@/lib/health-checks";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let docId = params.id;
  try {
    const check = await requireEditableHealthCheckForDocument(params.id, user.id);
    docId = check.doc.id;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Locked health check." }, { status: 403 });
  }

  await supabaseAdmin.from("documents").update({ processing_status: "processing", processing_error: null }).eq("id", docId);
  void processDocument(docId);

  return NextResponse.json({ ok: true });
}
