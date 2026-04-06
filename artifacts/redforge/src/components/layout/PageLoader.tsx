export function PageLoader() {
  return (
    <div className="w-full space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="h-7 w-44 skeleton rounded-lg" />
        <div className="h-9 w-32 skeleton rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-32 skeleton rounded-2xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-64 skeleton rounded-2xl" />
        <div className="h-64 skeleton rounded-2xl" style={{ animationDelay: "60ms" }} />
      </div>
    </div>
  );
}
