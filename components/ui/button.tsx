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
      ? "bg-[#0f5b46] text-white hover:bg-[#0c4939] focus:ring-[#0f5b46] disabled:bg-[#7fb2a2]"
      : "border border-[#cfe0da] bg-white text-[#21453a] hover:bg-[#f2f7f5] focus:ring-[#cfe0da] disabled:text-[#89a39a]";

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
