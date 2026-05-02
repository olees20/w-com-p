export default function DashboardRouteLoading() {
  return (
    <div className="min-h-[60vh]">
      <div className="fixed left-0 right-0 top-0 z-50 h-1 overflow-hidden bg-transparent">
        <div className="h-full w-1/3 animate-pulse bg-[#3B82F6]" />
      </div>
      <div className="space-y-4 p-6">
        <div className="app-panel h-20 animate-pulse bg-white/70" />
        <div className="app-panel h-64 animate-pulse bg-white/70" />
      </div>
    </div>
  );
}
