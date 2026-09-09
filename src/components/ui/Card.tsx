import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  dense?: boolean;
  bodyClassName?: string;
}

export function Card({
  title,
  subtitle,
  actions,
  footer,
  dense,
  className,
  bodyClassName,
  children,
  ...rest
}: CardProps) {
  return (
    <section className={cn('surface-card flex flex-col', className)} {...rest}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-line/60 px-4 py-2.5">
          <div className="min-w-0">
            {typeof title === 'string' ? (
              <h3 className="truncate text-[15px] font-semibold leading-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="mt-0.5 text-2xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn('flex-1', dense ? 'p-0' : 'p-4', bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-line/60 px-4 py-2 text-2xs text-muted">{footer}</footer>}
    </section>
  );
}
