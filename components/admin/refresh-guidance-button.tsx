"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { refreshGuidanceSourcesAction } from "@/app/(dashboard)/dashboard/rules/actions";

export function RefreshGuidanceButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <LoadingButton
        type="button"
        isLoading={isPending}
        loadingText="Refreshing..."
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await refreshGuidanceSourcesAction();
            if (!result.success) {
              setMessage(result.error || "Refresh failed.");
              return;
            }
            setMessage("Guidance refreshed.");
            router.refresh();
          });
        }}
      >
        Refresh guidance sources
      </LoadingButton>
      {message ? <p className="text-xs text-[#6B7280]">{message}</p> : null}
    </div>
  );
}
