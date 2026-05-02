"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/ui/toast";
import { DocumentProcessingProgress } from "@/components/documents/document-processing-progress";

type Status = "uploaded" | "processing" | "processed" | "review" | "failed" | null;

export function RescanButton({ documentId, compact = false }: { documentId: string; compact?: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function pollUntilDone() {
    const start = Date.now();
    while (Date.now() - start < 60000) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/documents/${documentId}/status`, { cache: "no-store" });
      if (!res.ok) break;
      const data = (await res.json()) as { processing_status: Status };
      setStatus(data.processing_status);
      if (data.processing_status === "processed") {
        push("Rescan complete", "success");
        router.refresh();
        return;
      }
      if (data.processing_status === "review") {
        push("Document needs review", "info");
        router.refresh();
        return;
      }
      if (data.processing_status === "failed") {
        push("Processing failed", "error");
        router.refresh();
        return;
      }
    }
    push("Still processing. You can safely leave this page.", "info");
    router.refresh();
  }

  async function handleClick() {
    if (isLoading) return;
    setIsLoading(true);
    setStatus("processing");
    push("Rescan started", "info");

    try {
      const res = await fetch(`/api/documents/${documentId}/rescan`, { method: "POST" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Rescan failed.");
      }
      await pollUntilDone();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rescan failed.";
      push(message, "error");
      setStatus("failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={compact ? "" : "space-y-2"}>
      <LoadingButton type="button" variant="secondary" isLoading={isLoading} loadingText="Rescanning..." onClick={handleClick}>
        Rescan document
      </LoadingButton>
      {isLoading || status === "processing" ? <DocumentProcessingProgress status={status} /> : null}
    </div>
  );
}
