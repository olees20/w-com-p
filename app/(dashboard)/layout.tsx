import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle();

  if (!business) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight">
            WComp
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-6 text-sm text-slate-600">
              <Link href="/dashboard">Overview</Link>
              <Link href="/dashboard/assistant">AI Assistant</Link>
              <Link href="/dashboard/billing">Billing</Link>
              <Link href="/dashboard/audit-pack">Audit Pack</Link>
              <Link href="/dashboard/settings">Settings</Link>
            </nav>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="container-page py-8">{children}</main>
    </div>
  );
}
