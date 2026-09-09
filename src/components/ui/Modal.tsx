import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-ink-deep/50 p-4 pt-16 no-print">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('surface-card w-full shadow-raised', width)}
      >
        <header className="flex items-center justify-between border-b border-line/70 px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="btn-ghost px-2" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto scroll-thin p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line/70 px-4 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 'w-[420px]',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex justify-end bg-ink-deep/40 no-print" onClick={onClose}>
      <aside
        className={cn('h-full overflow-y-auto scroll-thin bg-surface shadow-raised', width)}
        onClick={(e) => e.stopPropagation()}
        aria-label={title}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-line/70 bg-surface px-4 py-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button type="button" className="btn-ghost px-2" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </header>
        <div className="p-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
