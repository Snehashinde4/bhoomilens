import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { formatKpi } from '@/services/analytics';
import { EChart } from '@/components/charts/EChart';
import { sparklineOption } from '@/components/charts/presets';
import { InfoDot } from '@/components/ui/Tooltip';
import type { NationalKpi } from '@/types';

export function KpiCard({ kpi }: { kpi: NationalKpi }) {
  const navigate = useNavigate();
  const positive = kpi.status === 'positive';
  const neutral = kpi.status === 'neutral';

  return (
    <button
      type="button"
      onClick={() => navigate(kpi.route)}
      className="surface-card group flex w-full flex-col gap-1.5 p-3 text-left transition-shadow hover:shadow-raised focus-visible:shadow-raised"
      title={`${kpi.label} — open ${kpi.route}`}
    >
      <span className="flex items-start justify-between gap-1.5">
        <span className="text-2xs font-semibold uppercase leading-tight tracking-wide text-muted">
          {kpi.label}
        </span>
        <InfoDot content={kpi.tooltip} />
      </span>

      <span className="metric text-[22px] font-semibold leading-none text-ink">{formatKpi(kpi)}</span>

      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'metric text-2xs font-semibold',
            neutral ? 'text-muted' : positive ? 'text-signal-green' : 'text-signal-red',
          )}
        >
          {kpi.changePercent > 0 ? '▲' : kpi.changePercent < 0 ? '▼' : '■'}{' '}
          {Math.abs(kpi.changePercent).toFixed(1)}%
        </span>
        <span className="text-[10px] text-muted">{kpi.comparisonPeriod}</span>
      </span>

      <span className="-mx-1 -mb-1 block h-8">
        <EChart
          option={sparklineOption(kpi.sparkline, positive || neutral)}
          height={32}
          ariaLabel={`${kpi.label} trend`}
        />
      </span>
    </button>
  );
}

export function KpiGrid({ kpis, columns = 6 }: { kpis: NationalKpi[]; columns?: number }) {
  return (
    <div
      className={cn(
        'grid gap-2.5',
        columns === 6
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
          : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      )}
    >
      {kpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} />
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'ink',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ink' | 'teal' | 'red' | 'green' | 'amber';
}) {
  const toneClass: Record<string, string> = {
    ink: 'text-ink',
    teal: 'text-teal',
    red: 'text-signal-red',
    green: 'text-signal-green',
    amber: 'text-[#9a6b12]',
  };
  return (
    <div className="rounded-md border border-line/70 bg-paper/60 px-3 py-2">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('metric text-lg font-semibold leading-tight', toneClass[tone])}>{value}</p>
      {hint && <p className="text-2xs text-muted">{hint}</p>}
    </div>
  );
}
