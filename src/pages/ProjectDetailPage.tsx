import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, ConfidenceBadge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/kpi/KpiCard';
import { EChart } from '@/components/charts/EChart';
import { ChartCard } from '@/components/charts/ChartCard';
import { ganttOption, groupedBarOption, multiLineOption, type GanttRow } from '@/components/charts/presets';
import {
  ModelExplanationPanel,
  RiskContributorPanel,
  RiskScoreHeader,
  StageProbabilityChart,
  WhatIfSimulator,
} from '@/components/risk/RiskPanel';
import { MapView, type MapLayerSpec } from '@/components/map/MapView';
import { Can } from '@/auth/PermissionGuard';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { LIFECYCLE_STAGES, PROJECT_TYPE_LABEL, STAGE_LABEL, THEME } from '@/config/constants';
import { formatArea, formatCompact, formatCurrency, formatDate, maskIdentifier, relativeDays } from '@/lib/format';
import { parcelsToGeoJson } from '@/lib/geo';
import { exportCsv } from '@/lib/export';
import { pct } from '@/lib/stats';
import type { CompensationRecord, DocumentRecord, FieldInspection, LegalCase, Parcel } from '@/types';

export default function ProjectDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const dataset = getDataset();
  const localInterventions = useAppStore((s) => s.workspace.interventions);

  const project = useMemo(
    () => dataset.projects.find((p) => p.code === code || p.id === code),
    [dataset.projects, code],
  );

  const data = useMemo(() => {
    if (!project) return null;
    return {
      stages: dataset.projectStages.filter((s) => s.projectId === project.id),
      milestones: dataset.milestones.filter((m) => m.projectId === project.id),
      parcels: dataset.parcels.filter((p) => p.projectId === project.id),
      documents: dataset.documents.filter((d) => d.projectId === project.id),
      compensation: dataset.compensation.filter((c) => c.projectId === project.id),
      rr: dataset.rrRecords.filter((r) => r.projectId === project.id),
      legal: dataset.legalCases.filter((c) => c.projectId === project.id),
      prediction: dataset.riskPredictions.find((r) => r.projectId === project.id),
      interventions: [
        ...localInterventions.filter((i) => i.projectId === project.id),
        ...dataset.interventions.filter((i) => i.projectId === project.id),
      ],
      audits: dataset.auditLogs.filter((a) => a.entityId === project.code).slice(0, 60),
    };
  }, [project, dataset, localInterventions]);

  if (!project || !data) {
    return (
      <div className="surface-card">
        <EmptyState
          title="Project not found"
          description={`No project matches "${code}" in this environment.`}
          action={
            <button className="btn-primary" onClick={() => navigate('/projects')}>
              Back to project register
            </button>
          }
        />
      </div>
    );
  }

  const inspections = dataset.inspections.filter((i) =>
    data.parcels.some((p) => p.parcelId === i.parcelId),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.name}
        description={`${PROJECT_TYPE_LABEL[project.projectType]} · ${project.implementingAgency} · ${project.district}, ${project.state}`}
        trail={[{ label: 'Projects', to: '/projects' }, { label: project.code }]}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate(`/gis?project=${project.code}`)}>
              Open in GIS
            </button>
            <button className="btn-secondary" onClick={() => navigate(`/risk?project=${project.code}`)}>
              Risk intelligence
            </button>
            <Can permission="project.intervene">
              <button className="btn-primary" onClick={() => navigate('/reports')}>
                Export project report
              </button>
            </Can>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <StatTile label="Project ID" value={project.code} />
        <StatTile label="Land proposed" value={formatArea(project.proposedArea, 0)} />
        <StatTile label="Land acquired" value={formatArea(project.acquiredArea, 0)} tone="teal" />
        <StatTile label="Affected villages" value={String(project.affectedVillages)} />
        <StatTile label="Affected families" value={formatCompact(project.affectedFamilies)} />
        <StatTile label="Compensation paid" value={formatCurrency(project.compensationPaid)} tone="green" hint={`of ${formatCurrency(project.compensationAssessed)}`} />
        <StatTile label="Possession" value={`${project.possessionPercent}%`} />
        <StatTile label="R&R progress" value={`${project.rrProgressPercent}%`} />
      </div>

      <Tabs
        items={[
          { id: 'summary', label: 'Summary', content: <SummaryTab project={project} data={data} /> },
          { id: 'lifecycle', label: 'Lifecycle', content: <LifecycleTab stages={data.stages} milestones={data.milestones} /> },
          { id: 'parcels', label: 'Parcels', badge: data.parcels.length, content: <ParcelsTab parcels={data.parcels} onOpen={(p) => navigate(`/twins/${p.parcelId}`)} /> },
          { id: 'documents', label: 'Documents', badge: data.documents.length, content: <DocumentsTab documents={data.documents} onOpen={(d) => navigate(`/digitization/${d.code}`)} /> },
          { id: 'compensation', label: 'Compensation', badge: data.compensation.length, content: <CompensationTab records={data.compensation} /> },
          { id: 'legal', label: 'Legal cases', badge: data.legal.length, content: <LegalTab cases={data.legal} /> },
          { id: 'possession', label: 'Possession', content: <PossessionTab project={project} parcels={data.parcels} /> },
          { id: 'rr', label: 'R&R', content: <RrTab project={project} records={data.rr} /> },
          { id: 'gis', label: 'GIS evidence', content: <GisTab project={project} parcels={data.parcels} /> },
          { id: 'field', label: 'Field inspections', badge: inspections.length, content: <InspectionsTab inspections={inspections} /> },
          {
            id: 'risk',
            label: 'Risk analysis',
            content: data.prediction ? (
              <div className="space-y-3">
                <RiskScoreHeader prediction={data.prediction} project={project} />
                <div className="grid gap-3 xl:grid-cols-2">
                  <RiskContributorPanel prediction={data.prediction} />
                  <div className="space-y-3">
                    <StageProbabilityChart prediction={data.prediction} />
                    <ModelExplanationPanel prediction={data.prediction} project={project} />
                  </div>
                </div>
                <WhatIfSimulator project={project} />
              </div>
            ) : (
              <EmptyState title="No risk prediction available for this project" />
            ),
          },
          { id: 'interventions', label: 'Interventions', badge: data.interventions.length, content: <InterventionsTab interventions={data.interventions} /> },
          { id: 'audit', label: 'Audit history', content: <AuditTab events={data.audits} /> },
        ]}
      />
    </div>
  );
}

interface ProjectData {
  stages: ReturnType<typeof getDataset>['projectStages'];
  milestones: ReturnType<typeof getDataset>['milestones'];
  parcels: Parcel[];
  documents: DocumentRecord[];
  compensation: CompensationRecord[];
  rr: ReturnType<typeof getDataset>['rrRecords'];
  legal: LegalCase[];
  prediction: ReturnType<typeof getDataset>['riskPredictions'][number] | undefined;
  interventions: ReturnType<typeof getDataset>['interventions'];
  audits: ReturnType<typeof getDataset>['auditLogs'];
}

function SummaryTab({ project, data }: { project: import('@/types').Project; data: ProjectData }) {
  const compensationSeries = useMemo(() => {
    const byMonth = new Map<string, { assessed: number; paid: number }>();
    data.compensation.forEach((c) => {
      const key = c.assessedOn.slice(0, 7);
      const cur = byMonth.get(key) ?? { assessed: 0, paid: 0 };
      cur.assessed += c.amountAssessed;
      cur.paid += c.amountPaid;
      byMonth.set(key, cur);
    });
    const periods = [...byMonth.keys()].sort();
    return {
      periods,
      assessed: periods.map((p) => Math.round(byMonth.get(p)!.assessed / 1e7)),
      paid: periods.map((p) => Math.round(byMonth.get(p)!.paid / 1e7)),
    };
  }, [data.compensation]);

  return (
    <div className="grid gap-3 xl:grid-cols-[1.1fr_1fr]">
      <Card title="Project profile">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <Field label="Project ID" value={project.code} />
          <Field label="Project type" value={PROJECT_TYPE_LABEL[project.projectType]} />
          <Field label="State" value={project.state} />
          <Field label="District" value={project.district} />
          <Field label="Implementing agency" value={project.implementingAgency} />
          <Field label="Project officer" value={project.projectOfficer} />
          <Field label="Responsible office" value={project.responsibleOffice} />
          <Field label="Current stage" value={STAGE_LABEL[project.currentStage]} />
          <Field label="Start date" value={formatDate(project.startDate)} />
          <Field label="Planned completion" value={formatDate(project.plannedCompletion)} />
          <Field label="Predicted completion" value={formatDate(project.predictedCompletion)} />
          <Field label="Budget" value={`₹${project.budgetCrore.toLocaleString('en-IN')} Cr`} />
          <Field label="Open legal cases" value={String(project.openLegalCases)} />
          <Field label="Open document conflicts" value={String(project.openDocumentConflicts)} />
          <Field label="GIS discrepancies" value={String(project.gisDiscrepancies)} />
          <Field label="Primary delay driver" value={project.primaryDelayDriver} />
        </dl>

        <div className="mt-3 space-y-2">
          <LabeledProgress label="Project completion" value={project.completionPercent} tone="teal" />
          <LabeledProgress label="Land acquired" value={pct(project.acquiredArea, project.proposedArea)} tone="blue" />
          <LabeledProgress label="Compensation disbursed" value={pct(project.compensationPaid, project.compensationAssessed)} tone="green" />
          <LabeledProgress label="Possession" value={project.possessionPercent} tone="amber" />
          <LabeledProgress label="R&R progress" value={project.rrProgressPercent} tone="amber" />
          <LabeledProgress label="Delay probability" value={project.delayProbability} tone="red" />
        </div>
      </Card>

      <div className="space-y-3">
        <Card title="Risk position" subtitle="Decision-support summary">
          <div className="flex items-center gap-4">
            <div>
              <p className="metric text-[38px] font-semibold leading-none">{project.riskScore}</p>
              <RiskBadge level={project.riskLevel} />
            </div>
            <div className="flex-1 space-y-1.5">
              {data.prediction?.contributors.slice(0, 4).map((c) => (
                <div key={c.factor}>
                  <div className="flex justify-between text-2xs">
                    <span>{c.factor}</span>
                    <span className="metric">+{c.contribution}</span>
                  </div>
                  <ProgressBar value={c.contribution * 5} tone="amber" showLabel={false} height={4} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <ChartCard
          title="Compensation progress"
          subtitle="₹ crore assessed versus disbursed by month"
          height={240}
          isEmpty={!compensationSeries.periods.length}
          option={multiLineOption(
            compensationSeries.periods,
            [
              { name: 'Assessed', data: compensationSeries.assessed, color: THEME.blue, area: true },
              { name: 'Paid', data: compensationSeries.paid, color: THEME.green, area: true },
            ],
            { asMonths: true, yName: '₹ Cr' },
          )}
          exportName={`${project.code}-compensation`}
          exportRows={compensationSeries.periods.map((p, i) => ({
            period: p,
            assessedCr: compensationSeries.assessed[i],
            paidCr: compensationSeries.paid[i],
          }))}
        />

        <Card title="Milestone log" dense>
          <ul className="max-h-64 divide-y divide-line/40 overflow-y-auto scroll-thin">
            {data.milestones.slice(0, 24).map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2 px-3 py-1.5">
                <span>
                  <span className="block text-[13px]">{m.title}</span>
                  <span className="block text-2xs text-muted">
                    {STAGE_LABEL[m.stage]} · due {formatDate(m.dueDate)}
                  </span>
                </span>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function LifecycleTab({
  stages,
  milestones,
}: {
  stages: ProjectData['stages'];
  milestones: ProjectData['milestones'];
}) {
  const rows: GanttRow[] = stages.map((s) => ({
    name: STAGE_LABEL[s.stage],
    plannedStart: new Date(s.plannedStart).getTime(),
    plannedEnd: new Date(s.plannedEnd).getTime(),
    actualStart: s.actualStart ? new Date(s.actualStart).getTime() : null,
    actualEnd: s.actualEnd ? new Date(s.actualEnd).getTime() : null,
    delayed: s.status === 'delayed',
    critical: s.onCriticalPath,
  }));

  const columns: Column<ProjectData['stages'][number]>[] = [
    { key: 'stage', header: 'Stage', accessor: (s) => LIFECYCLE_STAGES.indexOf(s.stage), render: (s) => STAGE_LABEL[s.stage] },
    { key: 'status', header: 'Status', accessor: (s) => s.status, render: (s) => <StatusBadge status={s.status} /> },
    { key: 'completed', header: 'Completed', accessor: (s) => s.completedCases, align: 'right' },
    { key: 'pending', header: 'Pending', accessor: (s) => s.pendingCases, align: 'right' },
    { key: 'delayed', header: 'Delayed', accessor: (s) => s.delayedCases, align: 'right' },
    { key: 'avg', header: 'Avg duration', accessor: (s) => s.averageDurationDays, align: 'right', render: (s) => `${s.averageDurationDays} d` },
    { key: 'statutory', header: 'Statutory', accessor: (s) => s.statutoryDeadlineDays, align: 'right', render: (s) => `${s.statutoryDeadlineDays} d` },
    { key: 'remaining', header: 'Days remaining', accessor: (s) => s.daysRemaining, align: 'right', render: (s) => <span className={s.daysRemaining < 0 ? 'metric text-signal-red' : 'metric'}>{s.daysRemaining}</span> },
    { key: 'officer', header: 'Responsible officer', accessor: (s) => s.responsibleOfficer },
    { key: 'docs', header: 'Pending docs', accessor: (s) => s.pendingDocuments, align: 'right' },
    { key: 'risk', header: 'Risk contribution', accessor: (s) => s.riskContribution, align: 'right', render: (s) => `${s.riskContribution}` },
    { key: 'deps', header: 'Depends on', sortable: false, render: (s) => (s.dependsOn.length ? STAGE_LABEL[s.dependsOn[0]] : '—') },
    { key: 'cp', header: 'Critical path', sortable: false, render: (s) => (s.onCriticalPath ? <Badge tone="red">On critical path</Badge> : <Badge tone="neutral">No</Badge>) },
  ];

  return (
    <div className="space-y-3">
      <Card title="Lifecycle schedule" subtitle="Planned versus actual duration with critical path highlighting">
        <EChart option={ganttOption(rows, new Date('2026-09-09').getTime())} height={360} ariaLabel="Project lifecycle Gantt" />
      </Card>
      <Card dense title="Stage detail">
        <DataTable rows={stages} columns={columns} rowKey={(s) => s.id} pageSize={11} />
      </Card>
      <Card dense title="Upcoming milestones">
        <DataTable
          rows={milestones.filter((m) => m.status !== 'completed')}
          columns={[
            { key: 'title', header: 'Milestone', accessor: (m) => m.title },
            { key: 'stage', header: 'Stage', accessor: (m) => m.stage, render: (m) => STAGE_LABEL[m.stage] },
            { key: 'due', header: 'Due', accessor: (m) => m.dueDate, render: (m) => formatDate(m.dueDate) },
            { key: 'status', header: 'Status', accessor: (m) => m.status, render: (m) => <StatusBadge status={m.status} /> },
            { key: 'note', header: 'Note', accessor: (m) => m.note },
          ]}
          rowKey={(m) => m.id}
          pageSize={8}
        />
      </Card>
    </div>
  );
}

function ParcelsTab({ parcels, onOpen }: { parcels: Parcel[]; onOpen: (p: Parcel) => void }) {
  const columns: Column<Parcel>[] = [
    { key: 'id', header: 'Parcel', accessor: (p) => p.parcelId, render: (p) => <span className="metric font-semibold">{p.parcelId}</span> },
    { key: 'survey', header: 'Survey no.', accessor: (p) => p.surveyNumber },
    { key: 'khasra', header: 'Khasra', accessor: (p) => p.khasraNumber },
    { key: 'owner', header: 'Owner of record', accessor: (p) => p.owner },
    { key: 'village', header: 'Village', accessor: (p) => p.village },
    { key: 'area', header: 'Recorded area', accessor: (p) => p.area, align: 'right', render: (p) => formatArea(p.area) },
    { key: 'gis', header: 'GIS area', accessor: (p) => p.gisArea, align: 'right', render: (p) => formatArea(p.gisArea) },
    {
      key: 'dev',
      header: 'Deviation',
      accessor: (p) => Math.abs(p.area - p.gisArea) / p.area,
      align: 'right',
      render: (p) => {
        const dev = ((p.area - p.gisArea) / p.area) * 100;
        return <span className={Math.abs(dev) > 12 ? 'metric text-signal-red' : 'metric'}>{dev.toFixed(1)}%</span>;
      },
    },
    { key: 'acq', header: 'Acquisition', accessor: (p) => p.acquisitionStatus, render: (p) => <StatusBadge status={p.acquisitionStatus} /> },
    { key: 'poss', header: 'Possession', accessor: (p) => p.possessionStatus, render: (p) => <StatusBadge status={p.possessionStatus} /> },
    { key: 'legal', header: 'Legal', accessor: (p) => p.legalStatus, render: (p) => <StatusBadge status={p.legalStatus} /> },
    { key: 'trust', header: 'Trust', accessor: (p) => p.trustScore, align: 'right', render: (p) => <span className="metric">{p.trustScore}</span> },
  ];
  return (
    <Card
      dense
      title={`Parcels (${parcels.length.toLocaleString('en-IN')})`}
      actions={
        <button
          className="btn-secondary py-1 text-2xs"
          onClick={() => exportCsv(parcels.map((p) => ({ ...p, boundary: undefined, centroid: undefined })), 'project-parcels')}
        >
          Export CSV
        </button>
      }
    >
      <DataTable rows={parcels} columns={columns} rowKey={(p) => p.id} pageSize={12} onRowClick={onOpen} />
    </Card>
  );
}

function DocumentsTab({ documents, onOpen }: { documents: DocumentRecord[]; onOpen: (d: DocumentRecord) => void }) {
  const columns: Column<DocumentRecord>[] = [
    { key: 'code', header: 'Document', accessor: (d) => d.code, render: (d) => <span className="metric font-semibold">{d.code}</span> },
    { key: 'type', header: 'Type', accessor: (d) => d.documentType },
    { key: 'lang', header: 'Language', accessor: (d) => d.language, render: (d) => `${d.language.toUpperCase()} · ${d.script}` },
    { key: 'pages', header: 'Pages', accessor: (d) => d.pages, align: 'right' },
    { key: 'stage', header: 'Pipeline stage', accessor: (d) => d.processingStage, render: (d) => <StatusBadge status={d.processingStage} /> },
    { key: 'conf', header: 'OCR confidence', accessor: (d) => d.ocrConfidence, align: 'center', render: (d) => <ConfidenceBadge value={d.ocrConfidence} /> },
    { key: 'issues', header: 'Validation issues', accessor: (d) => d.validationIssues, align: 'right' },
    { key: 'status', header: 'Status', accessor: (d) => d.status, render: (d) => <StatusBadge status={d.status} /> },
    { key: 'uploaded', header: 'Uploaded', accessor: (d) => d.uploadedAt, render: (d) => formatDate(d.uploadedAt) },
  ];
  return (
    <Card dense title={`Documents (${documents.length.toLocaleString('en-IN')})`}>
      <DataTable rows={documents} columns={columns} rowKey={(d) => d.id} pageSize={12} onRowClick={onOpen} />
    </Card>
  );
}

function CompensationTab({ records }: { records: CompensationRecord[] }) {
  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => map.set(r.status, (map.get(r.status) ?? 0) + 1));
    return [...map.entries()];
  }, [records]);

  const columns: Column<CompensationRecord>[] = [
    { key: 'ben', header: 'Beneficiary', accessor: (r) => r.beneficiaryId, render: (r) => <span className="metric">{r.beneficiaryId}</span> },
    { key: 'parcel', header: 'Parcel', accessor: (r) => r.parcelId },
    { key: 'assessed', header: 'Assessed', accessor: (r) => r.amountAssessed, align: 'right', render: (r) => formatCurrency(r.amountAssessed) },
    { key: 'paid', header: 'Paid', accessor: (r) => r.amountPaid, align: 'right', render: (r) => formatCurrency(r.amountPaid) },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'assessedOn', header: 'Assessed on', accessor: (r) => r.assessedOn, render: (r) => formatDate(r.assessedOn) },
    { key: 'delay', header: 'Delay (days)', accessor: (r) => r.disbursementDelayDays, align: 'right' },
    { key: 'reason', header: 'Failure reason', accessor: (r) => r.failureReason ?? '—' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {byStatus.map(([status, count]) => (
          <StatTile key={status} label={status} value={String(count)} />
        ))}
      </div>
      <Card dense title="Compensation records">
        <DataTable rows={records} columns={columns} rowKey={(r) => r.id} pageSize={12} />
      </Card>
    </div>
  );
}

function LegalTab({ cases }: { cases: LegalCase[] }) {
  const columns: Column<LegalCase>[] = [
    { key: 'no', header: 'Case number', accessor: (c) => c.caseNumber, render: (c) => <span className="metric">{c.caseNumber}</span> },
    { key: 'court', header: 'Court', accessor: (c) => c.court },
    { key: 'subject', header: 'Subject', accessor: (c) => c.subject },
    { key: 'parcel', header: 'Parcel', accessor: (c) => c.parcelId ?? '—' },
    { key: 'filed', header: 'Filed on', accessor: (c) => c.filedOn, render: (c) => formatDate(c.filedOn) },
    { key: 'status', header: 'Status', accessor: (c) => c.status, render: (c) => <StatusBadge status={c.status} /> },
    { key: 'hearing', header: 'Next hearing', accessor: (c) => c.nextHearing ?? '', render: (c) => formatDate(c.nextHearing) },
    { key: 'impact', header: 'Impact', accessor: (c) => c.impact, render: (c) => <RiskBadge level={c.impact} /> },
  ];
  return (
    <Card dense title={`Legal cases (${cases.length})`}>
      <DataTable rows={cases} columns={columns} rowKey={(c) => c.id} pageSize={12} emptyTitle="No legal cases recorded for this project" />
    </Card>
  );
}

function PossessionTab({ project, parcels }: { project: import('@/types').Project; parcels: Parcel[] }) {
  const counts = useMemo(() => {
    const map = { 'Not Taken': 0, Partial: 0, Complete: 0 } as Record<string, number>;
    parcels.forEach((p) => {
      map[p.possessionStatus] = (map[p.possessionStatus] ?? 0) + 1;
    });
    return map;
  }, [parcels]);

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Card title="Possession position">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Not taken" value={String(counts['Not Taken'] ?? 0)} tone="red" />
          <StatTile label="Partial" value={String(counts.Partial ?? 0)} tone="amber" />
          <StatTile label="Complete" value={String(counts.Complete ?? 0)} tone="green" />
        </div>
        <div className="mt-3">
          <LabeledProgress label="Project possession progress" value={project.possessionPercent} tone="teal" />
        </div>
      </Card>
      <ChartCard
        title="Possession versus acquisition"
        subtitle="Parcel counts by acquisition status"
        height={260}
        isEmpty={!parcels.length}
        option={groupedBarOption(
          ['Not Notified', 'Notified', 'Awarded', 'Compensated', 'Possessed'],
          [
            {
              name: 'Parcels',
              data: ['Not Notified', 'Notified', 'Awarded', 'Compensated', 'Possessed'].map(
                (s) => parcels.filter((p) => p.acquisitionStatus === s).length,
              ),
              color: THEME.teal,
            },
          ],
          'parcels',
        )}
        exportName={`${project.code}-possession`}
        exportRows={parcels.map((p) => ({ parcelId: p.parcelId, acquisitionStatus: p.acquisitionStatus, possessionStatus: p.possessionStatus }))}
      />
    </div>
  );
}

function RrTab({ project, records }: { project: import('@/types').Project; records: ProjectData['rr'] }) {
  const columns: Column<ProjectData['rr'][number]>[] = [
    { key: 'ben', header: 'Beneficiary', accessor: (r) => r.beneficiaryId },
    { key: 'elig', header: 'Eligibility', accessor: (r) => r.eligibility, render: (r) => <StatusBadge status={r.eligibility} /> },
    { key: 'ent', header: 'Entitlements', accessor: (r) => r.entitlements.join(', '), render: (r) => <span className="text-2xs">{r.entitlements.join(', ') || '—'}</span> },
    { key: 'site', header: 'Site allotted', accessor: (r) => (r.siteAllotted ? 'Yes' : 'No') },
    { key: 'code', header: 'Site code', accessor: (r) => r.siteCode ?? '—' },
    { key: 'disb', header: 'Benefits disbursed', accessor: (r) => r.benefitsDisbursedPercent, width: '140px', render: (r) => <ProgressBar value={r.benefitsDisbursedPercent} /> },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <div className="space-y-3">
      <Card title="Rehabilitation and resettlement">
        <LabeledProgress label="Overall R&R progress" value={project.rrProgressPercent} tone="teal" />
      </Card>
      <Card dense title={`R&R records (${records.length})`}>
        <DataTable rows={records} columns={columns} rowKey={(r) => r.id} pageSize={12} />
      </Card>
    </div>
  );
}

function GisTab({ project, parcels }: { project: import('@/types').Project; parcels: Parcel[] }) {
  const layers: MapLayerSpec[] = useMemo(
    () => [
      {
        id: 'project-parcels',
        label: 'Project parcels',
        group: 'project',
        visible: true,
        kind: 'polygon',
        data: parcelsToGeoJson(parcels.slice(0, 800)),
        style: { color: THEME.ink, weight: 1, fillColor: THEME.teal, fillOpacity: 0.22 },
        popup: (p) =>
          `<b>${p.parcelId}</b><br/>Owner: ${p.owner}<br/>Survey: ${p.surveyNumber}<br/>Recorded: ${p.area} ha · GIS: ${p.gisArea} ha<br/>Status: ${p.acquisitionStatus}`,
      },
      {
        id: 'mismatch',
        label: 'GIS mismatch parcels',
        group: 'cadastral',
        visible: true,
        kind: 'polygon',
        data: parcelsToGeoJson(
          parcels.filter((p) => Math.abs(p.area - p.gisArea) / p.area > 0.12).slice(0, 300),
        ),
        style: { color: THEME.red, weight: 2, fillColor: THEME.red, fillOpacity: 0.2 },
        popup: (p) => `<b>${p.parcelId}</b><br/>Area deviation: ${p.areaMismatchPercent}%`,
      },
    ],
    [parcels],
  );

  return (
    <Card
      title="GIS evidence"
      subtitle={`${parcels.length.toLocaleString('en-IN')} parcels linked to this project · red outlines indicate an area deviation above 12%`}
      dense
    >
      <MapView
        layers={layers}
        center={[project.centroid[1], project.centroid[0]]}
        zoom={11}
        height={460}
      />
    </Card>
  );
}

function InspectionsTab({ inspections }: { inspections: FieldInspection[] }) {
  const columns: Column<FieldInspection>[] = [
    { key: 'code', header: 'Inspection', accessor: (i) => i.code, render: (i) => <span className="metric">{i.code}</span> },
    { key: 'parcel', header: 'Parcel', accessor: (i) => i.parcelId },
    { key: 'officer', header: 'Officer', accessor: (i) => i.officer },
    { key: 'date', header: 'Inspected on', accessor: (i) => i.inspectedOn, render: (i) => formatDate(i.inspectedOn) },
    { key: 'findings', header: 'Findings', accessor: (i) => i.findings },
    { key: 'poss', header: 'Possession observed', accessor: (i) => (i.possessionObserved ? 'Yes' : 'No') },
    { key: 'enc', header: 'Encroachment', accessor: (i) => (i.encroachmentObserved ? 'Yes' : 'No'), render: (i) => (i.encroachmentObserved ? <Badge tone="red">Observed</Badge> : <Badge tone="green">None</Badge>) },
    { key: 'photos', header: 'Evidence', accessor: (i) => i.photographs.length, align: 'right' },
    { key: 'status', header: 'Verification', accessor: (i) => i.verificationStatus, render: (i) => <StatusBadge status={i.verificationStatus} /> },
  ];
  return (
    <Card dense title={`Field inspections (${inspections.length})`}>
      <DataTable rows={inspections} columns={columns} rowKey={(i) => i.id} pageSize={12} emptyTitle="No field inspections recorded" />
    </Card>
  );
}

function InterventionsTab({ interventions }: { interventions: ProjectData['interventions'] }) {
  return (
    <Card dense title={`Interventions (${interventions.length})`}>
      {interventions.length === 0 ? (
        <EmptyState
          title="No interventions recorded"
          description="Create an intervention from the priority queue on the Overview dashboard or from the risk module."
        />
      ) : (
        <ul className="divide-y divide-line/40">
          {interventions.map((i) => (
            <li key={i.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">
                  <span className="metric">{i.code}</span> · {i.title}
                </span>
                <span className="flex items-center gap-1.5">
                  <RiskBadge level={i.priority} />
                  <StatusBadge status={i.status} />
                </span>
              </div>
              <p className="mt-0.5 text-2xs text-muted">{i.description}</p>
              <p className="mt-0.5 text-2xs text-muted">
                {i.assignedOffice} · officer {i.assignedOfficer ?? 'unassigned'} · due {formatDate(i.dueDate)} ·
                expected reduction {i.expectedRiskReduction} points
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AuditTab({ events }: { events: ProjectData['audits'] }) {
  return (
    <Card dense title="Audit history">
      <DataTable
        rows={events}
        columns={[
          { key: 'ts', header: 'Timestamp', accessor: (e) => e.timestamp, render: (e) => formatDate(e.timestamp) },
          { key: 'actor', header: 'Actor', accessor: (e) => e.actor },
          { key: 'role', header: 'Role', accessor: (e) => e.role, render: (e) => e.role.replace(/_/g, ' ') },
          { key: 'action', header: 'Action', accessor: (e) => e.action },
          { key: 'entity', header: 'Entity', accessor: (e) => `${e.entityType} ${e.entityId}` },
          { key: 'reason', header: 'Reason', accessor: (e) => e.reason },
          { key: 'ip', header: 'Source IP', accessor: (e) => e.sourceIp, render: (e) => <span className="metric text-2xs">{maskIdentifier(e.sourceIp, 3)}</span> },
        ]}
        rowKey={(e) => e.id}
        pageSize={12}
        emptyTitle="No audit entries recorded for this project yet"
      />
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="metric text-[13px]">{value}</dd>
    </div>
  );
}

function LabeledProgress({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'teal' | 'green' | 'amber' | 'red' | 'blue';
}) {
  return (
    <div>
      <p className="mb-0.5 text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <ProgressBar value={value} tone={tone} />
    </div>
  );
}
