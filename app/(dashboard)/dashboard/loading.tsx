export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="app-panel h-28 animate-pulse bg-white/70" />
      <div className="grid gap-4 xl:grid-cols-4">
        <div className="app-panel h-36 animate-pulse bg-white/70" />
        <div className="app-panel h-36 animate-pulse bg-white/70" />
        <div className="app-panel h-36 animate-pulse bg-white/70" />
        <div className="app-panel h-36 animate-pulse bg-white/70" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="app-panel h-72 animate-pulse bg-white/70" />
        <div className="app-panel h-72 animate-pulse bg-white/70" />
      </div>
    </div>
  );
}
