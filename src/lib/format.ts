const numberFormat = new Intl.NumberFormat('en-IN');

export function formatNumber(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompact(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} K`;
  return numberFormat.format(value);
}

/** Indian rupee amounts are shown in crore/lakh, the unit used in official notes. */
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${formatNumber(value / 1e7, 2)} Cr`;
  if (abs >= 1e5) return `₹${formatNumber(value / 1e5, 2)} L`;
  return `₹${numberFormat.format(Math.round(value))}`;
}

export function formatPercent(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function formatArea(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${formatNumber(value, decimals)} ha`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMonth(period: string): string {
  const [y, m] = period.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function relativeDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const d1 = typeof a === 'string' ? new Date(a) : a;
  const d2 = typeof b === 'string' ? new Date(b) : b;
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
}

export function addDays(date: string | Date, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function iso(date: Date): string {
  return date.toISOString();
}

/** Masks identifiers so that no full bank/identity value is ever rendered. */
export function maskIdentifier(value: string, visible = 4): string {
  if (!value) return '—';
  const tail = value.slice(-visible);
  return `${'X'.repeat(Math.max(0, value.length - visible))}${tail}`;
}
