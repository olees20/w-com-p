import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container-page py-10">
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Back to home
        </Link>
      </div>
      <section className="container-page pb-16">{children}</section>
    </main>
  );
}
