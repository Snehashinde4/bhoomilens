import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { horizontalBarOption } from '@/components/charts/presets';
import { Can } from '@/auth/PermissionGuard';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { THEME } from '@/config/constants';
import { formatCompact, formatDateTime } from '@/lib/format';
import type { IntegrationStatus } from '@/types';

export default function IntegrationsPage() {
  const dataset = getDataset();
  const recordAudit = useAppStore((s) => s.recordAudit);
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);

  const [retried, setRetried] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<IntegrationStatus | null>(null);

  const integrations = dataset.integrations;

  const latency = useMemo(
    () =>
      [...integrations]
        .sort((a, b) => a.latencyMs - b.latencyMs)
        .map((i) => ({ system: i.system, latency: i.latencyMs })),
    [integrations],
  );

  const columns: Column<IntegrationStatus>[] = [
    { key: 'system', header: 'System', accessor: (i) => i.system, width: '260px' },
    { key: 'category', header: 'Category', accessor: (i) => i.category, render: (i) => i.category.replace(/_/g, ' ') },
    { key: 'status', header: 'Status', accessor: (i) => i.status, render: (i) => <StatusBadge status={i.status} /> },
    { key: 'sync', header: 'Last synchronisation', accessor: (i) => i.lastSyncAt, render: (i) => formatDateTime(i.lastSyncAt) },
    { key: 'records', header: 'Records synchronised', accessor: (i) => i.recordsSynced, align: 'right', render: (i) => formatCompact(i.recordsSynced) },
    {
      key: 'failed',
      header: 'Failed records',
      accessor: (i) => i.failedRecords,
      align: 'right',
      render: (i) => (
        <span className={i.failedRecords > 500 ? 'metric text-signal-red' : 'metric'}>
          {formatCompact(i.failedRecords + (retried[i.id] ? -Math.min(retried[i.id] * 50, i.failedRecords) : 0))}
        </span>
      ),
    },
    { key: 'latency', header: 'Latency', accessor: (i) => i.latencyMs, align: 'right', render: (i) => <span className="metric">{i.latencyMs} ms</span> },
    { key: 'endpoint', header: 'Adapter endpoint', accessor: (i) => i.endpoint, render: (i) => <span className="metric text-2xs">{i.endpoint}</span> },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (i) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button className="btn-secondary px-1.5 py-0.5 text-2xs" onClick={() => setSelected(i)}>
            Error log
          </button>
          <Can permission="integrations.manage">
            <button
              className="btn-teal px-1.5 py-0.5 text-2xs"
              onClick={() => {
                setRetried((cur) => ({ ...cur, [i.id]: (cur[i.id] ?? 0) + 1 }));
                recordAudit({
                  actor: user?.name ?? 'Demo user',
                  role,
                  action: 'integration.retry',
                  entityType: 'IntegrationStatus',
                  entityId: i.system,
                  oldValue: String(i.failedRecords),
                  newValue: 'retry queued',
                  reason: 'Manual retry of failed records',
                });
              }}
            >
              Retry
            </button>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Integrations"
        description="Adapter-based connectivity to land record, registration, GIS, payment, legal and remote-sensing systems. The prototype runs mock adapters behind the same interfaces used in production."
        trail={[{ label: 'Data Integrations' }]}
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Adapters" value={String(integrations.length)} />
        <StatTile label="Connected" value={String(integrations.filter((i) => i.status === 'connected').length)} tone="green" />
        <StatTile label="Syncing" value={String(integrations.filter((i) => i.status === 'syncing').length)} tone="teal" />
        <StatTile label="Degraded" value={String(integrations.filter((i) => i.status === 'degraded').length)} tone="amber" />
        <StatTile label="Error / offline" value={String(integrations.filter((i) => i.status === 'error' || i.status === 'offline').length)} tone="red" />
        <StatTile label="Failed records" value={formatCompact(integrations.reduce((s, i) => s + i.failedRecords, 0))} tone="red" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Card dense title="Adapter health">
          <DataTable rows={integrations} columns={columns} rowKey={(i) => i.id} pageSize={12} onRowClick={(i) => setSelected(i)} />
        </Card>

        <div className="space-y-3">
          <ChartCard
            title="API latency by adapter"
            subtitle="Round-trip time of the last health probe"
            height={300}
            option={horizontalBarOption(
              latency.map((l) => l.system),
              latency.map((l) => l.latency),
              { valueName: 'milliseconds', color: THEME.blue },
            )}
            exportName="integration-latency"
            exportRows={latency}
          />

          <Card title="Integration architecture" subtitle="How BhoomiLens connects to government systems">
            <ul className="space-y-1.5 text-[13px]">
              <li>• Every external system is reached through a versioned adapter with a stable internal contract.</li>
              <li>• Ingestion is idempotent: records carry a source key so replays never duplicate data.</li>
              <li>• Failures move to a retry queue with exponential backoff and a dead-letter store.</li>
              <li>• All outbound calls are authenticated per system and logged as API access events.</li>
              <li>• The prototype ships mock adapters; swapping in a live adapter requires no UI change.</li>
            </ul>
            <div className="mt-2 flex flex-wrap gap-1">
              {['LRMS', 'DILRMP', 'Registration', 'Revenue', 'GIS', 'Cadastral', 'Identity', 'Payments', 'Courts', 'Remote sensing'].map((s) => (
                <Badge key={s} tone="neutral">
                  {s}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-2xs italic text-muted">
              Connectivity shown here is simulated. No claim is made about live availability of any
              specific government API.
            </p>
          </Card>
        </div>
      </div>

      {selected && (
        <Card
          title={`Error log · ${selected.system}`}
          subtitle={`${selected.status} · last sync ${formatDateTime(selected.lastSyncAt)}`}
          actions={
            <button className="btn-ghost py-1 text-2xs" onClick={() => setSelected(null)}>
              Close
            </button>
          }
        >
          {selected.errorLog.length === 0 ? (
            <p className="text-[13px] text-signal-green">No errors recorded for this adapter.</p>
          ) : (
            <ul className="space-y-1.5">
              {selected.errorLog.map((e, i) => (
                <li key={i} className="rounded border border-signal-red/30 bg-signal-red/5 p-2">
                  <p className="metric text-2xs font-semibold text-signal-red">{e.code}</p>
                  <p className="text-[13px]">{e.message}</p>
                  <p className="text-2xs text-muted">{formatDateTime(e.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
