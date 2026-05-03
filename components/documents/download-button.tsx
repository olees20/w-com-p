"use client";

import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/ui/toast";

export function DownloadButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/download`, { redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const url = res.headers.get("location");
        if (url) {
          window.location.href = url;
          push("Download ready", "success");
          return;
        }
      }
      if (res.ok) {
        const url = res.url;
        window.location.href = url;
        push("Download ready", "success");
      } else {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Download failed.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Download failed.";
      push(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoadingButton type="button" variant="secondary" isLoading={loading} loadingText="Preparing..." onClick={handleDownload}>
      Download
    </LoadingButton>
  );
}
