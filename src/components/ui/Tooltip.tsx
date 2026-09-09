import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** CSS-only tooltip: no portal, keyboard reachable via focus-within. */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}) {
  return (
    <span className={cn('group relative inline-flex', className)} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 w-56 -translate-x-1/2 rounded-md border border-line bg-ink px-2.5 py-1.5 text-2xs font-normal leading-snug text-paper opacity-0 shadow-raised transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        {content}
      </span>
    </span>
  );
}

export function InfoDot({ content }: { content: ReactNode }) {
  return (
    <Tooltip content={content}>
      <span
        aria-hidden
        className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-line text-[9px] font-bold text-muted"
      >
        i
      </span>
    </Tooltip>
  );
}
