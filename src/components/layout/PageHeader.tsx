import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '@/config/navigation';

/** Derives a breadcrumb trail from the URL and the navigation catalogue. */
export function Breadcrumbs({ trail }: { trail?: Array<{ label: string; to?: string }> }) {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const root = NAV_ITEMS.find((i) => i.path === `/${segments[0]}`);

  const items: Array<{ label: string; to?: string }> = trail ?? [
    ...(root ? [{ label: root.label, to: root.path }] : []),
    ...segments.slice(1).map((s) => ({ label: decodeURIComponent(s) })),
  ];

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-2xs text-muted">
      <Link to="/overview" className="hover:text-ink">
        BhoomiLens
      </Link>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          <span aria-hidden>›</span>
          {item.to && i < items.length - 1 ? (
            <Link to={item.to} className="hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-ink">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  trail,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  trail?: Array<{ label: string; to?: string }>;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div className="min-w-0">
        <Breadcrumbs trail={trail} />
        <h1 className="mt-0.5 text-[22px] font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-0.5 max-w-3xl text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}
