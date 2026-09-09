import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
  icon = '◇',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper text-lg text-muted">
        {icon}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-md text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-signal-red/40 bg-signal-red/10 text-lg text-signal-red">
        !
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-md text-[13px] text-muted">{description}</p>}
      {onRetry && (
        <button type="button" className="btn-secondary mt-1" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
