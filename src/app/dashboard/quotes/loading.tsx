export default function Loading() {
  return (
    <div>
      <div className="h-8 w-40 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border p-8">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
