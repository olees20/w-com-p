"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AuthActionState = {
  error?: string;
  success?: string;
};

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function loginAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = getString(formData.get("email"));
  const password = getString(formData.get("password"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signupAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = getString(formData.get("email"));
  const password = getString(formData.get("password"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createServerClient();
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    return { error: error.message };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return { error: signInError.message };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
