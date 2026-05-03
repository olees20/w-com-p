import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

type SidebarItem = {
  href: string;
  label: string;
  icon: "check" | "upload" | "result" | "docs" | "pack" | "account";
};

const primaryNav: SidebarItem[] = [
  { href: "/dashboard", label: "Health Check", icon: "check" },
  { href: "/dashboard/upload", label: "Upload Documents", icon: "upload" },
  { href: "/dashboard/results", label: "Results", icon: "result" },
  { href: "/dashboard/documents", label: "Documents", icon: "docs" },
  { href: "/dashboard/audit-pack", label: "Audit Pack", icon: "pack" }
];

const bottomNav: SidebarItem[] = [{ href: "/dashboard/account", label: "Account", icon: "account" }];

function SidebarIcon({ icon }: { icon: SidebarItem["icon"] }) {
  const cls = "h-4 w-4 shrink-0";
  if (icon === "check") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (icon === "upload") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M20 16v4H4v-4" />
      </svg>
    );
  }
  if (icon === "result") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="m7 14 3-3 3 2 4-5" />
      </svg>
    );
  }
  if (icon === "docs") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    );
  }
  if (icon === "pack") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h10M7 16h6" />
      </svg>
    );
  }

  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).maybeSingle();

  if (!business) redirect("/onboarding");

  return (
    <div className="app-shell lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="app-sidebar flex flex-col p-5 text-white lg:sticky lg:top-0 lg:h-screen">
        <Link href="/dashboard" className="inline-flex items-center gap-2">
          <Image src="/logo-sml-white.png" alt="Waste Compliance Platform" width={24} height={24} priority />
          <span className="text-sm font-semibold text-white">Waste Compliance Platform</span>
        </Link>

        <nav className="mt-8 space-y-1">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100 transition hover:bg-[#3B82F6]/30 hover:text-white"
            >
              <SidebarIcon icon={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 rounded-lg border border-white/20 bg-white/10 p-2 text-xs">
          <p className="font-semibold">Private by default</p>
          <p className="mt-1 text-blue-100/90">Your files stay private in your account.</p>
        </div>

        <nav className="mt-6 space-y-1 lg:mt-auto lg:pt-6">
          {bottomNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100 transition hover:bg-[#3B82F6]/30 hover:text-white"
            >
              <SidebarIcon icon={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="container-page py-6 lg:py-8">{children}</main>
    </div>
  );
}
