"use client";

import { ButtonHTMLAttributes } from "react";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary";
};

export function LoadingButton({
  isLoading = false,
  loadingText = "Loading...",
  children,
  disabled,
  variant = "primary",
  className = "",
  ...props
}: LoadingButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed";
  const tone =
    variant === "primary"
      ? "bg-[#1E3A8A] text-white hover:bg-[#1a3279] focus:ring-[#3B82F6] disabled:bg-[#9bb0e4]"
      : "border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] focus:ring-[#93C5FD] disabled:text-[#9CA3AF]";

  return (
    <button className={`${base} ${tone} ${className}`.trim()} disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <>
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
