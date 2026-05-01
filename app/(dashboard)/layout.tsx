import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/(auth)/actions";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/assistant", label: "AI Assistant" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/audit-pack", label: "Audit Pack" },
  { href: "/dashboard/settings", label: "Settings" }
];

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
    <div className="app-shell lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="app-sidebar p-5 text-white lg:sticky lg:top-0 lg:h-screen">
        <Link href="/dashboard" className="inline-flex items-center">
          <Image src="/logo-sml-white.png" alt="Waste Compliance Monitor" width={168} height={38} priority />
        </Link>

        <nav className="mt-8 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-emerald-50/90 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-xl border border-white/20 bg-white/10 p-4 text-sm">
          <p className="font-semibold">Your data is private and secure</p>
          <p className="mt-1 text-emerald-100/90">We never use your documents to train AI models.</p>
        </div>

        <form action={logoutAction} className="mt-6">
          <button className="w-full rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10" type="submit">
            Log out
          </button>
        </form>
      </aside>

      <main className="container-page py-6 lg:py-8">{children}</main>
    </div>
  );
}
