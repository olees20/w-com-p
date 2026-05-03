"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/ui/toast";
import { DocumentProcessingProgress } from "@/components/documents/document-processing-progress";

type UploadState = {
  error?: string;
  success?: string;
};

type QueueItem = {
  id: string;
  fileName: string;
  status: "waiting" | "uploading" | "processing" | "processed" | "review" | "failed";
  progress: number;
  error?: string;
};

const ACCEPT = ".pdf,.png,.jpg,.jpeg";

export function DocumentUpload() {
  const router = useRouter();
  const { push } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [state, setState] = useState<UploadState>({});
  const [queue, setQueue] = useState<QueueItem[]>([]);

  function updateQueueItem(id: string, partial: Partial<QueueItem>) {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...partial } : item)));
  }

  async function handleUpload() {
    const files = inputRef.current?.files;
    if (!files?.length) {
      setState({ error: "Please select at least one file first." });
      return;
    }

    setState({});
    setIsUploading(true);
    const selected = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      fileName: file.name,
      file,
      status: "waiting" as const,
      progress: 0
    }));
    setQueue(selected.map(({ id, fileName, status, progress }) => ({ id, fileName, status, progress })));
    push("Upload started", "info");

    let successCount = 0;
    let failCount = 0;

    for (const item of selected) {
      updateQueueItem(item.id, { status: "uploading", progress: 5 });
      const formData = new FormData();
      formData.append("file", item.file);

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/documents/upload");
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 25);
            updateQueueItem(item.id, { progress: Math.max(5, pct), status: "uploading" });
          }
        };
        xhr.onload = () => {
          try {
            const payload = JSON.parse(xhr.responseText) as {
              error?: string;
              uploaded_count?: number;
              failed_count?: number;
            };
            if (xhr.status >= 400 || payload.error) {
              failCount += 1;
              updateQueueItem(item.id, { status: "failed", progress: 100, error: payload.error ?? "Upload failed." });
              push(`Processing failed: ${item.file.name}`, "error");
              resolve();
              return;
            }

            updateQueueItem(item.id, { status: "processing", progress: 60 });
            setTimeout(() => updateQueueItem(item.id, { status: "processing", progress: 75 }), 300);
            setTimeout(() => updateQueueItem(item.id, { progress: 90 }), 600);
            setTimeout(() => updateQueueItem(item.id, { status: "processed", progress: 100 }), 900);
            successCount += 1;
            push(`Document processed: ${item.file.name}`, "success");
            resolve();
          } catch {
            if (xhr.status >= 400) {
              failCount += 1;
              updateQueueItem(item.id, { status: "failed", progress: 100, error: "Upload failed." });
              push(`Processing failed: ${item.file.name}`, "error");
            } else {
              successCount += 1;
              updateQueueItem(item.id, { status: "processed", progress: 100 });
            }
            resolve();
          }
        };
        xhr.onerror = () => {
          failCount += 1;
          updateQueueItem(item.id, { status: "failed", progress: 100, error: "Network error during upload." });
          push(`Processing failed: ${item.file.name}`, "error");
          resolve();
        };
        xhr.send(formData);
      });
    }

    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    setState({
      success: successCount ? `${successCount} document${successCount === 1 ? "" : "s"} uploaded.` : undefined,
      error: failCount ? `${failCount} document${failCount === 1 ? "" : "s"} failed.` : undefined
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
      />

      {queue.length ? (
        <div className="space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
          {queue.map((item) => (
            <div key={item.id} className="rounded-md border border-[#E5E7EB] bg-white p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-[#111827]">{item.fileName}</p>
                <span className="text-xs text-[#6B7280]">{item.status}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-200">
                <div className="h-full bg-[#3B82F6] transition-all" style={{ width: `${item.progress}%` }} />
              </div>
              <div className="mt-1">
                <DocumentProcessingProgress
                  status={item.status === "waiting" ? "uploaded" : item.status === "uploading" ? "processing" : item.status}
                />
              </div>
              {item.error ? <p className="mt-1 text-xs text-red-700">{item.error}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}

      <LoadingButton type="button" onClick={handleUpload} isLoading={isUploading} loadingText="Uploading..." className="w-full">
        Upload Document
      </LoadingButton>
    </div>
  );
}
