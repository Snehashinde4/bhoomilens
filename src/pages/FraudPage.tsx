import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { Labelled, Select, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { EChart } from '@/components/charts/EChart';
import { graphOption, heatMapOption, horizontalBarOption, multiLineOption } from '@/components/charts/presets';
import { AnomalyDisclaimer } from '@/components/ui/Disclaimers';
import { Can } from '@/auth/PermissionGuard';
import { getDataset } from '@/data/dataset';
import { falsePositiveRate } from '@/data/generators/fraud';
import { useAppStore } from '@/store/appStore';
import { useScope } from '@/hooks/useScope';
import { filterByGeo } from '@/services/analytics';
import { buildParcelGraph, NODE_COLORS } from '@/graph/ownershipGraph';
import { THEME } from '@/config/constants';
import { formatDate } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import type { FraudAlert, RiskLevel } from '@/types';

export default function FraudPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();
  const recordAudit = useAppStore((s) => s.recordAudit);
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<RiskLevel | 'ALL'>('ALL');
  const [status, setStatus] = useState<'ALL' | FraudAlert['status']>('ALL');
  const [selected, setSelected] = useState<FraudAlert | null>(null);
  const [investigator, setInvestigator] = useState('');

  const alerts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filterByGeo(dataset.fraudAlerts, scope).filter(
      (a) =>
        (severity === 'ALL' || a.severity === severity) &&
        (status === 'ALL' || a.status === status) &&
        (!q || `${a.code} ${a.category} ${a.summary} ${a.parcelId ?? ''} ${a.district}`.toLowerCase().includes(q)),
    );
  }, [dataset.fraudAlerts, scope, search, severity, status]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    alerts.forEach((a) => map.set(a.category, (map.get(a.category) ?? 0) + 1));
    return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => a.count - b.count);
  }, [alerts]);

  const overTime = useMemo(() => {
    const map = new Map<string, number>();
    alerts.forEach((a) => {
      const key = a.detectedAt.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const periods = [...map.keys()].sort();
    return { periods, counts: periods.map((p) => map.get(p) ?? 0) };
  }, [alerts]);

  const districtHeat = useMemo(() => {
    const states = [...new Set(alerts.map((a) => a.state))].sort();
    const districts = [...new Set(alerts.map((a) => a.district))].slice(0, 34);
    const map = new Map<string, number>();
    alerts.forEach((a) => {
      const key = `${a.district}||${a.state}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const points: Array<[number, number, number]> = [];
    map.forEach((value, key) => {
      const [district, state] = key.split('||');
      const x = districts.indexOf(district);
      const y = states.indexOf(state);
      if (x >= 0 && y >= 0) points.push([x, y, value]);
    });
    return { states, districts, points };
  }, [alerts]);

  const networkGraph = useMemo(
    () => (selected?.parcelId ? buildParcelGraph(selected.parcelId) : { nodes: [], edges: [] }),
    [selected],
  );
  const graphCategories = [...new Set(networkGraph.nodes.map((n) => n.kind))];

  const columns: Column<FraudAlert>[] = [
    { key: 'code', header: 'Alert', accessor: (a) => a.code, render: (a) => <span className="metric font-semibold">{a.code}</span>, width: '96px' },
    { key: 'category', header: 'Category', accessor: (a) => a.category, width: '200px' },
    { key: 'severity', header: 'Severity', accessor: (a) => a.anomalyScore, align: 'center', render: (a) => <RiskBadge level={a.severity} score={a.anomalyScore} /> },
    { key: 'parcel', header: 'Parcel', accessor: (a) => a.parcelId ?? '—', render: (a) => <span className="metric">{a.parcelId ?? '—'}</span> },
    { key: 'district', header: 'District', accessor: (a) => a.district },
    { key: 'state', header: 'State', accessor: (a) => a.state },
    { key: 'summary', header: 'Observation', accessor: (a) => a.summary, render: (a) => <span className="block max-w-[320px] text-2xs">{a.summary}</span> },
    { key: 'detected', header: 'Detected', accessor: (a) => a.detectedAt, render: (a) => formatDate(a.detectedAt) },
    { key: 'status', header: 'Investigation', accessor: (a) => a.status, render: (a) => <StatusBadge status={a.status} /> },
    { key: 'inv', header: 'Investigator', accessor: (a) => a.investigator ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fraud and Anomaly Intelligence"
        description="Rule-based and statistical detection of potential anomalies across records, geometry, transfers and payments. Nothing here is a confirmed finding of fraud."
        trail={[{ label: 'Fraud Intelligence' }]}
        actions={
          <button
            className="btn-secondary"
            onClick={() =>
              exportCsv(
                alerts.map((a) => ({
                  code: a.code,
                  category: a.category,
                  severity: a.severity,
                  anomalyScore: a.anomalyScore,
                  parcelId: a.parcelId,
                  district: a.district,
                  state: a.state,
                  summary: a.summary,
                  evidence: a.evidence.join('; '),
                  detectedAt: a.detectedAt,
                  status: a.status,
                  investigator: a.investigator,
                })),
                'potential-anomaly-alerts',
              )
            }
          >
            Export alerts
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total alerts" value={alerts.length.toLocaleString('en-IN')} />
        <StatTile label="Critical" value={String(alerts.filter((a) => a.severity === 'critical').length)} tone="red" />
        <StatTile label="Under investigation" value={String(alerts.filter((a) => a.status === 'under_investigation').length)} tone="amber" />
        <StatTile label="Resolved" value={String(alerts.filter((a) => a.status === 'resolved').length)} tone="green" />
        <StatTile label="False-positive rate" value={`${falsePositiveRate(alerts)}%`} />
        <StatTile label="Districts affected" value={String(new Set(alerts.map((a) => a.district)).size)} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="Potential anomalies over time"
          subtitle="Detections per month"
          height={260}
          isEmpty={!overTime.periods.length}
          option={multiLineOption(overTime.periods, [{ name: 'Alerts', data: overTime.counts, color: THEME.red, area: true }], {
            asMonths: true,
            yName: 'alerts',
          })}
          exportName="anomaly-trend"
          exportRows={overTime.periods.map((p, i) => ({ period: p, alerts: overTime.counts[i] }))}
        />
        <ChartCard
          title="Alerts by category"
          subtitle="Detection rule distribution"
          height={260}
          isEmpty={!byCategory.length}
          option={horizontalBarOption(
            byCategory.map((c) => c.category),
            byCategory.map((c) => c.count),
            { valueName: 'alerts', color: THEME.amber },
          )}
          exportName="anomaly-categories"
          exportRows={byCategory}
        />
      </div>

      <ChartCard
        title="District risk heat map"
        subtitle="Alert density by district and state"
        height={320}
        isEmpty={!districtHeat.points.length}
        option={heatMapOption(districtHeat.districts, districtHeat.states, districtHeat.points, {
          max: Math.max(4, ...districtHeat.points.map((p) => p[2])),
          unit: ' alerts',
        })}
        exportName="anomaly-heatmap"
        exportRows={districtHeat.points.map(([x, y, v]) => ({
          district: districtHeat.districts[x],
          state: districtHeat.states[y],
          alerts: v,
        }))}
      />

      <Card
        dense
        title="Alert investigation register"
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <TextInput
              className="w-52 py-1 text-2xs"
              placeholder="Search alert, category, parcel…"
              value={search}
              aria-label="Search alerts"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-32 py-1 text-2xs"
              aria-label="Filter severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as RiskLevel | 'ALL')}
              options={[
                { value: 'ALL', label: 'All severities' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <Select
              className="w-40 py-1 text-2xs"
              aria-label="Filter investigation status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'new', label: 'New' },
                { value: 'under_investigation', label: 'Under investigation' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'false_positive', label: 'False positive' },
              ]}
            />
          </div>
        }
        footer={<AnomalyDisclaimer />}
      >
        <DataTable
          rows={alerts}
          columns={columns}
          rowKey={(a) => a.id}
          pageSize={14}
          initialSort={{ key: 'severity', dir: 'desc' }}
          onRowClick={(a) => setSelected(a)}
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.code} · ${selected.category}` : ''}
        width="max-w-4xl"
        footer={
          selected && (
            <Can permission="fraud.investigate" fallback={<span className="text-2xs text-muted">Read-only role</span>}>
              <>
                <button className="btn-secondary" onClick={() => setSelected(null)}>
                  Close
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    recordAudit({
                      actor: user?.name ?? 'Demo user',
                      role,
                      action: 'fraud.assigned',
                      entityType: 'FraudAlert',
                      entityId: selected.code,
                      oldValue: selected.investigator,
                      newValue: investigator,
                      reason: 'Investigator assigned from the fraud intelligence workspace',
                    });
                    setInvestigator('');
                  }}
                >
                  Assign investigator
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    recordAudit({
                      actor: user?.name ?? 'Demo user',
                      role,
                      action: 'fraud.false_positive',
                      entityType: 'FraudAlert',
                      entityId: selected.code,
                      oldValue: selected.status,
                      newValue: 'false_positive',
                      reason: 'Reviewed and closed as a false positive',
                    });
                    setSelected(null);
                  }}
                >
                  Mark false positive
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    recordAudit({
                      actor: user?.name ?? 'Demo user',
                      role,
                      action: 'fraud.investigation_opened',
                      entityType: 'FraudAlert',
                      entityId: selected.code,
                      oldValue: selected.status,
                      newValue: 'under_investigation',
                      reason: 'Investigation opened',
                    });
                    setSelected(null);
                  }}
                >
                  Open investigation
                </button>
              </>
            </Can>
          )
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={selected.severity} score={selected.anomalyScore} />
              <StatusBadge status={selected.status} />
              <Badge tone="neutral">{selected.district}, {selected.state}</Badge>
              <Badge tone="blue">Detected {formatDate(selected.detectedAt)}</Badge>
            </div>

            <p className="text-[13px]">{selected.summary}</p>

            <div className="rounded border border-line/60 bg-paper/40 p-2">
              <p className="text-2xs font-bold uppercase text-muted">Evidence considered</p>
              <ul className="mt-0.5 space-y-0.5 text-2xs text-muted">
                {selected.evidence.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Labelled label="Assign investigator">
                <TextInput value={investigator} onChange={(e) => setInvestigator(e.target.value)} placeholder="Officer name" />
              </Labelled>
              <div>
                <p className="text-2xs font-semibold uppercase text-muted">Related entities</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selected.relatedEntities.map((r) => (
                    <Badge key={r} tone="neutral">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {networkGraph.nodes.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-bold uppercase text-muted">Relationship network</p>
                <EChart
                  option={graphOption(
                    networkGraph.nodes.map((n) => ({
                      id: n.id,
                      name: n.name,
                      symbolSize: n.kind === 'parcel' ? 30 : 18,
                      color: NODE_COLORS[n.kind],
                      category: graphCategories.indexOf(n.kind),
                      conflict: n.conflict,
                    })),
                    networkGraph.edges.map((e) => ({ source: e.source, target: e.target, label: e.kind, conflict: e.conflict })),
                    graphCategories,
                  )}
                  height={320}
                  ariaLabel="Alert relationship network"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {selected.parcelId && (
                <button className="btn-secondary py-1 text-2xs" onClick={() => navigate(`/twins/${selected.parcelId}`)}>
                  Open land digital twin
                </button>
              )}
              {selected.parcelId && (
                <button className="btn-secondary py-1 text-2xs" onClick={() => navigate(`/ownership-graph?parcel=${selected.parcelId}`)}>
                  Open ownership graph
                </button>
              )}
            </div>

            <AnomalyDisclaimer />
          </div>
        )}
      </Modal>
    </div>
  );
}
