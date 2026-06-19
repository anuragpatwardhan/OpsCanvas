import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-surface/40 shimmer", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl bg-surface/40 ring-1 ring-inset ring-border p-5 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <div className="grid grid-cols-4 gap-2 pt-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-xl bg-surface/40 ring-1 ring-inset ring-border p-4 space-y-3">
      <Skeleton className="h-8 w-8" />
      <Skeleton className="h-7 w-12" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
