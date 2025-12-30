export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="p-3 rounded bg-yellow-900/30 text-yellow-300 border border-yellow-800 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded bg-white/5 animate-pulse" />
        <div className="h-72 rounded bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded bg-white/5 animate-pulse" />
        <div className="h-72 rounded bg-white/5 animate-pulse" />
      </div>
    </div>
  );
}
