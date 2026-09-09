import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, ConfidenceBadge, SeverityBadge, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar, Select, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { horizontalBarOption, multiLineOption } from '@/components/charts/presets';
import { Can } from '@/auth/PermissionGuard';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { useScope } from '@/hooks/useScope';
import { filterByGeo } from '@/services/analytics';
import { DOCUMENT_TYPES, LANGUAGES, THEME } from '@/config/constants';
import { formatDate, relativeDays } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import { mean, round } from '@/lib/stats';
import type { ConflictSeverity, DocumentType, LanguageCode, ReviewReason, ReviewTask } from '@/types';

const REASONS: ReviewReason[] = [
  'Owner Mismatch',
  'Area Conflict',
  'Low OCR Confidence',
  'Boundary Conflict',
  'Duplicate Suspicion',
  'Missing Registration',
  'Mutation Chain Break',
  'Compensation Mismatch',
];

export default function ReviewPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();
  const assignReview = useAppStore((s) => s.assignReview);
  const setReviewStatus = useAppStore((s) => s.setReviewStatus);
  const reviewAssignee = useAppStore((s) => s.workspace.reviewAssignee);
  const reviewStatus = useAppStore((s) => s.workspace.reviewStatus);
  const savedViews = useAppStore((s) => s.workspace.savedViews);
  const saveView = useAppStore((s) => s.saveView);

  const [search, setSearch] = useState('');
  const [reason, setReason] = useState<ReviewReason | 'ALL'>('ALL');
  const [severity, setSeverity] = useState<ConflictSeverity | 'ALL'>('ALL');
  const [language, setLanguage] = useState<LanguageCode | 'ALL'>('ALL');
  const [docType, setDocType] = useState<DocumentType | 'ALL'>('ALL');
  const [confidenceMax, setConfidenceMax] = useState(100);
  const [pendingMin, setPendingMin] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReviewTask['status']>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [officer, setOfficer] = useState('');
  const [viewName, setViewName] = useState('');

  const tasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filterByGeo(dataset.reviewQueue, scope)
      .map((t) => ({
        ...t,
        assignedTo: reviewAssignee[t.id] ?? t.assignedTo,
        status: (reviewStatus[t.id] as ReviewTask['status']) ?? t.status,
      }))
      .filter(
        (t) =>
          (reason === 'ALL' || t.reason === reason) &&
          (severity === 'ALL' || t.severity === severity) &&
          (language === 'ALL' || t.language === language) &&
          (docType === 'ALL' || t.documentType === docType) &&
          (statusFilter === 'ALL' || t.status === statusFilter) &&
          t.confidence <= confidenceMax &&
          t.pendingDays >= pendingMin &&
          (!q || `${t.code} ${t.reason} ${t.parcelId ?? ''} ${t.district} ${t.assignedTo ?? ''}`.toLowerCase().includes(q)),
      );
  }, [dataset.reviewQueue, scope, reviewAssignee, reviewStatus, reason, severity, language, docType, statusFilter, confidenceMax, pendingMin, search]);

  const workload = useMemo(() => {
    const map = new Map<string, { total: number; overdue: number }>();
    tasks.filter((t) => t.assignedTo).forEach((t) => {
      const cur = map.get(t.assignedTo!) ?? { total: 0, overdue: 0 };
      cur.total += 1;
      if (t.pendingDays > t.slaDays) cur.overdue += 1;
      map.set(t.assignedTo!, cur);
    });
    return [...map.entries()]
      .map(([reviewer, v]) => ({ reviewer, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [tasks]);

  const reasonMix = useMemo(
    () =>
      REASONS.map((r) => ({ reason: r, count: tasks.filter((t) => t.reason === r).length })).sort(
        (a, b) => a.count - b.count,
      ),
    [tasks],
  );

  const productivity = useMemo(() => {
    const map = new Map<string, { created: number; completed: number }>();
    tasks.forEach((t) => {
      const key = t.createdAt.slice(0, 7);
      const cur = map.get(key) ?? { created: 0, completed: 0 };
      cur.created += 1;
      if (t.status === 'completed') cur.completed += 1;
      map.set(key, cur);
    });
    const periods = [...map.keys()].sort();
    return {
      periods,
      created: periods.map((p) => map.get(p)!.created),
      completed: periods.map((p) => map.get(p)!.completed),
    };
  }, [tasks]);

  const overdue = tasks.filter((t) => t.pendingDays > t.slaDays);

  const columns: Column<ReviewTask>[] = [
    { key: 'code', header: 'Task', accessor: (t) => t.code, render: (t) => <span className="metric font-semibold">{t.code}</span>, width: '110px' },
    {
      key: 'priority',
      header: 'Priority',
      accessor: (t) => t.priorityScore,
      width: '120px',
      render: (t) => <ProgressBar value={t.priorityScore} tone={t.priorityScore > 70 ? 'red' : t.priorityScore > 45 ? 'amber' : 'teal'} />,
    },
    { key: 'reason', header: 'Reason', accessor: (t) => t.reason },
    { key: 'severity', header: 'Severity', accessor: (t) => t.severity, render: (t) => <SeverityBadge severity={t.severity} /> },
    { key: 'parcel', header: 'Parcel', accessor: (t) => t.parcelId ?? '—', render: (t) => <span className="metric">{t.parcelId ?? '—'}</span> },
    { key: 'doc', header: 'Document type', accessor: (t) => t.documentType },
    { key: 'lang', header: 'Language', accessor: (t) => t.language, render: (t) => t.language.toUpperCase() },
    { key: 'district', header: 'District', accessor: (t) => t.district },
    { key: 'conf', header: 'Confidence', accessor: (t) => t.confidence, align: 'center', render: (t) => <ConfidenceBadge value={t.confidence} /> },
    {
      key: 'sla',
      header: 'SLA',
      accessor: (t) => t.slaDays - t.pendingDays,
      align: 'center',
      render: (t) =>
        t.pendingDays > t.slaDays ? (
          <Badge tone="red">Breached by {t.pendingDays - t.slaDays}d</Badge>
        ) : (
          <Badge tone="green">{t.slaDays - t.pendingDays}d left</Badge>
        ),
    },
    { key: 'pending', header: 'Pending', accessor: (t) => t.pendingDays, align: 'right', render: (t) => relativeDays(t.pendingDays) },
    { key: 'assigned', header: 'Assigned to', accessor: (t) => t.assignedTo ?? '—' },
    { key: 'status', header: 'Status', accessor: (t) => t.status, render: (t) => <StatusBadge status={t.status} /> },
    { key: 'created', header: 'Created', accessor: (t) => t.createdAt, render: (t) => formatDate(t.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (t) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn-secondary px-1.5 py-0.5 text-2xs"
            onClick={() => {
              const doc = dataset.documents.find((d) => d.id === t.documentId);
              if (doc) navigate(`/digitization/${doc.code}`);
            }}
          >
            Open
          </button>
          <Can permission="review.assign">
            <button className="btn-secondary px-1.5 py-0.5 text-2xs" onClick={() => setReviewStatus(t.id, 'completed')}>
              Complete
            </button>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Human Review Queue"
        description="Cases are prioritised, not simply listed. Priority combines extraction confidence, conflict severity, project exposure and ageing against the service-level target."
        trail={[{ label: 'Review Queue' }]}
        actions={
          <button
            className="btn-secondary"
            onClick={() =>
              exportCsv(
                tasks.map((t) => ({
                  code: t.code,
                  reason: t.reason,
                  severity: t.severity,
                  parcelId: t.parcelId,
                  documentType: t.documentType,
                  language: t.language,
                  district: t.district,
                  state: t.state,
                  confidence: t.confidence,
                  priorityScore: t.priorityScore,
                  pendingDays: t.pendingDays,
                  slaDays: t.slaDays,
                  assignedTo: t.assignedTo,
                  status: t.status,
                })),
                'review-queue',
              )
            }
          >
            Export queue
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Tasks in view" value={tasks.length.toLocaleString('en-IN')} />
        <StatTile label="Unassigned" value={String(tasks.filter((t) => t.status === 'unassigned').length)} tone="amber" />
        <StatTile label="SLA breached" value={String(overdue.length)} tone="red" />
        <StatTile label="Escalated" value={String(tasks.filter((t) => t.status === 'escalated').length)} tone="red" />
        <StatTile label="Completed" value={String(tasks.filter((t) => t.status === 'completed').length)} tone="green" />
        <StatTile label="Mean priority" value={String(round(mean(tasks.map((t) => t.priorityScore)), 1))} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ChartCard
          title="Queue composition"
          subtitle="Tasks by review reason"
          height={260}
          isEmpty={reasonMix.every((r) => r.count === 0)}
          option={horizontalBarOption(
            reasonMix.map((r) => r.reason),
            reasonMix.map((r) => r.count),
            { valueName: 'tasks', color: THEME.amber },
          )}
          exportName="review-reasons"
          exportRows={reasonMix}
        />
        <ChartCard
          title="Reviewer workload"
          subtitle="Assigned tasks and SLA breaches"
          height={260}
          isEmpty={!workload.length}
          option={horizontalBarOption(
            workload.map((w) => w.reviewer),
            workload.map((w) => w.total),
            { valueName: 'assigned tasks', color: THEME.teal },
          )}
          exportName="reviewer-workload"
          exportRows={workload}
        />
        <ChartCard
          title="Review productivity"
          subtitle="Tasks created versus completed"
          height={260}
          isEmpty={!productivity.periods.length}
          option={multiLineOption(
            productivity.periods,
            [
              { name: 'Created', data: productivity.created, color: THEME.blue },
              { name: 'Completed', data: productivity.completed, color: THEME.green },
            ],
            { asMonths: true, yName: 'tasks' },
          )}
          exportName="review-productivity"
          exportRows={productivity.periods.map((p, i) => ({
            period: p,
            created: productivity.created[i],
            completed: productivity.completed[i],
          }))}
        />
      </div>

      <Card title="Filters" subtitle="Save a filter combination as a named view for repeated use">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          <TextInput
            className="text-2xs"
            placeholder="Search task, parcel, reviewer…"
            value={search}
            aria-label="Search review tasks"
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            className="text-2xs"
            aria-label="Filter reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReviewReason | 'ALL')}
            options={[{ value: 'ALL', label: 'All reasons' }, ...REASONS.map((r) => ({ value: r, label: r }))]}
          />
          <Select
            className="text-2xs"
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
            className="text-2xs"
            aria-label="Filter language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode | 'ALL')}
            options={[{ value: 'ALL', label: 'All languages' }, ...LANGUAGES.map((l) => ({ value: l.code, label: l.label }))]}
          />
          <Select
            className="text-2xs"
            aria-label="Filter document type"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType | 'ALL')}
            options={[{ value: 'ALL', label: 'All document types' }, ...DOCUMENT_TYPES.map((d) => ({ value: d, label: d }))]}
          />
          <Select
            className="text-2xs"
            aria-label="Filter status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            options={[
              { value: 'ALL', label: 'All statuses' },
              { value: 'unassigned', label: 'Unassigned' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'escalated', label: 'Escalated' },
            ]}
          />
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
              Confidence below {confidenceMax}%
            </span>
            <input
              type="range"
              min={30}
              max={100}
              value={confidenceMax}
              className="accent-teal"
              aria-label="Maximum confidence"
              onChange={(e) => setConfidenceMax(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
              Pending at least {pendingMin} days
            </span>
            <input
              type="range"
              min={0}
              max={120}
              value={pendingMin}
              className="accent-teal"
              aria-label="Minimum pending days"
              onChange={(e) => setPendingMin(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <TextInput
            className="w-48 text-2xs"
            placeholder="Saved view name"
            value={viewName}
            aria-label="Saved view name"
            onChange={(e) => setViewName(e.target.value)}
          />
          <button
            className="btn-secondary py-1 text-2xs"
            disabled={!viewName.trim()}
            onClick={() => {
              saveView(viewName.trim());
              setViewName('');
            }}
          >
            Save current view
          </button>
          {Object.keys(savedViews).map((name) => (
            <Badge key={name} tone="teal">
              {name}
            </Badge>
          ))}
        </div>
      </Card>

      <Card
        dense
        title={`Prioritised queue (${tasks.length.toLocaleString('en-IN')})`}
        actions={
          <Can permission="review.assign">
            <div className="flex items-center gap-1.5">
              <TextInput
                className="w-40 py-1 text-2xs"
                placeholder="Assign to officer"
                value={officer}
                aria-label="Officer name for bulk assignment"
                onChange={(e) => setOfficer(e.target.value)}
              />
              <button
                className="btn-teal py-1 text-2xs"
                disabled={!selected.length || !officer.trim()}
                onClick={() => {
                  assignReview(selected, officer.trim());
                  setSelected([]);
                  setOfficer('');
                }}
              >
                Bulk assign ({selected.length})
              </button>
            </div>
          </Can>
        }
      >
        <DataTable
          rows={tasks}
          columns={columns}
          rowKey={(t) => t.id}
          pageSize={14}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          initialSort={{ key: 'priority', dir: 'desc' }}
        />
      </Card>
    </div>
  );
}
