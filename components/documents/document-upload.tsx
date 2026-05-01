"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type UploadState = {
  error?: string;
  success?: string;
};

const ACCEPT = ".pdf,.png,.jpg,.jpeg";

export function DocumentUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [state, setState] = useState<UploadState>({});

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setState({ error: "Please select a file first." });
      return;
    }

    setState({});
    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      setIsUploading(false);

      try {
        const payload = JSON.parse(xhr.responseText) as { error?: string };
        if (xhr.status >= 400) {
          setState({ error: payload.error ?? "Upload failed." });
          return;
        }
      } catch {
        if (xhr.status >= 400) {
          setState({ error: "Upload failed." });
          return;
        }
      }

      setState({ success: "Document uploaded successfully." });
      setProgress(100);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      router.refresh();
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setState({ error: "Network error during upload." });
    };

    xhr.send(formData);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
      />

      {isUploading ? (
        <div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">Uploading... {progress}%</p>
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}

      <Button type="button" onClick={handleUpload} disabled={isUploading} className="w-full">
        {isUploading ? "Uploading..." : "Upload new document"}
      </Button>
    </div>
  );
}
