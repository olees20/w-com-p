import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
