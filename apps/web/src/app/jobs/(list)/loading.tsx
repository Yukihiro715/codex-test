export default function Loading() {
  return (
    <div className="page-container pb-8 pt-6" aria-busy="true" aria-label="読み込み中">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-4 h-16 w-full" />
      <div className="mt-6 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
        <div className="skeleton hidden h-[480px] lg:block" />
        <div className="flex flex-col gap-3">
          <div className="skeleton h-9 w-56" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-48 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
