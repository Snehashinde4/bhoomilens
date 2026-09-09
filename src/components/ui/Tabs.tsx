import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
  content: ReactNode;
}

export function Tabs({
  items,
  initialId,
  onChange,
  className,
}: {
  items: TabItem[];
  initialId?: string;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const [active, setActive] = useState(initialId ?? items[0]?.id);
  const current = items.find((i) => i.id === active) ?? items[0];

  return (
    <div className={cn('flex flex-col', className)}>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line/70 px-1">
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={item.id === active}
            className={cn(
              'relative -mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
              item.id === active
                ? 'border-teal text-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
            onClick={() => {
              setActive(item.id);
              onChange?.(item.id);
            }}
          >
            {item.label}
            {item.badge !== undefined && (
              <span className="ml-1.5 rounded-full bg-ink/10 px-1.5 py-0.5 text-2xs metric">{item.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-3">
        {current?.content}
      </div>
    </div>
  );
}
