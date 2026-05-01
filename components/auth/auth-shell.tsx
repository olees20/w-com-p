import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  footerText: string;
  footerLinkText: string;
  footerHref: string;
  children: React.ReactNode;
};

export function AuthShell({
  title,
  description,
  footerText,
  footerLinkText,
  footerHref,
  children
}: AuthShellProps) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
      <p className="mt-4 text-sm text-slate-600">
        {footerText} <Link href={footerHref} className="font-medium text-brand-700">{footerLinkText}</Link>
      </p>
    </div>
  );
}
