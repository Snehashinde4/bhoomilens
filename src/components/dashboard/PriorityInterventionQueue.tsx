import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Labelled, Select, TextInput } from '@/components/ui/Form';
import { Can } from '@/auth/PermissionGuard';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { useScope } from '@/hooks/useScope';
import { filterProjects } from '@/services/analytics';
import { STAGE_LABEL } from '@/config/constants';
import { formatDate, iso, relativeDays, addDays } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import { recommendIntervention } from '@/risk/model';
import type { Intervention, Project, RiskLevel } from '@/types';

interface QueueRow {
  project: Project;
  recommended: string;
  interventionStatus: string;
}

export function PriorityInterventionQueue() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();
  const localInterventions = useAppStore((s) => s.workspace.interventions);
  const addIntervention = useAppStore((s) => s.addIntervention);
  const updateIntervention = useAppStore((s) => s.updateIntervention);
  const user = useAppStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<{ project: Project; mode: 'create' | 'assign' | 'note' } | null>(null);
  const [officer, setOfficer] = useState('');
  const [note, setNote] = useState('');

  const rows = useMemo<QueueRow[]>(() => {
    const all = [...localInterventions, ...dataset.interventions];
    return filterProjects(dataset.projects, scope)
      .filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical')
      .filter((p) => riskFilter === 'ALL' || p.riskLevel === riskFilter)
      .filter((p) =>
        !search.trim()
          ? true
          : `${p.code} ${p.name} ${p.district} ${p.state} ${p.primaryDelayDriver}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
      )
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 400)
      .map((project) => {
        const existing = all.find((i) => i.projectId === project.id);
        return {
          project,
          recommended:
            dataset.riskPredictions.find((r) => r.projectId === project.id)?.recommendedIntervention ??
            recommendIntervention(project.primaryDelayDriver),
          interventionStatus: existing?.status ?? 'not_created',
        };
      });
  }, [dataset, scope, search, riskFilter, localInterventions]);

  const columns: Column<QueueRow>[] = [
    {
      key: 'project',
      header: 'Project',
      accessor: (r) => r.project.name,
      render: (r) => (
        <button
          type="button"
          className="text-left font-medium text-signal-blue hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/projects/${r.project.code}`);
          }}
        >
          <span className="block leading-tight">{r.project.name}</span>
          <span className="metric block text-2xs text-muted">{r.project.code}</span>
        </button>
      ),
      width: '210px',
    },
    { key: 'state', header: 'State', accessor: (r) => r.project.state },
    { key: 'district', header: 'District', accessor: (r) => r.project.district },
    {
      key: 'stage',
      header: 'Current stage',
      accessor: (r) => r.project.currentStage,
      render: (r) => STAGE_LABEL[r.project.currentStage],
    },
    {
      key: 'risk',
      header: 'Risk',
      accessor: (r) => r.project.riskScore,
      align: 'center',
      render: (r) => <RiskBadge level={r.project.riskLevel} score={r.project.riskScore} />,
    },
    { key: 'driver', header: 'Primary delay driver', accessor: (r) => r.project.primaryDelayDriver },
    {
      key: 'pending',
      header: 'Pending',
      accessor: (r) => r.project.pendingDays,
      align: 'right',
      render: (r) => <span className="metric">{relativeDays(r.project.pendingDays)}</span>,
    },
    { key: 'office', header: 'Responsible office', accessor: (r) => r.project.responsibleOffice },
    {
      key: 'recommended',
      header: 'Recommended intervention',
      accessor: (r) => r.recommended,
      render: (r) => <span className="block max-w-[280px] text-2xs text-muted">{r.recommended}</span>,
      sortable: false,
    },
    {
      key: 'intStatus',
      header: 'Intervention',
      accessor: (r) => r.interventionStatus,
      render: (r) =>
        r.interventionStatus === 'not_created' ? (
          <Badge tone="neutral">Not created</Badge>
        ) : (
          <StatusBadge status={r.interventionStatus} />
        ),
    },
    {
      key: 'updated',
      header: 'Last updated',
      accessor: (r) => r.project.updatedAt,
      render: (r) => <span className="metric text-2xs">{formatDate(r.project.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (r) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button className="btn-secondary px-1.5 py-0.5 text-2xs" onClick={() => navigate(`/projects/${r.project.code}`)}>
            Open
          </button>
          <Can permission="project.intervene">
            <button
              className="btn-teal px-1.5 py-0.5 text-2xs"
              onClick={() => {
                setModal({ project: r.project, mode: 'create' });
                setNote(r.recommended);
              }}
            >
              Intervene
            </button>
          </Can>
        </div>
      ),
    },
  ];

  const createIntervention = (project: Project, escalate = false) => {
    const intervention: Intervention = {
      id: `local-${Date.now()}`,
      code: `INT-L${String(Date.now()).slice(-5)}`,
      projectId: project.id,
      title: `${project.primaryDelayDriver} mitigation for ${project.name}`,
      description: note || recommendIntervention(project.primaryDelayDriver),
      driver: project.primaryDelayDriver,
      priority: escalate ? 'critical' : project.riskLevel,
      status: escalate ? 'escalated' : officer ? 'assigned' : 'proposed',
      assignedOffice: project.responsibleOffice,
      assignedOfficer: officer || null,
      createdAt: iso(new Date()),
      dueDate: iso(addDays(new Date(), escalate ? 7 : 30)),
      expectedRiskReduction: Math.max(4, Math.round(project.riskScore * 0.14)),
      notes: [
        {
          at: iso(new Date()),
          by: user?.name ?? 'Demo user',
          text: note || 'Intervention created from the priority queue.',
        },
      ],
    };
    addIntervention(intervention);
    setModal(null);
    setOfficer('');
    setNote('');
  };

  return (
    <Card
      title="Priority intervention queue"
      subtitle="Projects and cases requiring administrative action, ranked by risk score"
      dense
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <TextInput
            className="w-52 py-1 text-2xs"
            placeholder="Search project, district, driver…"
            value={search}
            aria-label="Search intervention queue"
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            className="w-28 py-1 text-2xs"
            aria-label="Filter by risk level"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskLevel | 'ALL')}
            options={[
              { value: 'ALL', label: 'All risk' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
            ]}
          />
          <Can permission="project.intervene">
            <button
              className="btn-secondary py-1 text-2xs"
              disabled={!selected.length}
              onClick={() => {
                const first = rows.find((r) => selected.includes(r.project.id));
                if (first) setModal({ project: first.project, mode: 'assign' });
              }}
            >
              Bulk assign ({selected.length})
            </button>
          </Can>
          <button
            className="btn-secondary py-1 text-2xs"
            onClick={() =>
              exportCsv(
                rows.map((r) => ({
                  code: r.project.code,
                  project: r.project.name,
                  state: r.project.state,
                  district: r.project.district,
                  stage: STAGE_LABEL[r.project.currentStage],
                  riskScore: r.project.riskScore,
                  riskLevel: r.project.riskLevel,
                  primaryDelayDriver: r.project.primaryDelayDriver,
                  pendingDays: r.project.pendingDays,
                  responsibleOffice: r.project.responsibleOffice,
                  recommendedIntervention: r.recommended,
                  interventionStatus: r.interventionStatus,
                })),
                'priority-intervention-queue',
              )
            }
          >
            Export CSV
          </button>
        </div>
      }
      footer={`${rows.length} project(s) currently meet the intervention threshold (risk ≥ 65).`}
    >
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.project.id}
        pageSize={10}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        onRowClick={(r) => navigate(`/projects/${r.project.code}`)}
        emptyTitle="No projects require intervention in this scope"
        emptyDescription="Widen the state or district filter, or lower the risk filter, to review more projects."
        maxHeight={520}
      />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? `Create intervention · ${modal.project.name}` : ''}
        footer={
          modal && (
            <>
              <button className="btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={() => createIntervention(modal.project, true)}>
                Escalate
              </button>
              <button className="btn-primary" onClick={() => createIntervention(modal.project)}>
                Create intervention
              </button>
            </>
          )
        }
      >
        {modal && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <Info label="Project code" value={modal.project.code} />
              <Info label="Risk score" value={`${modal.project.riskScore} / 100 (${modal.project.riskLevel})`} />
              <Info label="Primary driver" value={modal.project.primaryDelayDriver} />
              <Info label="Pending" value={relativeDays(modal.project.pendingDays)} />
            </div>
            <Labelled label="Assign officer">
              <TextInput
                placeholder="Officer name"
                value={officer}
                onChange={(e) => setOfficer(e.target.value)}
              />
            </Labelled>
            <Labelled label="Intervention note" hint="Stored in the audit trail with your role and timestamp.">
              <textarea
                className="field h-24"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Labelled>
            {localInterventions
              .filter((i) => i.projectId === modal.project.id)
              .slice(0, 3)
              .map((i) => (
                <div key={i.id} className="rounded border border-line bg-paper/50 p-2">
                  <p className="text-2xs font-semibold">{i.code} · {i.status}</p>
                  <p className="text-2xs text-muted">{i.description}</p>
                  <div className="mt-1 flex gap-1">
                    <button
                      className="btn-secondary py-0.5 text-2xs"
                      onClick={() => updateIntervention(i.id, { status: 'in_progress' })}
                    >
                      Mark in progress
                    </button>
                    <button
                      className="btn-secondary py-0.5 text-2xs"
                      onClick={() => updateIntervention(i.id, { status: 'resolved' })}
                    >
                      Mark resolved
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Modal>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="metric text-[13px]">{value}</p>
    </div>
  );
}
