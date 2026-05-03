import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container-page flex items-center justify-between py-10">
        <Link href="/" className="inline-flex items-center">
          <Image src="/logo-sml.png" alt="Waste Compliance Monitor" width={168} height={38} priority />
        </Link>
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Back to home
        </Link>
      </div>
      <section className="container-page pb-16">{children}</section>
    </main>
  );
}
