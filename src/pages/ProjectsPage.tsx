import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { RiskBadge } from '@/components/ui/Badge';
import { ProgressBar, Select, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { getDataset } from '@/data/dataset';
import { useScope } from '@/hooks/useScope';
import { filterProjects } from '@/services/analytics';
import { LIFECYCLE_STAGES, PROJECT_TYPE_LABEL, PROJECT_TYPES, STAGE_LABEL } from '@/config/constants';
import { formatArea, formatCompact, formatCurrency, formatDate } from '@/lib/format';
import { exportCsv, exportExcel } from '@/lib/export';
import { sum } from '@/lib/stats';
import type { LifecycleStage, Project, ProjectType, RiskLevel } from '@/types';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<ProjectType | 'ALL'>('ALL');
  const [stage, setStage] = useState<LifecycleStage | 'ALL'>('ALL');
  const [risk, setRisk] = useState<RiskLevel | 'ALL'>('ALL');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filterProjects(dataset.projects, scope).filter(
      (p) =>
        (type === 'ALL' || p.projectType === type) &&
        (stage === 'ALL' || p.currentStage === stage) &&
        (risk === 'ALL' || p.riskLevel === risk) &&
        (!q ||
          `${p.code} ${p.name} ${p.district} ${p.state} ${p.implementingAgency} ${p.projectOfficer}`
            .toLowerCase()
            .includes(q)),
    );
  }, [dataset.projects, scope, search, type, stage, risk]);

  const totals = useMemo(
    () => ({
      proposed: sum(rows.map((p) => p.proposedArea)),
      acquired: sum(rows.map((p) => p.acquiredArea)),
      families: sum(rows.map((p) => p.affectedFamilies)),
      assessed: sum(rows.map((p) => p.compensationAssessed)),
      paid: sum(rows.map((p) => p.compensationPaid)),
      critical: rows.filter((p) => p.riskLevel === 'critical').length,
    }),
    [rows],
  );

  const columns: Column<Project>[] = [
    { key: 'code', header: 'Code', accessor: (p) => p.code, render: (p) => <span className="metric font-semibold">{p.code}</span>, width: '92px' },
    {
      key: 'name',
      header: 'Project',
      accessor: (p) => p.name,
      render: (p) => (
        <span className="block">
          <span className="block font-medium leading-tight">{p.name}</span>
          <span className="block text-2xs text-muted">{p.implementingAgency}</span>
        </span>
      ),
      width: '260px',
    },
    { key: 'type', header: 'Type', accessor: (p) => p.projectType, render: (p) => PROJECT_TYPE_LABEL[p.projectType] },
    { key: 'state', header: 'State', accessor: (p) => p.state },
    { key: 'district', header: 'District', accessor: (p) => p.district },
    { key: 'stage', header: 'Stage', accessor: (p) => p.currentStage, render: (p) => STAGE_LABEL[p.currentStage] },
    { key: 'proposed', header: 'Proposed area', accessor: (p) => p.proposedArea, align: 'right', render: (p) => formatArea(p.proposedArea, 0) },
    { key: 'acquired', header: 'Acquired area', accessor: (p) => p.acquiredArea, align: 'right', render: (p) => formatArea(p.acquiredArea, 0) },
    { key: 'families', header: 'Families', accessor: (p) => p.affectedFamilies, align: 'right', render: (p) => formatCompact(p.affectedFamilies) },
    { key: 'assessed', header: 'Assessed', accessor: (p) => p.compensationAssessed, align: 'right', render: (p) => formatCurrency(p.compensationAssessed) },
    { key: 'paid', header: 'Paid', accessor: (p) => p.compensationPaid, align: 'right', render: (p) => formatCurrency(p.compensationPaid) },
    { key: 'completion', header: 'Completion', accessor: (p) => p.completionPercent, width: '120px', render: (p) => <ProgressBar value={p.completionPercent} /> },
    { key: 'delay', header: 'Delay prob.', accessor: (p) => p.delayProbability, align: 'right', render: (p) => <span className="metric">{p.delayProbability}%</span> },
    { key: 'risk', header: 'Risk', accessor: (p) => p.riskScore, align: 'center', render: (p) => <RiskBadge level={p.riskLevel} score={p.riskScore} /> },
    { key: 'predicted', header: 'Predicted completion', accessor: (p) => p.predictedCompletion, render: (p) => formatDate(p.predictedCompletion) },
  ];

  const exportRows = rows.map((p) => ({
    code: p.code,
    name: p.name,
    type: PROJECT_TYPE_LABEL[p.projectType],
    state: p.state,
    district: p.district,
    stage: STAGE_LABEL[p.currentStage],
    proposedAreaHa: p.proposedArea,
    acquiredAreaHa: p.acquiredArea,
    affectedFamilies: p.affectedFamilies,
    compensationAssessed: p.compensationAssessed,
    compensationPaid: p.compensationPaid,
    possessionPercent: p.possessionPercent,
    rrProgressPercent: p.rrProgressPercent,
    completionPercent: p.completionPercent,
    delayProbability: p.delayProbability,
    riskScore: p.riskScore,
    riskLevel: p.riskLevel,
    primaryDelayDriver: p.primaryDelayDriver,
    predictedCompletion: p.predictedCompletion,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projects"
        description="Register of every land acquisition project in scope. Open a project to inspect its lifecycle, parcels, documents, compensation, legal position and risk explanation."
        trail={[{ label: 'Projects' }]}
        actions={
          <>
            <button className="btn-secondary" onClick={() => exportCsv(exportRows, 'projects')}>
              Export CSV
            </button>
            <button className="btn-secondary" onClick={() => exportExcel(exportRows, 'projects')}>
              Export Excel
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Projects" value={formatCompact(rows.length)} />
        <StatTile label="Area proposed" value={`${formatCompact(totals.proposed)} ha`} />
        <StatTile label="Area acquired" value={`${formatCompact(totals.acquired)} ha`} tone="teal" />
        <StatTile label="Affected families" value={formatCompact(totals.families)} />
        <StatTile label="Compensation paid" value={formatCurrency(totals.paid)} tone="green" hint={`of ${formatCurrency(totals.assessed)}`} />
        <StatTile label="Critical risk" value={String(totals.critical)} tone="red" />
      </div>

      <Card
        dense
        title="Project register"
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <TextInput
              className="w-56 py-1 text-2xs"
              placeholder="Search code, name, district, officer…"
              value={search}
              aria-label="Search projects"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-36 py-1 text-2xs"
              aria-label="Filter by project type"
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType | 'ALL')}
              options={[{ value: 'ALL', label: 'All types' }, ...PROJECT_TYPES.map((t) => ({ value: t, label: PROJECT_TYPE_LABEL[t] }))]}
            />
            <Select
              className="w-40 py-1 text-2xs"
              aria-label="Filter by lifecycle stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as LifecycleStage | 'ALL')}
              options={[{ value: 'ALL', label: 'All stages' }, ...LIFECYCLE_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))]}
            />
            <Select
              className="w-28 py-1 text-2xs"
              aria-label="Filter by risk level"
              value={risk}
              onChange={(e) => setRisk(e.target.value as RiskLevel | 'ALL')}
              options={[
                { value: 'ALL', label: 'All risk' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </div>
        }
      >
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          pageSize={16}
          initialSort={{ key: 'risk', dir: 'desc' }}
          onRowClick={(p) => navigate(`/projects/${p.code}`)}
        />
      </Card>
    </div>
  );
}
