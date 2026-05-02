import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

type SidebarItem = {
  href: string;
  label: string;
  icon: "dashboard" | "documents" | "rules" | "audit" | "pack" | "billing" | "settings" | "account";
};

const primaryNav: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/documents", label: "Documents", icon: "documents" },
  { href: "/dashboard/rules", label: "Rules", icon: "rules" },
  { href: "/dashboard/assistant", label: "Audit Log", icon: "audit" },
  { href: "/dashboard/audit-pack", label: "Audit Pack", icon: "pack" }
];

const bottomNav: SidebarItem[] = [
  { href: "/dashboard/billing", label: "Billing", icon: "billing" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
  { href: "/dashboard/account", label: "Account", icon: "account" }
];

function SidebarIcon({ icon }: { icon: SidebarItem["icon"] }) {
  const cls = "h-4 w-4 shrink-0";
  if (icon === "dashboard") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 13h8V3H3zM13 21h8v-6h-8zM13 10h8V3h-8zM3 21h8v-4H3z" />
      </svg>
    );
  }
  if (icon === "audit") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    );
  }
  if (icon === "documents") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    );
  }
  if (icon === "rules") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    );
  }
  if (icon === "pack") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    );
  }
  if (icon === "billing") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    );
  }
  if (icon === "settings") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" />
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
          <Image src="/logo-sml-white.png" alt="Waste Compliance Platform" width={28} height={28} priority />
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

        <div className="mt-6 rounded-lg border border-white/20 bg-white/10 p-3 text-xs">
          <p className="font-semibold">Your data is private and secure</p>
          <p className="mt-1 text-blue-100/90">We never use your documents to train AI models.</p>
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
