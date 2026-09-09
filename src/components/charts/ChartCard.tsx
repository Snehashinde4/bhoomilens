import { useRef, type ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import { Card } from '@/components/ui/Card';
import { ChartSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoDot } from '@/components/ui/Tooltip';
import { downloadBlob, exportCsv } from '@/lib/export';
import { EChart, type EChartHandle } from './EChart';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  tooltip?: string;
  option: EChartsOption;
  height?: number;
  loading?: boolean;
  isEmpty?: boolean;
  onEvent?: Record<string, (params: unknown) => void>;
  exportRows?: Array<Record<string, unknown>>;
  exportName?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Every dashboard chart is wrapped here so that export, loading, empty and
 * tooltip behaviour is identical across the product.
 */
export function ChartCard({
  title,
  subtitle,
  tooltip,
  option,
  height = 280,
  loading,
  isEmpty,
  onEvent,
  exportRows,
  exportName,
  actions,
  footer,
  className,
}: ChartCardProps) {
  const chartRef = useRef<EChartHandle>(null);

  const exportPng = () => {
    const url = chartRef.current?.getPngDataUrl();
    if (!url) return;
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => downloadBlob(blob, `${exportName ?? slug(title)}.png`));
  };

  return (
    <Card
      className={className}
      title={
        <span className="flex items-center gap-1.5">
          <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
          {tooltip && <InfoDot content={tooltip} />}
        </span>
      }
      subtitle={subtitle}
      actions={
        <div className="flex items-center gap-1 no-print">
          {actions}
          <button type="button" className="btn-secondary px-2 py-1 text-2xs" onClick={exportPng}>
            PNG
          </button>
          {exportRows && exportRows.length > 0 && (
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-2xs"
              onClick={() => exportCsv(exportRows, exportName ?? slug(title))}
            >
              CSV
            </button>
          )}
        </div>
      }
      footer={footer}
    >
      {loading ? (
        <ChartSkeleton height={height} />
      ) : isEmpty ? (
        <div style={{ height }} className="flex items-center justify-center">
          <EmptyState
            title="No data for this selection"
            description="Change the state, district or date range to populate this chart."
          />
        </div>
      ) : (
        <EChart ref={chartRef} option={option} height={height} onEvent={onEvent} ariaLabel={title} />
      )}
    </Card>
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
