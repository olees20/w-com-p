import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  href?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, variant = "primary", href, type = "button", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2";

  const tone =
    variant === "primary"
      ? "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-600 disabled:bg-brand-300"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300 disabled:text-slate-400";

  const classes = `${base} ${tone} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
