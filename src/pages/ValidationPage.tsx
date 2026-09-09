import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, SeverityBadge, StatusBadge } from '@/components/ui/Badge';
import { Labelled, Select, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { donutOption, horizontalBarOption } from '@/components/charts/presets';
import { Can } from '@/auth/PermissionGuard';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { SEVERITY_COLORS, SEVERITY_LABEL, THEME, VALIDATION_CATEGORY_LABEL } from '@/config/constants';
import { formatDate } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import { cn } from '@/lib/cn';
import type { ConflictSeverity, ValidationCategory, ValidationIssue } from '@/types';

export default function ValidationPage() {
  const navigate = useNavigate();
  const dataset = getDataset();
  const statusOverrides = useAppStore((s) => s.workspace.validationStatus);
  const assigneeOverrides = useAppStore((s) => s.workspace.validationAssignee);
  const setStatus = useAppStore((s) => s.setValidationStatus);
  const assign = useAppStore((s) => s.assignValidation);

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<ConflictSeverity | 'ALL'>('ALL');
  const [category, setCategory] = useState<ValidationCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ValidationIssue['status']>('ALL');
  const [selected, setSelected] = useState<ValidationIssue | null>(null);
  const [officer, setOfficer] = useState('');
  const [reason, setReason] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.validations
      .map((v) => ({
        ...v,
        status: statusOverrides[v.id] ?? v.status,
        assignedTo: assigneeOverrides[v.id] ?? v.assignedTo,
      }))
      .filter(
        (v) =>
          (severity === 'ALL' || v.severity === severity) &&
          (category === 'ALL' || v.category === category) &&
          (statusFilter === 'ALL' || v.status === statusFilter) &&
          (!q || `${v.title} ${v.parcelId} ${v.detail} ${v.ocrValue} ${v.lrmsValue}`.toLowerCase().includes(q)),
      );
  }, [dataset.validations, statusOverrides, assigneeOverrides, search, severity, category, statusFilter]);

  const severityCounts = useMemo(
    () =>
      (['blocking', 'review', 'informational', 'validated'] as const).map((s) => ({
        name: SEVERITY_LABEL[s],
        value: rows.filter((r) => r.severity === s).length,
      })),
    [rows],
  );

  const categoryCounts = useMemo(
    () =>
      Object.keys(VALIDATION_CATEGORY_LABEL)
        .map((c) => ({
          category: VALIDATION_CATEGORY_LABEL[c],
          count: rows.filter((r) => r.category === c).length,
        }))
        .sort((a, b) => a.count - b.count),
    [rows],
  );

  const columns: Column<ValidationIssue>[] = [
    { key: 'severity', header: 'Severity', accessor: (v) => v.severity, render: (v) => <SeverityBadge severity={v.severity} />, width: '96px' },
    { key: 'title', header: 'Conflict', accessor: (v) => v.title, width: '250px' },
    { key: 'category', header: 'Category', accessor: (v) => v.category, render: (v) => VALIDATION_CATEGORY_LABEL[v.category] },
    { key: 'field', header: 'Field', accessor: (v) => v.field ?? '—' },
    { key: 'parcel', header: 'Parcel', accessor: (v) => v.parcelId ?? '—', render: (v) => <span className="metric">{v.parcelId ?? '—'}</span> },
    { key: 'ocr', header: 'OCR value', accessor: (v) => v.ocrValue },
    { key: 'lrms', header: 'LRMS value', accessor: (v) => v.lrmsValue },
    { key: 'gis', header: 'GIS value', accessor: (v) => v.gisValue },
    { key: 'conf', header: 'Confidence', accessor: (v) => v.confidence, align: 'right', render: (v) => <span className="metric">{v.confidence}%</span> },
    { key: 'status', header: 'Status', accessor: (v) => v.status, render: (v) => <StatusBadge status={v.status} /> },
    { key: 'assigned', header: 'Assigned to', accessor: (v) => v.assignedTo ?? '—' },
    { key: 'detected', header: 'Detected', accessor: (v) => v.detectedAt, render: (v) => formatDate(v.detectedAt) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Validation and Conflict Workspace"
        description="Twelve validation categories reconcile AI extraction against LRMS, registry, mutation and GIS sources. Every reviewer decision writes an entry to the audit trail."
        trail={[{ label: 'Validation Workspace' }]}
        actions={
          <button
            className="btn-secondary"
            onClick={() =>
              exportCsv(
                rows.map((v) => ({
                  id: v.id,
                  severity: v.severity,
                  category: VALIDATION_CATEGORY_LABEL[v.category],
                  title: v.title,
                  parcelId: v.parcelId,
                  field: v.field,
                  ocrValue: v.ocrValue,
                  lrmsValue: v.lrmsValue,
                  registryValue: v.registryValue,
                  mutationValue: v.mutationValue,
                  gisValue: v.gisValue,
                  confidence: v.confidence,
                  status: v.status,
                  assignedTo: v.assignedTo,
                })),
                'validation-conflicts',
              )
            }
          >
            Export conflicts
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Conflicts in view" value={rows.length.toLocaleString('en-IN')} />
        <StatTile label="Blocking" value={String(rows.filter((r) => r.severity === 'blocking').length)} tone="red" />
        <StatTile label="Needs review" value={String(rows.filter((r) => r.severity === 'review').length)} tone="amber" />
        <StatTile label="Informational" value={String(rows.filter((r) => r.severity === 'informational').length)} />
        <StatTile label="Validated matches" value={String(rows.filter((r) => r.severity === 'validated').length)} tone="green" />
        <StatTile label="Resolved" value={String(rows.filter((r) => r.status === 'resolved').length)} tone="green" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1.4fr]">
        <ChartCard
          title="Conflicts by severity"
          subtitle="Red blocks processing, amber needs a human decision"
          height={260}
          isEmpty={severityCounts.every((s) => s.value === 0)}
          option={donutOption(severityCounts, {
            colors: [SEVERITY_COLORS.blocking, SEVERITY_COLORS.review, SEVERITY_COLORS.informational, SEVERITY_COLORS.validated],
            centerValue: String(rows.length),
            centerLabel: 'conflicts',
          })}
          exportName="conflicts-by-severity"
          exportRows={severityCounts.map((s) => ({ severity: s.name, count: s.value }))}
        />
        <ChartCard
          title="Conflicts by validation category"
          subtitle="Where the record base is weakest"
          height={260}
          isEmpty={categoryCounts.every((c) => c.count === 0)}
          option={horizontalBarOption(
            categoryCounts.map((c) => c.category),
            categoryCounts.map((c) => c.count),
            { valueName: 'conflicts', color: THEME.blue },
          )}
          exportName="conflicts-by-category"
          exportRows={categoryCounts}
        />
      </div>

      <Card
        dense
        title="Conflict register"
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <TextInput
              className="w-52 py-1 text-2xs"
              placeholder="Search conflict, parcel, value…"
              value={search}
              aria-label="Search conflicts"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-36 py-1 text-2xs"
              aria-label="Filter severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as ConflictSeverity | 'ALL')}
              options={[
                { value: 'ALL', label: 'All severities' },
                { value: 'blocking', label: 'Blocking' },
                { value: 'review', label: 'Needs review' },
                { value: 'informational', label: 'Informational' },
                { value: 'validated', label: 'Validated' },
              ]}
            />
            <Select
              className="w-48 py-1 text-2xs"
              aria-label="Filter category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ValidationCategory | 'ALL')}
              options={[
                { value: 'ALL', label: 'All categories' },
                ...Object.entries(VALIDATION_CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
              ]}
            />
            <Select
              className="w-32 py-1 text-2xs"
              aria-label="Filter status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'escalated', label: 'Escalated' },
              ]}
            />
          </div>
        }
      >
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(v) => v.id}
          pageSize={14}
          onRowClick={(v) => setSelected(v)}
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        width="max-w-3xl"
        footer={
          selected && (
            <Can
              permission="validation.decide"
              fallback={<span className="text-2xs text-muted">Read-only role</span>}
            >
              <>
                <button className="btn-secondary" onClick={() => setSelected(null)}>
                  Close
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    if (officer) assign(selected.id, officer);
                    setOfficer('');
                  }}
                >
                  Assign reviewer
                </button>
                <button className="btn-danger" onClick={() => { setStatus(selected.id, 'escalated', reason); setSelected(null); }}>
                  Escalate
                </button>
                <button className="btn-secondary" onClick={() => { setStatus(selected.id, 'in_progress', reason); setSelected(null); }}>
                  Mark in progress
                </button>
                <button className="btn-primary" onClick={() => { setStatus(selected.id, 'resolved', reason || 'Accepted the authoritative source value'); setSelected(null); }}>
                  Resolve
                </button>
              </>
            </Can>
          )
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={selected.severity} />
              <Badge tone="neutral">{VALIDATION_CATEGORY_LABEL[selected.category]}</Badge>
              <StatusBadge status={selected.status} />
              <Badge tone="blue">Confidence {selected.confidence}%</Badge>
            </div>

            <p className="text-[13px]">{selected.detail}</p>

            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="th-cell">Source</th>
                  <th className="th-cell">Value</th>
                  <th className="th-cell">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['OCR extraction', selected.ocrValue],
                  ['LRMS record', selected.lrmsValue],
                  ['Registry record', selected.registryValue],
                  ['Mutation record', selected.mutationValue],
                  ['GIS geometry', selected.gisValue],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-line/40">
                    <td className="table-cell">{label}</td>
                    <td className="table-cell font-medium">{value}</td>
                    <td className="table-cell">
                      {value === '—' ? (
                        <Badge tone="neutral">Not available</Badge>
                      ) : value === selected.lrmsValue ? (
                        <Badge tone="green">Matches reference</Badge>
                      ) : (
                        <Badge tone="red">Differs</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={cn('rounded-md border p-2.5', 'border-teal/40 bg-teal/8')}>
              <p className="text-2xs font-bold uppercase tracking-wide text-teal">Recommended resolution</p>
              <p className="mt-0.5 text-[13px]">{selected.recommendedResolution}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Labelled label="Assign reviewer">
                <TextInput value={officer} onChange={(e) => setOfficer(e.target.value)} placeholder="Officer name" />
              </Labelled>
              <Labelled label="Decision reason" hint="Recorded in the audit trail.">
                <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the decision" />
              </Labelled>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selected.documentId && (
                <button
                  className="btn-secondary py-1 text-2xs"
                  onClick={() => {
                    const doc = dataset.documents.find((d) => d.id === selected.documentId);
                    if (doc) navigate(`/digitization/${doc.code}`);
                  }}
                >
                  Open source document
                </button>
              )}
              {selected.parcelId && (
                <>
                  <button className="btn-secondary py-1 text-2xs" onClick={() => navigate(`/twins/${selected.parcelId}`)}>
                    Open land digital twin
                  </button>
                  <button
                    className="btn-secondary py-1 text-2xs"
                    onClick={() => navigate(`/ownership-graph?parcel=${selected.parcelId}`)}
                  >
                    Open ownership graph
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
