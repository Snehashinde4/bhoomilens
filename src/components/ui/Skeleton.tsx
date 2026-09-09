import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} />;
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex flex-col gap-2 p-1" style={{ height }} aria-busy="true" aria-label="Loading chart">
      <Skeleton className="h-3 w-32" />
      <div className="flex flex-1 items-end gap-2">
        {[42, 68, 55, 82, 61, 74, 48, 90, 66].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-1.5 p-3" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="surface-card space-y-2 p-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
