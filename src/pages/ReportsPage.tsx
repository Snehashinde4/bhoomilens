import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Labelled, Select, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { useScope } from '@/hooks/useScope';
import { buildNationalKpis, filterByGeo, filterProjects, formatKpi } from '@/services/analytics';
import { STAGE_LABEL, VALIDATION_CATEGORY_LABEL } from '@/config/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { exportCsv, exportExcel, exportJson, printView } from '@/lib/export';
import { pct, sum } from '@/lib/stats';

type ReportId =
  | 'national'
  | 'state'
  | 'district'
  | 'projectRisk'
  | 'lifecycle'
  | 'compensation'
  | 'rr'
  | 'digitization'
  | 'fraud'
  | 'gis'
  | 'backlog'
  | 'watershed'
  | 'audit'
  | 'intervention';

interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
  build: () => Array<Record<string, unknown>>;
}

interface HistoryEntry {
  id: string;
  report: string;
  format: string;
  rows: number;
  at: string;
}

export default function ReportsPage() {
  const scope = useScope();
  const dataset = getDataset();
  const recordAudit = useAppStore((s) => s.recordAudit);
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);
  const interventions = useAppStore((s) => s.workspace.interventions);

  const [active, setActive] = useState<ReportId>('national');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedule, setSchedule] = useState({ frequency: 'weekly', recipients: '', format: 'PDF' });
  const [templates, setTemplates] = useState<Array<{ name: string; report: ReportId }>>([]);
  const [templateName, setTemplateName] = useState('');

  const projects = useMemo(() => filterProjects(dataset.projects, scope), [dataset.projects, scope]);
  const kpis = useMemo(() => buildNationalKpis(scope), [scope]);

  const definitions: ReportDefinition[] = useMemo(
    () => [
      {
        id: 'national',
        title: 'National progress report',
        description: 'Every headline indicator with its comparison period and movement.',
        build: () =>
          kpis.map((k) => ({
            indicator: k.label,
            value: formatKpi(k),
            rawValue: k.value,
            previousValue: k.previousValue,
            changePercent: k.changePercent,
            comparisonPeriod: k.comparisonPeriod,
            status: k.status,
          })),
      },
      {
        id: 'state',
        title: 'State progress report',
        description: 'Projects, area and compensation aggregated by state.',
        build: () => {
          const map = new Map<string, { projects: number; proposed: number; acquired: number; assessed: number; paid: number }>();
          projects.forEach((p) => {
            const cur = map.get(p.state) ?? { projects: 0, proposed: 0, acquired: 0, assessed: 0, paid: 0 };
            cur.projects += 1;
            cur.proposed += p.proposedArea;
            cur.acquired += p.acquiredArea;
            cur.assessed += p.compensationAssessed;
            cur.paid += p.compensationPaid;
            map.set(p.state, cur);
          });
          return [...map.entries()].map(([state, v]) => ({
            state,
            projects: v.projects,
            proposedAreaHa: v.proposed,
            acquiredAreaHa: v.acquired,
            acquisitionProgressPercent: pct(v.acquired, v.proposed),
            compensationAssessed: v.assessed,
            compensationPaid: v.paid,
            compensationProgressPercent: pct(v.paid, v.assessed),
          }));
        },
      },
      {
        id: 'district',
        title: 'District performance report',
        description: 'Digitisation, backlog, compensation and delay exposure by district.',
        build: () =>
          filterByGeo(dataset.districtMetrics, scope).map((d) => ({
            district: d.district,
            state: d.state,
            projects: d.projects,
            parcels: d.parcels,
            digitizationProgress: d.digitizationProgress,
            digitizationAccuracy: d.digitizationAccuracy,
            reviewBacklog: d.reviewBacklog,
            fraudAlerts: d.fraudAlerts,
            compensationProgress: d.compensationProgress,
            acquisitionProgress: d.acquisitionProgress,
            delayProbability: d.delayProbability,
            processingSpeedDocsPerDay: d.processingSpeedDocsPerDay,
            interventionClosureRate: d.interventionClosureRate,
          })),
      },
      {
        id: 'projectRisk',
        title: 'Project-risk report',
        description: 'Risk scores, drivers and predicted completion for every project in scope.',
        build: () =>
          projects.map((p) => ({
            code: p.code,
            project: p.name,
            state: p.state,
            district: p.district,
            stage: STAGE_LABEL[p.currentStage],
            riskScore: p.riskScore,
            riskLevel: p.riskLevel,
            delayProbability: p.delayProbability,
            primaryDelayDriver: p.primaryDelayDriver,
            pendingDays: p.pendingDays,
            plannedCompletion: p.plannedCompletion,
            predictedCompletion: p.predictedCompletion,
            disclaimer: 'Simulated prediction for prototype demonstration. Not a legal determination.',
          })),
      },
      {
        id: 'lifecycle',
        title: 'Acquisition lifecycle report',
        description: 'Stage-level workload and statutory position.',
        build: () => {
          const ids = new Set(projects.map((p) => p.id));
          return dataset.projectStages
            .filter((s) => ids.has(s.projectId))
            .slice(0, 8000)
            .map((s) => ({
              projectId: dataset.projects.find((p) => p.id === s.projectId)?.code ?? s.projectId,
              stage: STAGE_LABEL[s.stage],
              status: s.status,
              completedCases: s.completedCases,
              pendingCases: s.pendingCases,
              delayedCases: s.delayedCases,
              averageDurationDays: s.averageDurationDays,
              statutoryDeadlineDays: s.statutoryDeadlineDays,
              daysRemaining: s.daysRemaining,
              responsibleOfficer: s.responsibleOfficer,
              onCriticalPath: s.onCriticalPath,
            }));
        },
      },
      {
        id: 'compensation',
        title: 'Compensation report',
        description: 'Assessment and disbursement position with failure reasons.',
        build: () =>
          filterByGeo(dataset.compensation, scope).map((c) => ({
            beneficiaryId: c.beneficiaryId,
            parcelId: c.parcelId,
            district: c.district,
            state: c.state,
            amountAssessed: c.amountAssessed,
            amountPaid: c.amountPaid,
            status: c.status,
            assessedOn: c.assessedOn,
            paidOn: c.paidOn,
            disbursementDelayDays: c.disbursementDelayDays,
            failureReason: c.failureReason,
          })),
      },
      {
        id: 'rr',
        title: 'R&R report',
        description: 'Entitlements, site allotment and benefit disbursement.',
        build: () =>
          dataset.rrRecords.slice(0, 8000).map((r) => ({
            beneficiaryId: r.beneficiaryId,
            project: dataset.projects.find((p) => p.id === r.projectId)?.code ?? '',
            eligibility: r.eligibility,
            entitlements: r.entitlements.join('; '),
            siteAllotted: r.siteAllotted,
            siteCode: r.siteCode,
            benefitsDisbursedPercent: r.benefitsDisbursedPercent,
            status: r.status,
          })),
      },
      {
        id: 'digitization',
        title: 'Digitization quality report',
        description: 'Document confidence, language mix and pipeline position.',
        build: () =>
          filterByGeo(dataset.documents, scope)
            .slice(0, 8000)
            .map((d) => ({
              code: d.code,
              documentType: d.documentType,
              language: d.language,
              script: d.script,
              handwritten: d.isHandwritten,
              pages: d.pages,
              district: d.district,
              processingStage: d.processingStage,
              status: d.status,
              ocrConfidence: d.ocrConfidence,
              imageQuality: d.imageQuality,
              validationIssues: d.validationIssues,
            })),
      },
      {
        id: 'fraud',
        title: 'Potential anomaly report',
        description: 'Anomaly alerts with evidence and investigation status.',
        build: () =>
          filterByGeo(dataset.fraudAlerts, scope).map((a) => ({
            code: a.code,
            category: a.category,
            severity: a.severity,
            anomalyScore: a.anomalyScore,
            parcelId: a.parcelId,
            district: a.district,
            state: a.state,
            summary: a.summary,
            evidence: a.evidence.join('; '),
            status: a.status,
            investigator: a.investigator,
            note: 'Potential anomaly. Not a confirmed case of fraud.',
          })),
      },
      {
        id: 'gis',
        title: 'GIS discrepancy report',
        description: 'Parcels whose recorded area differs materially from the cadastral polygon.',
        build: () =>
          filterByGeo(dataset.parcels, scope)
            .filter((p) => Math.abs(p.area - p.gisArea) / p.area > 0.08)
            .slice(0, 8000)
            .map((p) => ({
              parcelId: p.parcelId,
              surveyNumber: p.surveyNumber,
              village: p.village,
              district: p.district,
              recordedAreaHa: p.area,
              gisAreaHa: p.gisArea,
              deviationPercent: Number((((p.area - p.gisArea) / p.area) * 100).toFixed(2)),
              legalStatus: p.legalStatus,
              trustScore: p.trustScore,
            })),
      },
      {
        id: 'backlog',
        title: 'Review-backlog report',
        description: 'Pending verification workload, SLA position and assignment.',
        build: () =>
          filterByGeo(dataset.reviewQueue, scope)
            .filter((t) => t.status !== 'completed')
            .slice(0, 8000)
            .map((t) => ({
              code: t.code,
              reason: t.reason,
              severity: t.severity,
              district: t.district,
              state: t.state,
              confidence: t.confidence,
              priorityScore: t.priorityScore,
              pendingDays: t.pendingDays,
              slaDays: t.slaDays,
              slaBreached: t.pendingDays > t.slaDays,
              assignedTo: t.assignedTo,
              status: t.status,
            })),
      },
      {
        id: 'watershed',
        title: 'Watershed insight report',
        description: 'Environmental observations with source, date and confidence.',
        build: () =>
          filterByGeo(dataset.watersheds, scope).map((w) => ({
            code: w.code,
            name: w.name,
            district: w.district,
            state: w.state,
            areaHa: w.areaHa,
            ndviStart: w.ndviTrend[0]?.value,
            ndviLatest: w.ndviTrend[w.ndviTrend.length - 1]?.value,
            erosionRiskBefore: w.erosionRiskBefore,
            erosionRiskAfter: w.erosionRiskAfter,
            encroachmentAlerts: w.encroachmentAlerts,
            interventionCoveragePercent: w.interventionCoveragePercent,
            observationDate: w.observationDate,
            confidence: w.confidence,
            verificationStatus: w.verificationStatus,
          })),
      },
      {
        id: 'audit',
        title: 'Audit report',
        description: 'Actor, action, record, values, reason and correlation identifier.',
        build: () =>
          dataset.auditLogs.slice(0, 5000).map((a) => ({
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
      },
      {
        id: 'intervention',
        title: 'Intervention report',
        description: 'Recommended and active administrative interventions.',
        build: () =>
          [...interventions, ...dataset.interventions].map((i) => ({
            code: i.code,
            project: dataset.projects.find((p) => p.id === i.projectId)?.code ?? '',
            title: i.title,
            driver: i.driver,
            priority: i.priority,
            status: i.status,
            assignedOffice: i.assignedOffice,
            assignedOfficer: i.assignedOfficer,
            createdAt: i.createdAt,
            dueDate: i.dueDate,
            expectedRiskReduction: i.expectedRiskReduction,
            description: i.description,
          })),
      },
    ],
    [kpis, projects, dataset, scope, interventions],
  );

  const definition = definitions.find((d) => d.id === active)!;
  const rows = useMemo(() => definition.build(), [definition]);

  const emitAudit = (format: string) => {
    recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: 'report.downloaded',
      entityType: 'Report',
      entityId: definition.id,
      oldValue: null,
      newValue: format,
      reason: `${definition.title} exported with ${rows.length} row(s)`,
    });
    setHistory((cur) => [
      {
        id: `RPT-${cur.length + 1}`,
        report: definition.title,
        format,
        rows: rows.length,
        at: new Date().toISOString(),
      },
      ...cur,
    ]);
  };

  const columns: Column<Record<string, unknown>>[] = useMemo(() => {
    const keys = Object.keys(rows[0] ?? {}).slice(0, 12);
    return keys.map((k) => ({
      key: k,
      header: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      accessor: (r) => (typeof r[k] === 'number' ? (r[k] as number) : String(r[k] ?? '')),
      render: (r) => {
        const v = r[k];
        if (typeof v === 'number' && /amount|compensation/i.test(k)) return formatCurrency(v);
        if (typeof v === 'string' && /date|On$|At$/i.test(k) && v.includes('-')) return formatDate(v);
        if (typeof v === 'boolean') return v ? <Badge tone="green">Yes</Badge> : <Badge tone="neutral">No</Badge>;
        return <span className="text-[13px]">{String(v ?? '—')}</span>;
      },
    }));
  }, [rows]);

  const totalAssessed = sum(
    rows.map((r) => (typeof r.amountAssessed === 'number' ? (r.amountAssessed as number) : 0)),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Report Centre"
        description="Fourteen operational reports generated from the same filtered data layer that drives the dashboards. Reports respect the header scope filters."
        trail={[{ label: 'Reports' }]}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setScheduleOpen(true)}>
              Schedule report
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                emitAudit('PDF (print view)');
                printView();
              }}
            >
              Printable / PDF
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                emitAudit('Excel');
                exportExcel(rows, definition.id);
              }}
            >
              Excel
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                emitAudit('JSON');
                exportJson(rows, definition.id);
              }}
            >
              JSON
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                emitAudit('CSV');
                exportCsv(rows, definition.id);
              }}
            >
              CSV
            </button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[260px_1fr]">
        <Card title="Report catalogue">
          <ul className="space-y-1">
            {definitions.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setActive(d.id)}
                  className={`w-full rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                    d.id === active ? 'border-teal bg-teal/10' : 'border-line/70 bg-paper/40 hover:border-teal/50'
                  }`}
                >
                  <span className="block text-[13px] font-medium">{d.title}</span>
                  <span className="block text-2xs text-muted">{d.description}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-line/60 pt-2">
            <Labelled label="Save as template">
              <div className="flex gap-1.5">
                <TextInput value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
                <button
                  className="btn-secondary"
                  disabled={!templateName.trim()}
                  onClick={() => {
                    setTemplates((cur) => [...cur, { name: templateName.trim(), report: active }]);
                    setTemplateName('');
                  }}
                >
                  Save
                </button>
              </div>
            </Labelled>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {templates.map((t) => (
                <button key={t.name} type="button" className="chip border-teal/40 bg-teal/10 text-teal" onClick={() => setActive(t.report)}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card
            dense
            title={`${definition.title} · preview`}
            subtitle={`${rows.length.toLocaleString('en-IN')} row(s) in the current scope${totalAssessed ? ` · ${formatCurrency(totalAssessed)} assessed` : ''}`}
          >
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(r) => JSON.stringify(r)}
              pageSize={12}
              emptyTitle="This report has no rows for the current filters"
            />
          </Card>

          <Card dense title="Report history" subtitle="Downloads generated in this session (also written to the audit trail)">
            {history.length === 0 ? (
              <p className="px-3 py-4 text-2xs text-muted">No reports generated yet in this session.</p>
            ) : (
              <ul className="divide-y divide-line/40">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="text-[13px]">
                      <span className="metric">{h.id}</span> · {h.report}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone="neutral">{h.format}</Badge>
                      <span className="metric text-2xs text-muted">{h.rows.toLocaleString('en-IN')} rows</span>
                      <span className="text-2xs text-muted">{formatDateTime(h.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title={`Schedule · ${definition.title}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                recordAudit({
                  actor: user?.name ?? 'Demo user',
                  role,
                  action: 'report.scheduled',
                  entityType: 'Report',
                  entityId: definition.id,
                  oldValue: null,
                  newValue: `${schedule.frequency} · ${schedule.format}`,
                  reason: `Recipients: ${schedule.recipients || 'not specified'}`,
                });
                setScheduleOpen(false);
              }}
            >
              Save schedule
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <Labelled label="Frequency">
            <Select
              value={schedule.frequency}
              aria-label="Schedule frequency"
              onChange={(e) => setSchedule((s) => ({ ...s, frequency: e.target.value }))}
              options={[
                { value: 'daily', label: 'Daily at 07:00' },
                { value: 'weekly', label: 'Weekly on Monday' },
                { value: 'fortnightly', label: 'Fortnightly' },
                { value: 'monthly', label: 'Monthly on the 1st' },
              ]}
            />
          </Labelled>
          <Labelled label="Format">
            <Select
              value={schedule.format}
              aria-label="Schedule format"
              onChange={(e) => setSchedule((s) => ({ ...s, format: e.target.value }))}
              options={[
                { value: 'PDF', label: 'PDF' },
                { value: 'Excel', label: 'Excel' },
                { value: 'CSV', label: 'CSV' },
              ]}
            />
          </Labelled>
          <Labelled label="Recipients" hint="Departmental distribution list; delivery is not performed in the demo.">
            <TextInput
              value={schedule.recipients}
              onChange={(e) => setSchedule((s) => ({ ...s, recipients: e.target.value }))}
              placeholder="collector.jaipur@example.gov.in"
            />
          </Labelled>
          <p className="text-2xs text-muted">
            Scheduling configuration is stored and audited. Actual delivery requires the notification
            service configured in the deployment environment.
          </p>
        </div>
      </Modal>

      <Card dense title="Validation category reference" subtitle="Used by the digitization quality and GIS discrepancy reports">
        <div className="flex flex-wrap gap-1 p-3">
          {Object.values(VALIDATION_CATEGORY_LABEL).map((v) => (
            <Badge key={v} tone="neutral">
              {v}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
