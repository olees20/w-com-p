"use client";

import { useFormStatus } from "react-dom";
import { LoadingButton } from "@/components/ui/loading-button";

type SubmitButtonProps = {
  children: React.ReactNode;
  loadingText: string;
  variant?: "primary" | "secondary";
  className?: string;
};

export function SubmitButton({ children, loadingText, variant = "primary", className = "" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <LoadingButton type="submit" isLoading={pending} loadingText={loadingText} variant={variant} className={className}>
      {children}
    </LoadingButton>
  );
}
