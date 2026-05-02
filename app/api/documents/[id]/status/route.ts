import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id,processing_status,processing_error")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; processing_status: string | null; processing_error: string | null }>();

  if (error || !data) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.json(data);
}
