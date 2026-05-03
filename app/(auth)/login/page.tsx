import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { createServerClient } from "@/lib/supabase/server";
import { loginAction } from "@/app/(auth)/actions";

export default async function LoginPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Log in"
      description="Access your compliance dashboard"
      footerText="No account yet?"
      footerLinkText="Create one"
      footerHref="/signup"
    >
      <AuthForm mode="login" action={loginAction} />
    </AuthShell>
  );
}
