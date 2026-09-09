import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { horizontalBarOption, multiLineOption } from '@/components/charts/presets';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { ROLE_LIST } from '@/auth/roles';
import { THEME } from '@/config/constants';
import { formatDateTime, maskIdentifier } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import type { AuditEvent, RoleId } from '@/types';

export default function AuditPage() {
  const dataset = getDataset();
  const localAudit = useAppStore((s) => s.workspace.auditTrail);

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState<RoleId | 'ALL'>('ALL');
  const [entityType, setEntityType] = useState('ALL');

  const all = useMemo(() => [...localAudit, ...dataset.auditLogs], [localAudit, dataset.auditLogs]);

  const actions = useMemo(() => [...new Set(all.map((a) => a.action))].sort(), [all]);
  const entityTypes = useMemo(() => [...new Set(all.map((a) => a.entityType))].sort(), [all]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (a) =>
        (action === 'ALL' || a.action === action) &&
        (roleFilter === 'ALL' || a.role === roleFilter) &&
        (entityType === 'ALL' || a.entityType === entityType) &&
        (!q ||
          `${a.actor} ${a.action} ${a.entityType} ${a.entityId} ${a.reason} ${a.correlationId}`
            .toLowerCase()
            .includes(q)),
    );
  }, [all, search, action, roleFilter, entityType]);

  const byAction = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((a) => map.set(a.action, (map.get(a.action) ?? 0) + 1));
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.count - b.count)
      .slice(-14);
  }, [rows]);

  const overTime = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((a) => {
      const key = a.timestamp.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const periods = [...map.keys()].sort().slice(-45);
    return { periods, counts: periods.map((p) => map.get(p) ?? 0) };
  }, [rows]);

  const columns: Column<AuditEvent>[] = [
    { key: 'ts', header: 'Timestamp', accessor: (a) => a.timestamp, render: (a) => <span className="metric text-2xs">{formatDateTime(a.timestamp)}</span>, width: '150px' },
    { key: 'actor', header: 'Actor', accessor: (a) => a.actor },
    { key: 'role', header: 'Role', accessor: (a) => a.role, render: (a) => <Badge tone="neutral">{a.role.replace(/_/g, ' ')}</Badge> },
    { key: 'action', header: 'Action', accessor: (a) => a.action, render: (a) => <span className="metric text-2xs">{a.action}</span> },
    { key: 'entity', header: 'Record', accessor: (a) => `${a.entityType} ${a.entityId}`, render: (a) => (
      <span>
        <span className="block text-[13px]">{a.entityType}</span>
        <span className="metric block text-2xs text-muted">{a.entityId}</span>
      </span>
    ) },
    { key: 'old', header: 'Old value', accessor: (a) => a.oldValue ?? '—' },
    { key: 'new', header: 'New value', accessor: (a) => a.newValue ?? '—' },
    { key: 'reason', header: 'Reason', accessor: (a) => a.reason },
    { key: 'corr', header: 'Correlation ID', accessor: (a) => a.correlationId, render: (a) => <span className="metric text-2xs">{a.correlationId}</span> },
    { key: 'ip', header: 'Source IP', accessor: (a) => a.sourceIp, render: (a) => <span className="metric text-2xs">{maskIdentifier(a.sourceIp, 3)}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Logs"
        description="An append-only record of who did what, to which record, with which values, when and why. Actions taken during this session appear at the top of the list."
        trail={[{ label: 'Audit Logs' }]}
        actions={
          <button
            className="btn-secondary"
            onClick={() =>
              exportCsv(
                rows.map((a) => ({
                  timestamp: a.timestamp,
                  actor: a.actor,
                  role: a.role,
                  action: a.action,
                  entityType: a.entityType,
                  entityId: a.entityId,
                  oldValue: a.oldValue,
                  newValue: a.newValue,
                  reason: a.reason,
                  correlationId: a.correlationId,
                  sourceIp: a.sourceIp,
                })),
                'audit-log',
              )
            }
          >
            Export audit log
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Events in view" value={rows.length.toLocaleString('en-IN')} />
        <StatTile label="This session" value={String(localAudit.length)} tone="teal" />
        <StatTile label="Distinct actors" value={String(new Set(rows.map((a) => a.actor)).size)} />
        <StatTile label="Distinct actions" value={String(new Set(rows.map((a) => a.action)).size)} />
        <StatTile label="Field corrections" value={String(rows.filter((a) => a.action.includes('corrected')).length)} tone="amber" />
        <StatTile label="Permission denials" value={String(rows.filter((a) => a.action.includes('denied')).length)} tone="red" />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="Audit activity over time"
          subtitle="Events per day"
          height={260}
          isEmpty={!overTime.periods.length}
          option={multiLineOption(overTime.periods, [{ name: 'Events', data: overTime.counts, color: THEME.blue, area: true }], {
            yName: 'events',
          })}
          exportName="audit-activity"
          exportRows={overTime.periods.map((p, i) => ({ date: p, events: overTime.counts[i] }))}
        />
        <ChartCard
          title="Most frequent actions"
          subtitle="Distribution of audited operations"
          height={260}
          isEmpty={!byAction.length}
          option={horizontalBarOption(
            byAction.map((a) => a.name),
            byAction.map((a) => a.count),
            { valueName: 'events', color: THEME.teal },
          )}
          exportName="audit-actions"
          exportRows={byAction}
        />
      </div>

      <Card
        dense
        title="Audit trail"
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <TextInput
              className="w-56 py-1 text-2xs"
              placeholder="Search actor, record, reason, correlation…"
              value={search}
              aria-label="Search audit events"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-44 py-1 text-2xs"
              aria-label="Filter action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              options={[{ value: 'ALL', label: 'All actions' }, ...actions.map((a) => ({ value: a, label: a }))]}
            />
            <Select
              className="w-40 py-1 text-2xs"
              aria-label="Filter role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleId | 'ALL')}
              options={[{ value: 'ALL', label: 'All roles' }, ...ROLE_LIST.map((r) => ({ value: r.id, label: r.label }))]}
            />
            <Select
              className="w-40 py-1 text-2xs"
              aria-label="Filter entity type"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              options={[{ value: 'ALL', label: 'All record types' }, ...entityTypes.map((e) => ({ value: e, label: e }))]}
            />
          </div>
        }
        footer="Audit entries are immutable in production and replicated to a write-once store for assurance."
      >
        <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} pageSize={16} />
      </Card>
    </div>
  );
}
