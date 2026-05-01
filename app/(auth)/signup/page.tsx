import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { createServerClient } from "@/lib/supabase/server";
import { signupAction } from "@/app/(auth)/actions";

export default async function SignUpPage() {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Create account"
      description="Start your WComp workspace"
      footerText="Already have an account?"
      footerLinkText="Log in"
      footerHref="/login"
    >
      <AuthForm mode="signup" action={signupAction} />
    </AuthShell>
  );
}
