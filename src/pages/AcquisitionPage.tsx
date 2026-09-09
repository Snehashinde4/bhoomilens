import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Form';
import { EChart } from '@/components/charts/EChart';
import { ganttOption, groupedBarOption, stackedBarOption, type GanttRow } from '@/components/charts/presets';
import { getDataset } from '@/data/dataset';
import { useScope } from '@/hooks/useScope';
import { filterProjects } from '@/services/analytics';
import { LIFECYCLE_STAGES, PROJECT_TYPE_LABEL, STAGE_LABEL, STAGE_STATUTORY_DAYS, THEME } from '@/config/constants';
import { formatArea, formatCurrency, formatDate, relativeDays } from '@/lib/format';
import { mean, round } from '@/lib/stats';
import { exportCsv } from '@/lib/export';
import type { LifecycleStage, Project } from '@/types';

export default function AcquisitionPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();

  const projects = useMemo(() => filterProjects(dataset.projects, scope), [dataset, scope]);

  const stageSummary = useMemo(() => {
    return LIFECYCLE_STAGES.map((stage) => {
      const inStage = projects.filter((p) => p.currentStage === stage);
      const stages = dataset.projectStages.filter(
        (s) => s.stage === stage && inStage.some((p) => p.id === s.projectId),
      );
      return {
        stage,
        projects: inStage,
        completed: stages.reduce((s, x) => s + x.completedCases, 0),
        pending: stages.reduce((s, x) => s + x.pendingCases, 0),
        delayed: stages.reduce((s, x) => s + x.delayedCases, 0),
        avgDuration: round(mean(stages.map((s) => s.averageDurationDays)), 0),
        statutory: STAGE_STATUTORY_DAYS[stage],
        pendingDocuments: stages.reduce((s, x) => s + x.pendingDocuments, 0),
        riskContribution: round(mean(stages.map((s) => s.riskContribution)), 1),
        officer: stages[0]?.responsibleOfficer ?? '—',
        daysRemaining: round(mean(stages.map((s) => s.daysRemaining)), 0),
      };
    });
  }, [projects, dataset.projectStages]);

  const stateComparison = useMemo(() => {
    const map = new Map<string, { notified: number; acquired: number; possession: number; rr: number; count: number }>();
    projects.forEach((p) => {
      const cur = map.get(p.state) ?? { notified: 0, acquired: 0, possession: 0, rr: 0, count: 0 };
      cur.notified += p.proposedArea;
      cur.acquired += p.acquiredArea;
      cur.possession += p.possessionPercent;
      cur.rr += p.rrProgressPercent;
      cur.count += 1;
      map.set(p.state, cur);
    });
    const states = [...map.keys()].sort();
    return {
      states,
      notified: states.map((s) => round(map.get(s)!.notified, 0)),
      acquired: states.map((s) => round(map.get(s)!.acquired, 0)),
      possession: states.map((s) => round(map.get(s)!.possession / map.get(s)!.count, 1)),
      rr: states.map((s) => round(map.get(s)!.rr / map.get(s)!.count, 1)),
    };
  }, [projects]);

  const districtComparison = useMemo(() => {
    const map = new Map<string, { delay: number; count: number; acquired: number; proposed: number }>();
    projects.forEach((p) => {
      const cur = map.get(p.district) ?? { delay: 0, count: 0, acquired: 0, proposed: 0 };
      cur.delay += p.delayProbability;
      cur.count += 1;
      cur.acquired += p.acquiredArea;
      cur.proposed += p.proposedArea;
      map.set(p.district, cur);
    });
    return [...map.entries()]
      .map(([district, v]) => ({
        district,
        delay: round(v.delay / v.count, 1),
        progress: round(v.proposed ? (v.acquired / v.proposed) * 100 : 0, 1),
        projects: v.count,
      }))
      .sort((a, b) => b.delay - a.delay)
      .slice(0, 14);
  }, [projects]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Land Acquisition Monitor"
        description="The complete statutory lifecycle from proposal to closure, with stage-level workload, statutory reference durations and delay exposure."
        trail={[{ label: 'Acquisition Monitor' }]}
        actions={
          <button
            className="btn-secondary"
            onClick={() =>
              exportCsv(
                stageSummary.map((s) => ({
                  stage: STAGE_LABEL[s.stage],
                  projectsInStage: s.projects.length,
                  completedCases: s.completed,
                  pendingCases: s.pending,
                  delayedCases: s.delayed,
                  averageDurationDays: s.avgDuration,
                  statutoryDays: s.statutory,
                  pendingDocuments: s.pendingDocuments,
                })),
                'acquisition-lifecycle-summary',
              )
            }
          >
            Export lifecycle summary
          </button>
        }
      />

      <Tabs
        items={[
          { id: 'kanban', label: 'Lifecycle (Kanban)', content: <KanbanView summary={stageSummary} onOpen={(p) => navigate(`/projects/${p.code}`)} /> },
          { id: 'stages', label: 'Stage workload', content: <StageTable summary={stageSummary} /> },
          { id: 'gantt', label: 'Gantt & critical path', content: <GanttView projects={projects} /> },
          { id: 'timeline', label: 'Timeline', content: <TimelineView projects={projects} onOpen={(p) => navigate(`/projects/${p.code}`)} /> },
          {
            id: 'compare',
            label: 'State & district comparison',
            content: (
              <div className="grid gap-3 xl:grid-cols-2">
                <ChartCard
                  title="Acquisition by state"
                  subtitle="Notified versus acquired area"
                  height={320}
                  isEmpty={!stateComparison.states.length}
                  option={stackedBarOption(stateComparison.states, [
                    { name: 'Notified (ha)', data: stateComparison.notified },
                    { name: 'Acquired (ha)', data: stateComparison.acquired },
                  ])}
                  exportName="acquisition-state-comparison"
                  exportRows={stateComparison.states.map((s, i) => ({
                    state: s,
                    notifiedHa: stateComparison.notified[i],
                    acquiredHa: stateComparison.acquired[i],
                    avgPossessionPercent: stateComparison.possession[i],
                    avgRrPercent: stateComparison.rr[i],
                  }))}
                />
                <ChartCard
                  title="District delay exposure"
                  subtitle="Average delay probability versus acquisition progress"
                  height={320}
                  isEmpty={!districtComparison.length}
                  option={groupedBarOption(
                    districtComparison.map((d) => d.district),
                    [
                      { name: 'Delay probability %', data: districtComparison.map((d) => d.delay), color: THEME.red },
                      { name: 'Acquisition progress %', data: districtComparison.map((d) => d.progress), color: THEME.teal },
                    ],
                    '%',
                  )}
                  exportName="acquisition-district-comparison"
                  exportRows={districtComparison}
                />
              </div>
            ),
          },
          { id: 'register', label: 'Project register', content: <ProjectRegister projects={projects} onOpen={(p) => navigate(`/projects/${p.code}`)} /> },
        ]}
      />
    </div>
  );
}

type StageSummary = {
  stage: LifecycleStage;
  projects: Project[];
  completed: number;
  pending: number;
  delayed: number;
  avgDuration: number;
  statutory: number;
  pendingDocuments: number;
  riskContribution: number;
  officer: string;
  daysRemaining: number;
};

function KanbanView({ summary, onOpen }: { summary: StageSummary[]; onOpen: (p: Project) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto scroll-thin pb-2">
      {summary.map((s) => (
        <div key={s.stage} className="w-[236px] shrink-0">
          <div className="surface-card flex h-full flex-col">
            <header className="border-b border-line/60 px-3 py-2">
              <p className="text-[13px] font-semibold leading-tight">{STAGE_LABEL[s.stage]}</p>
              <p className="metric text-2xs text-muted">
                {s.projects.length} project(s) · {s.delayed} delayed case(s)
              </p>
              <div className="mt-1">
                <ProgressBar
                  value={s.statutory ? Math.min(100, (s.avgDuration / s.statutory) * 100) : 0}
                  tone={s.avgDuration > s.statutory ? 'red' : 'teal'}
                  height={4}
                />
              </div>
            </header>
            <div className="max-h-[420px] flex-1 space-y-1.5 overflow-y-auto scroll-thin p-2">
              {s.projects.slice(0, 24).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpen(p)}
                  className="w-full rounded border border-line/70 bg-paper/50 p-2 text-left hover:border-teal"
                >
                  <span className="block truncate text-2xs font-semibold">{p.name}</span>
                  <span className="metric block text-[10px] text-muted">
                    {p.code} · {p.district}
                  </span>
                  <span className="mt-1 flex items-center justify-between">
                    <RiskBadge level={p.riskLevel} score={p.riskScore} />
                    <span className="metric text-[10px] text-muted">{relativeDays(p.pendingDays)}</span>
                  </span>
                </button>
              ))}
              {s.projects.length === 0 && (
                <p className="px-1 py-6 text-center text-2xs text-muted">No projects in this stage</p>
              )}
              {s.projects.length > 24 && (
                <p className="px-1 pt-1 text-center text-[10px] text-muted">
                  +{s.projects.length - 24} more
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StageTable({ summary }: { summary: StageSummary[] }) {
  const columns: Column<StageSummary>[] = [
    { key: 'stage', header: 'Stage', accessor: (r) => STAGE_LABEL[r.stage], render: (r) => <span className="font-medium">{STAGE_LABEL[r.stage]}</span> },
    { key: 'projects', header: 'Projects', accessor: (r) => r.projects.length, align: 'right' },
    { key: 'completed', header: 'Completed cases', accessor: (r) => r.completed, align: 'right' },
    { key: 'pending', header: 'Pending cases', accessor: (r) => r.pending, align: 'right' },
    { key: 'delayed', header: 'Delayed cases', accessor: (r) => r.delayed, align: 'right', render: (r) => <span className="metric text-signal-red">{r.delayed.toLocaleString('en-IN')}</span> },
    { key: 'avg', header: 'Avg duration (days)', accessor: (r) => r.avgDuration, align: 'right' },
    { key: 'statutory', header: 'Statutory reference (days)', accessor: (r) => r.statutory, align: 'right' },
    {
      key: 'remaining',
      header: 'Days remaining',
      accessor: (r) => r.daysRemaining,
      align: 'right',
      render: (r) => (
        <span className={r.daysRemaining < 0 ? 'metric text-signal-red' : 'metric'}>{r.daysRemaining}</span>
      ),
    },
    { key: 'officer', header: 'Responsible officer', accessor: (r) => r.officer },
    { key: 'docs', header: 'Pending documents', accessor: (r) => r.pendingDocuments, align: 'right' },
    {
      key: 'risk',
      header: 'Risk contribution',
      accessor: (r) => r.riskContribution,
      align: 'right',
      render: (r) => <ProgressBar value={r.riskContribution * 4} tone="amber" showLabel={false} />,
      width: '110px',
    },
    {
      key: 'deps',
      header: 'Depends on',
      sortable: false,
      render: (r) => {
        const idx = LIFECYCLE_STAGES.indexOf(r.stage);
        return idx > 0 ? <Badge tone="neutral">{STAGE_LABEL[LIFECYCLE_STAGES[idx - 1]]}</Badge> : <span className="text-muted">—</span>;
      },
    },
  ];
  return (
    <Card dense title="Stage workload and statutory position">
      <DataTable rows={summary} columns={columns} rowKey={(r) => r.stage} pageSize={11} />
    </Card>
  );
}

function GanttView({ projects }: { projects: Project[] }) {
  const dataset = getDataset();
  const [selectedCode, setSelectedCode] = useState(projects[0]?.code ?? '');
  const project = projects.find((p) => p.code === selectedCode) ?? projects[0];

  const rows: GanttRow[] = useMemo(() => {
    if (!project) return [];
    return dataset.projectStages
      .filter((s) => s.projectId === project.id)
      .map((s) => ({
        name: STAGE_LABEL[s.stage],
        plannedStart: new Date(s.plannedStart).getTime(),
        plannedEnd: new Date(s.plannedEnd).getTime(),
        actualStart: s.actualStart ? new Date(s.actualStart).getTime() : null,
        actualEnd: s.actualEnd ? new Date(s.actualEnd).getTime() : null,
        delayed: s.status === 'delayed',
        critical: s.onCriticalPath,
      }));
  }, [project, dataset.projectStages]);

  if (!project) return <Card>No projects in scope.</Card>;

  return (
    <div className="space-y-3">
      <Card
        title={`Gantt · ${project.name}`}
        subtitle="Grey = planned, teal = actual, red = delayed, outlined = critical path"
        actions={
          <select
            className="field w-64 py-1 text-2xs"
            value={selectedCode}
            aria-label="Select project for Gantt"
            onChange={(e) => setSelectedCode(e.target.value)}
          >
            {projects.slice(0, 200).map((p) => (
              <option key={p.id} value={p.code}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        }
        footer={`Predicted completion ${formatDate(project.predictedCompletion)} against planned ${formatDate(project.plannedCompletion)}. Simulated prediction for prototype demonstration. Not a legal determination.`}
      >
        <EChart
          option={ganttOption(
            rows,
            new Date('2026-09-09').getTime(),
            new Date(project.predictedCompletion).getTime(),
          )}
          height={380}
          ariaLabel={`Gantt chart for ${project.name}`}
        />
      </Card>
    </div>
  );
}

function TimelineView({ projects, onOpen }: { projects: Project[]; onOpen: (p: Project) => void }) {
  const dataset = getDataset();
  const [code, setCode] = useState(projects[0]?.code ?? '');
  const project = projects.find((p) => p.code === code) ?? projects[0];
  if (!project) return <Card>No projects in scope.</Card>;
  const milestones = dataset.milestones
    .filter((m) => m.projectId === project.id)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <Card
      title={`Milestone timeline · ${project.name}`}
      actions={
        <div className="flex gap-1.5">
          <select
            className="field w-64 py-1 text-2xs"
            value={code}
            aria-label="Select project for timeline"
            onChange={(e) => setCode(e.target.value)}
          >
            {projects.slice(0, 200).map((p) => (
              <option key={p.id} value={p.code}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
          <button className="btn-secondary py-1 text-2xs" onClick={() => onOpen(project)}>
            Open project
          </button>
        </div>
      }
    >
      <ol className="relative space-y-3 border-l border-line pl-5">
        {milestones.map((m) => (
          <li key={m.id} className="relative">
            <span
              className={`absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full ${
                m.status === 'completed'
                  ? 'bg-signal-green'
                  : m.status === 'overdue'
                    ? 'bg-signal-red'
                    : 'bg-line'
              }`}
            />
            <p className="text-[13px] font-medium">{m.title}</p>
            <p className="text-2xs text-muted">
              {STAGE_LABEL[m.stage]} · due {formatDate(m.dueDate)}
              {m.completedDate ? ` · completed ${formatDate(m.completedDate)}` : ''}
            </p>
            <p className="text-2xs text-muted">{m.note}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ProjectRegister({ projects, onOpen }: { projects: Project[]; onOpen: (p: Project) => void }) {
  const columns: Column<Project>[] = [
    { key: 'code', header: 'Code', accessor: (p) => p.code, render: (p) => <span className="metric">{p.code}</span> },
    { key: 'name', header: 'Project', accessor: (p) => p.name },
    { key: 'type', header: 'Type', accessor: (p) => p.projectType, render: (p) => PROJECT_TYPE_LABEL[p.projectType] },
    { key: 'state', header: 'State', accessor: (p) => p.state },
    { key: 'district', header: 'District', accessor: (p) => p.district },
    { key: 'stage', header: 'Stage', accessor: (p) => p.currentStage, render: (p) => STAGE_LABEL[p.currentStage] },
    { key: 'proposed', header: 'Proposed', accessor: (p) => p.proposedArea, align: 'right', render: (p) => formatArea(p.proposedArea, 0) },
    { key: 'acquired', header: 'Acquired', accessor: (p) => p.acquiredArea, align: 'right', render: (p) => formatArea(p.acquiredArea, 0) },
    { key: 'comp', header: 'Compensation paid', accessor: (p) => p.compensationPaid, align: 'right', render: (p) => formatCurrency(p.compensationPaid) },
    { key: 'progress', header: 'Completion', accessor: (p) => p.completionPercent, width: '120px', render: (p) => <ProgressBar value={p.completionPercent} /> },
    { key: 'risk', header: 'Risk', accessor: (p) => p.riskScore, align: 'center', render: (p) => <RiskBadge level={p.riskLevel} score={p.riskScore} /> },
    { key: 'status', header: 'Stage status', sortable: false, render: (p) => <StatusBadge status={p.pendingDays > 240 ? 'delayed' : 'in_progress'} /> },
  ];
  return (
    <Card dense title={`Project register (${projects.length.toLocaleString('en-IN')})`}>
      <DataTable rows={projects} columns={columns} rowKey={(p) => p.id} onRowClick={onOpen} pageSize={14} />
    </Card>
  );
}
