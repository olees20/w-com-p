import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  href?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, variant = "primary", href, type = "button", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed";

  const tone =
    variant === "primary"
      ? "bg-[#1E3A8A] text-white hover:bg-[#1a3279] focus:ring-[#3B82F6] disabled:bg-[#9bb0e4]"
      : "border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] focus:ring-[#93C5FD] disabled:text-[#9CA3AF]";

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
