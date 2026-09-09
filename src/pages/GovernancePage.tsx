import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatTile } from '@/components/kpi/KpiCard';
import { ProgressBar } from '@/components/ui/Form';
import { ROLE_LIST } from '@/auth/roles';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { MODEL_VERSION, FACTORS } from '@/risk/model';
import { RULES } from '@/validation/engine';
import { formatDateTime } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import type { Role } from '@/types';

const SECURITY_CONTROLS = [
  { control: 'Role-based access control', status: 'Implemented', detail: '14 roles with 32 fine-grained permissions enforced in routing, actions and the copilot.' },
  { control: 'Fine-grained permissions', status: 'Implemented', detail: 'Every mutating action is gated by a named permission rather than a role check.' },
  { control: 'Secure authentication', status: 'Prototype', detail: 'Demo role sign-in; production integrates OAuth 2.0 / OpenID Connect with departmental IdPs.' },
  { control: 'Session management', status: 'Prototype', detail: 'Session persisted locally; production issues short-lived JWTs with refresh rotation.' },
  { control: 'Encryption in transit', status: 'Deployment', detail: 'TLS 1.2+ terminated at the ingress; HSTS enabled in the reference deployment.' },
  { control: 'Encryption at rest', status: 'Deployment', detail: 'Database and object storage encryption keys managed by the platform KMS.' },
  { control: 'Data masking', status: 'Implemented', detail: 'Bank accounts, identity numbers and citizen-facing owner names are masked by default.' },
  { control: 'Document-access logs', status: 'Implemented', detail: 'Document opens and downloads are recorded as audit events.' },
  { control: 'Field-change logs', status: 'Implemented', detail: 'Every extracted-field correction stores the old and new value.' },
  { control: 'Reviewer-decision logs', status: 'Implemented', detail: 'Approve, correct, reject, escalate and clarification requests are all audited.' },
  { control: 'Model-version logs', status: 'Implemented', detail: `Predictions record the model version (${MODEL_VERSION}) and run timestamp.` },
  { control: 'Prediction history', status: 'Implemented', detail: 'Risk predictions are retained with confidence and data-completeness metadata.' },
  { control: 'API-access logs', status: 'Implemented', detail: 'Adapter calls and retries are recorded with correlation identifiers.' },
  { control: 'Download logs', status: 'Implemented', detail: 'Report generation writes the report, format and row count to the audit trail.' },
  { control: 'Failed-login monitoring', status: 'Prototype', detail: 'Failed authentication events are modelled in the audit stream.' },
  { control: 'Consent and purpose display', status: 'Implemented', detail: 'Citizen services state the purpose of processing and the masking policy.' },
  { control: 'Retention policy', status: 'Placeholder', detail: 'Retention windows are declared per entity and enforced by the platform scheduler.' },
];

const RETENTION = [
  { entity: 'Document scans', retention: '10 years after project closure', basis: 'Departmental record policy' },
  { entity: 'Extracted fields', retention: 'Life of the record', basis: 'Land record permanence' },
  { entity: 'Audit events', retention: '8 years', basis: 'Assurance and audit requirement' },
  { entity: 'Risk predictions', retention: '3 years', basis: 'Model governance' },
  { entity: 'Citizen grievances', retention: '5 years after closure', basis: 'Grievance redressal policy' },
  { entity: 'Field photographs', retention: '5 years', basis: 'Evidence retention' },
];

export default function GovernancePage() {
  const dataset = getDataset();
  const localAudit = useAppStore((s) => s.workspace.auditTrail);

  const roleColumns: Column<Role>[] = [
    { key: 'label', header: 'Role', accessor: (r) => r.label, width: '210px' },
    { key: 'scope', header: 'Scope', accessor: (r) => r.scope, render: (r) => <Badge tone="neutral">{r.scope}</Badge> },
    { key: 'landing', header: 'Landing module', accessor: (r) => r.landingRoute, render: (r) => <span className="metric text-2xs">{r.landingRoute}</span> },
    { key: 'count', header: 'Permissions', accessor: (r) => r.permissions.length, align: 'right' },
    {
      key: 'perms',
      header: 'Granted permissions',
      sortable: false,
      render: (r) => (
        <span className="flex flex-wrap gap-0.5">
          {r.permissions.slice(0, 8).map((p) => (
            <Badge key={p} tone="neutral">
              {p}
            </Badge>
          ))}
          {r.permissions.length > 8 && <Badge tone="teal">+{r.permissions.length - 8}</Badge>}
        </span>
      ),
    },
    { key: 'desc', header: 'Description', accessor: (r) => r.description },
  ];

  const recentDecisions = useMemo(
    () => [...localAudit, ...dataset.auditLogs].filter((a) => a.action.includes('field') || a.action.includes('validation')).slice(0, 12),
    [localAudit, dataset.auditLogs],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Governance, Security and Model Assurance"
        description="The control posture behind the platform: access control, privacy, auditability, model transparency and retention."
        trail={[{ label: 'Governance' }]}
        actions={
          <button className="btn-secondary" onClick={() => exportCsv(SECURITY_CONTROLS, 'security-controls')}>
            Export control register
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Roles defined" value={String(ROLE_LIST.length)} />
        <StatTile label="Permissions" value="32" />
        <StatTile label="Validation rules" value={String(RULES.length)} />
        <StatTile label="Risk factors" value={String(FACTORS.length)} />
        <StatTile label="Audit events" value={(dataset.auditLogs.length + localAudit.length).toLocaleString('en-IN')} />
        <StatTile label="Model version" value={MODEL_VERSION.split('-').pop() ?? 'v2'} />
      </div>

      <Card dense title="Role and permission matrix" subtitle="Access is enforced at the route, action and copilot level">
        <DataTable rows={ROLE_LIST} columns={roleColumns} rowKey={(r) => r.id} pageSize={14} />
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card dense title="Security and privacy control register">
          <DataTable
            rows={SECURITY_CONTROLS}
            columns={[
              { key: 'control', header: 'Control', accessor: (r) => r.control, width: '220px' },
              {
                key: 'status',
                header: 'Status',
                accessor: (r) => r.status,
                render: (r) => (
                  <Badge tone={r.status === 'Implemented' ? 'green' : r.status === 'Prototype' ? 'amber' : 'neutral'}>
                    {r.status}
                  </Badge>
                ),
              },
              { key: 'detail', header: 'Implementation detail', accessor: (r) => r.detail },
            ]}
            rowKey={(r) => r.control}
            pageSize={10}
          />
        </Card>

        <div className="space-y-3">
          <Card title="Model governance" subtitle={`Delay-risk model ${MODEL_VERSION}`}>
            <p className="text-[13px]">
              The delay-risk model is a transparent weighted-factor model. Weights are declared in code,
              every prediction stores its inputs, and each factor contributes an explainable number of
              risk points. No opaque scoring is used for administrative decisions in this prototype.
            </p>
            <ul className="mt-2 space-y-1">
              {FACTORS.map((f) => (
                <li key={f.key}>
                  <div className="flex justify-between text-2xs">
                    <span>{f.label}</span>
                    <span className="metric">weight {f.weight}</span>
                  </div>
                  <ProgressBar value={(f.weight / 22) * 100} tone="teal" showLabel={false} height={4} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-2xs italic text-muted">
              Simulated prediction for prototype demonstration. Not a legal determination.
            </p>
          </Card>

          <Card title="Validation rule register" subtitle="Deterministic, re-runnable rules">
            <ul className="space-y-1 text-[13px]">
              {RULES.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2">
                  <span>{r.title}</span>
                  <Badge tone="neutral">{r.category.replace(/_/g, ' ')}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card dense title="Retention policy">
          <DataTable
            rows={RETENTION}
            columns={[
              { key: 'entity', header: 'Entity', accessor: (r) => r.entity },
              { key: 'retention', header: 'Retention window', accessor: (r) => r.retention },
              { key: 'basis', header: 'Basis', accessor: (r) => r.basis },
            ]}
            rowKey={(r) => r.entity}
            pageSize={8}
          />
        </Card>

        <Card dense title="Recent reviewer decisions" subtitle="Sampled from the audit trail">
          <ul className="divide-y divide-line/40">
            {recentDecisions.map((a) => (
              <li key={a.id} className="px-3 py-1.5">
                <p className="text-[13px]">
                  <b>{a.actor}</b> ({a.role.replace(/_/g, ' ')}) — {a.action}
                </p>
                <p className="text-2xs text-muted">
                  {a.entityType} {a.entityId}
                  {a.oldValue ? ` · "${a.oldValue}" → "${a.newValue}"` : ''} · {formatDateTime(a.timestamp)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Consent and purpose statement">
        <p className="text-[13px] leading-relaxed">
          Land records processed by BhoomiLens are handled for the administrative purposes of record
          modernisation, acquisition monitoring, compensation delivery and grievance redressal.
          Personal identifiers are minimised, masked by default and never exposed through public
          citizen services. Predictive outputs are advisory decision support and are labelled as such
          throughout the interface. This environment contains only synthetic data generated for
          demonstration.
        </p>
      </Card>
    </div>
  );
}
