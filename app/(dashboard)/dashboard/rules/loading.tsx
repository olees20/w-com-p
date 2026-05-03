export default function RulesLoading() {
  return (
    <div className="space-y-4">
      <div className="app-panel h-24 animate-pulse bg-white/70" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="app-panel h-48 animate-pulse bg-white/70" />
        <div className="app-panel h-48 animate-pulse bg-white/70" />
      </div>
      <div className="app-panel h-64 animate-pulse bg-white/70" />
    </div>
  );
}
