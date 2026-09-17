import { PageHeaderSkeleton, RowSkeleton } from "~/components/shipflow/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
