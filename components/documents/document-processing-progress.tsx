"use client";

type Status = "uploaded" | "processing" | "processed" | "review" | "failed" | null | undefined;

function percentageForStatus(status: Status) {
  if (status === "uploaded") return 20;
  if (status === "processing") return 60;
  if (status === "processed" || status === "review" || status === "failed") return 100;
  return 0;
}

function toneForStatus(status: Status) {
  if (status === "processed") return "bg-green-500";
  if (status === "review") return "bg-amber-500";
  if (status === "failed") return "bg-red-500";
  if (status === "processing") return "bg-blue-500";
  return "bg-slate-400";
}

export function DocumentProcessingProgress({ status }: { status: Status }) {
  const pct = percentageForStatus(status);
  const tone = toneForStatus(status);
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200">
        <div className={`h-full transition-all duration-300 ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-slate-500">{pct}%</p>
    </div>
  );
}
